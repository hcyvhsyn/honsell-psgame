/**
 * HBO Max validasiya növbəsi, trek kimliyi və şou aqreqasiyası testləri —
 * `npm run test:hbomax-queue`. DB/brauzer tələb etmir.
 *
 * Bu məntiq sınsa ya vitrin AZ-da olmayan dublyajı "var" kimi göstərər, ya da
 * növbə dəyişmiş epizodları yenidən yoxlamaz.
 */
import { computeTitleLanguages, statusFor, type AggTrack } from "../lib/scrapers/hbomaxCollector/aggregate/titleLanguages";
import { PRIORITY, decideQueueAction, nextAttemptAfterFailure, type RegionStateSnapshot } from "../lib/scrapers/hbomaxCollector/queue/rules";
import { extractSeriesFromJson, idsFromUrl, titlePageUrl } from "../lib/scrapers/hbomaxCollector/parsers/jsonMetadata";
import { languageSlots, seasonCellState, seasonDifferences, seasonLanguageMatrix } from "../lib/streamingLanguageStates";
import { toStorefrontLanguages } from "../lib/scrapers/hbomaxCollector/projection/storefrontLanguages";
import { classifyAudioTracks } from "../lib/scrapers/hbomaxCollector/utils/language";
import { globalTracksHash, trackIdentityKey } from "../lib/scrapers/hbomaxCollector/utils/trackIdentity";

let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? `\n         ${detail}` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `gözlənilən ${e}\n         alınan     ${a}`);
}

// ── Trek kimliyi ────────────────────────────────────────────────────────────
const audio = classifyAudioTracks(
  ["English - Original", "English - Audio Description", "Spanish (Spain)", "Spanish (Latin America)", "Portuguese", "Portuguese (Brazil)"].map((label) => ({ label }))
);
const keys = audio.map((t) => trackIdentityKey("AUDIO", t));
eq("6 fərqli trek → 6 fərqli kimlik (yalnız code deyil)", new Set(keys).size, 6);
eq("English ↔ English AD ayrıdır", keys.slice(0, 2), ["AUDIO|main|en|", "AUDIO|audio_description|en|"]);
eq("es-ES ↔ es-419 ayrıdır", keys.slice(2, 4), ["AUDIO|main|es|es-ES", "AUDIO|main|es|es-419"]);
eq(
  "hash sıradan asılı deyil",
  globalTracksHash([{ rawLabel: "A" }, { rawLabel: "B" }], [{ rawLabel: "C" }]),
  globalTracksHash([{ rawLabel: "B" }, { rawLabel: "A" }], [{ rawLabel: "C" }])
);
check(
  "audio/altyazı yerdəyişməsi hash-i dəyişir",
  globalTracksHash([{ rawLabel: "A" }], []) !== globalTracksHash([], [{ rawLabel: "A" }])
);

// ── Növbə qaydaları ─────────────────────────────────────────────────────────
const now = new Date("2026-10-21T12:00:00Z");
const ctx = { now, revalidateAfterDays: 30, titleLinked: false, titleIsNew: false };
const fp = { editId: "e1", globalHash: "h1" };
const verified = (over: Partial<RegionStateSnapshot> = {}): RegionStateSnapshot => ({
  status: "VERIFIED",
  validatedEditId: "e1",
  validatedGlobalHash: "h1",
  verifiedAt: new Date("2026-10-10T00:00:00Z"),
  attempts: 1,
  ...over,
});

eq("yeni epizod (məlum başlıq) → PENDING P1", decideQueueAction(null, fp, ctx), { action: "create", status: "PENDING", priority: PRIORITY.NEW_EPISODE, reason: "NEW_EPISODE" });
eq("ilk kəşf (yeni başlıq) → P4", decideQueueAction(null, fp, { ...ctx, titleIsNew: true }), { action: "create", status: "PENDING", priority: PRIORITY.INITIAL_BACKLOG, reason: "INITIAL_BACKLOG" });
eq("vitrinə bağlı → P0", decideQueueAction(null, fp, { ...ctx, titleIsNew: true, titleLinked: true }).action === "create" && (decideQueueAction(null, fp, { ...ctx, titleLinked: true }) as { priority: number }).priority, 0);
eq("eyni edit+hash, təzə → keçilir", decideQueueAction(verified(), fp, ctx), { action: "keep" });
eq("edit dəyişib → STALE P2", decideQueueAction(verified(), { editId: "e2", globalHash: "h1" }, ctx), { action: "update", status: "STALE", priority: PRIORITY.CHANGED, reason: "CHANGED" });
eq("hash dəyişib → STALE P2", decideQueueAction(verified(), { editId: "e1", globalHash: "h2" }, ctx), { action: "update", status: "STALE", priority: PRIORITY.CHANGED, reason: "CHANGED" });
eq(
  "TTL bitib → VERIFIED qalmır, STALE P5",
  decideQueueAction(verified({ verifiedAt: new Date("2026-09-01T00:00:00Z") }), fp, ctx),
  { action: "update", status: "STALE", priority: PRIORITY.TTL, reason: "TTL" }
);
eq(
  "bağlı başlığın TTL-i P0-dır (vitrin təzə qalsın)",
  decideQueueAction(verified({ verifiedAt: new Date("2026-09-01T00:00:00Z") }), fp, { ...ctx, titleLinked: true }),
  { action: "update", status: "STALE", priority: 0, reason: "TTL" }
);
eq("VALIDATING-ə toxunulmur", decideQueueAction(verified({ status: "VALIDATING" }), { editId: "e9", globalHash: "h9" }, ctx), { action: "keep" });
eq("PENDING olduğu kimi qalır", decideQueueAction(verified({ status: "PENDING", validatedEditId: null, validatedGlobalHash: null, verifiedAt: null }), fp, ctx), { action: "keep" });
eq(
  "heç təsdiqlənməmiş FAILED (barmaq izi yoxdur) → keep (nextAttemptAt idarə edir)",
  decideQueueAction(verified({ status: "FAILED", validatedEditId: null, validatedGlobalHash: null, verifiedAt: null }), fp, ctx),
  { action: "keep" }
);
eq(
  "əvvəl təsdiqlənib, sonra FAILED, metadata dəyişib → STALE",
  decideQueueAction(verified({ status: "FAILED" }), { editId: "e2", globalHash: "h1" }, ctx),
  { action: "update", status: "STALE", priority: PRIORITY.CHANGED, reason: "CHANGED" }
);
eq("backoff: 1-ci uğursuzluq → +1 saat", nextAttemptAfterFailure(1, 3, now, 3_600_000)?.toISOString(), "2026-10-21T13:00:00.000Z");
eq("backoff: 2-ci → +6 saat", nextAttemptAfterFailure(2, 3, now, 3_600_000)?.toISOString(), "2026-10-21T18:00:00.000Z");
eq("max cəhd → terminal (null)", nextAttemptAfterFailure(3, 3, now, 3_600_000), null);

// ── Şou aqreqasiyası ────────────────────────────────────────────────────────
const t = (rawLabel: string): AggTrack => ({ ...classifyAudioTracks([{ label: rawLabel }])[0], kind: "AUDIO" });
const ru = t("Russian");
const tr = t("Turkish");
const de = t("German");
const ep = (verifiedEp: boolean, region: AggTrack[], listed = true) => ({ isCurrentlyListed: listed, verified: verifiedEp, globalTracks: [ru, tr, de], regionTracks: region });

eq("statusFor", [statusFor(3, 3, 3), statusFor(1, 3, 3), statusFor(0, 3, 3), statusFor(2, 2, 3)], ["FULL", "PARTIAL", "NONE", "UNVERIFIED"]);

const all = computeTitleLanguages([ep(true, [ru, tr]), ep(true, [ru]), ep(true, [ru]), ep(false, [], false)]);
const byCode = Object.fromEntries(all.rows.map((r) => [r.code, [r.status, r.episodesAvailable, r.episodesVerified, r.episodesTotal]]));
eq("ru 3/3 → FULL", byCode.ru, ["FULL", 3, 3, 3]);
eq("tr 1/3 → PARTIAL", byCode.tr, ["PARTIAL", 1, 3, 3]);
eq("de yalnız qlobalda → NONE (AZ-da yoxdur)", byCode.de, ["NONE", 0, 3, 3]);

const partial = computeTitleLanguages([ep(true, [ru, tr]), ep(false, [])]);
eq(
  "təsdiqlənməmiş epizod varsa UNVERIFIED — qlobal trek 'var' sayılmır",
  partial.rows.map((r) => [r.code, r.status, r.episodesAvailable]),
  [["de", "UNVERIFIED", 0], ["ru", "UNVERIFIED", 1], ["tr", "UNVERIFIED", 1]]
);

// ── Vitrin proyeksiyası (ProviderTitleLanguage → ContentLanguage) ─────────
const row = (kind: string, trackGroup: string, code: string, status: string, a: number, t = 26) => ({ kind, trackGroup, code, status, episodesAvailable: a, episodesTotal: t });
eq(
  "yalnız FULL/PARTIAL, yalnız tr/ru/en, AD dublyaj deyil, CC altyazıdır",
  toStorefrontLanguages([
    row("AUDIO", "main", "ru", "FULL", 26),
    row("AUDIO", "main", "tr", "PARTIAL", 8),
    row("AUDIO", "main", "de", "FULL", 26),
    row("AUDIO", "main", "en", "UNVERIFIED", 3),
    row("AUDIO", "audio_description", "en", "FULL", 26),
    row("SUBTITLE", "closed_caption", "en", "FULL", 26),
    row("SUBTITLE", "subtitle", "tr", "NONE", 0),
    row("SUBTITLE", "forced", "ru", "FULL", 26),
  ]).map((r) => `${r.kind}:${r.code}:${r.coverage}:${r.episodesAvailable}/${r.episodesTotal}`),
  ["AUDIO:ru:FULL:26/26", "AUDIO:tr:PARTIAL:8/26", "SUBTITLE:en:FULL:26/26"]
);
eq(
  "eyni dilin variantları birləşir: FULL > PARTIAL",
  toStorefrontLanguages([row("SUBTITLE", "subtitle", "en", "PARTIAL", 20), row("SUBTITLE", "closed_caption", "en", "FULL", 26)]).map((r) => r.coverage),
  ["FULL"]
);
eq(
  "iki PARTIAL-dan daha çox epizodlu",
  toStorefrontLanguages([row("AUDIO", "main", "en", "PARTIAL", 5), row("AUDIO", "main", "en", "PARTIAL", 12)]).map((r) => r.episodesAvailable),
  [12]
);

// ── Vitrin dil vəziyyətləri (kart + detal) ──────────────────────────────────
const slots = languageSlots({
  audioLanguages: ["ru", "en", "tr"],
  subtitleLanguages: ["en"],
  languageCoverage: { "tr-dub": { coverage: "PARTIAL", available: 3, total: 26 }, "ru-dub": { coverage: "FULL", available: 26, total: 26 } },
});
eq("kart: həmişə TR/RU/EN sırası, 3 vəziyyət", slots.dub.map((x) => `${x.code}:${x.state}`), ["tr:partial", "ru:full", "en:full"]);
eq("kart: olmayan altyazı 'none'", slots.sub.map((x) => `${x.code}:${x.state}`), ["tr:none", "ru:none", "en:full"]);

const mEp = (s: number, e: number, verified: boolean, codes: Array<[string, string, string?]>) => ({
  seasonNumber: s, episodeNumber: e, name: null, verified,
  regionTracks: codes.map(([kind, code, type]) => ({ kind, code, type: type ?? (kind === "AUDIO" ? "dub" : "subtitle"), forced: false })),
});
const matrix = seasonLanguageMatrix([
  mEp(1, 1, true, [["AUDIO", "tr"], ["AUDIO", "en", "audio_description"], ["SUBTITLE", "en"]]),
  mEp(1, 2, true, [["SUBTITLE", "en"]]),
  mEp(2, 1, false, [["AUDIO", "tr"]]),
]);
eq("detal: sezon 1 — TR dub 1/2 qismən, EN sub 2/2 tam, AD dublyaj sayılmır",
  [seasonCellState(matrix[0], "tr-dub"), seasonCellState(matrix[0], "en-sub"), seasonCellState(matrix[0], "en-dub")],
  ["partial", "full", "none"]);
eq("detal: təsdiqlənməmiş sezon 'unverified', təsdiqsiz trek sayılmır", [seasonCellState(matrix[1], "tr-dub"), matrix[1].available["tr-dub"]], ["unverified", 0]);

const diffMatrix = seasonLanguageMatrix([
  mEp(1, 1, true, [["SUBTITLE", "ru"], ["SUBTITLE", "en"]]),
  mEp(2, 1, true, [["SUBTITLE", "en"]]),
  mEp(3, 1, false, []),
]);
eq("detal: sezon fərqi — yalnız dəyişən dil, yoxlanmamış sezon fərq sayılmır",
  seasonDifferences(diffMatrix).map((d) => `${d.key}:${d.perSeason.map((p) => p.state).join("/")}`),
  ["ru-sub:full/none/unverified"]);
eq("detal: tək sezonda fərq yoxdur", seasonDifferences(diffMatrix.slice(0, 1)), []);

eq("film: növbədə hamısından öndə (FEATURE), bağlı serialdan da",
  [decideQueueAction(null, { editId: "e", globalHash: "h" }, { now: new Date(), revalidateAfterDays: 30, titleLinked: true, titleIsNew: true, isFeature: true }), PRIORITY.FEATURE < PRIORITY.LINKED].map((x) => (typeof x === "object" && "priority" in x ? x.priority : x)),
  [PRIORITY.FEATURE, true]);

// Film: əsas video (MOVIE) seçilir, treyler/preview atılır, il videonun airDate-indən.
const movieDoc = {
  data: { id: "m1", type: "show", attributes: { name: "Goodfellas", showType: "MOVIE", firstAvailableDate: "2026-05-19T19:00:00Z" }, relationships: {} },
  included: [
    { id: "v1", type: "video", attributes: { name: "Goodfellas", videoType: "MOVIE", airDate: "1990-09-19T00:01:00Z" }, relationships: { show: { data: { id: "m1", type: "show" } }, edit: { data: { id: "e1", type: "edit" } } } },
    { id: "t1", type: "video", attributes: { videoType: "TRAILER" }, relationships: { show: { data: { id: "m1", type: "show" } }, edit: { data: { id: "e2", type: "edit" } } } },
    { id: "e1", type: "edit", attributes: { audioTracks: ["English - Original", "Russian"], subtitles: ["Turkish", "English"], duration: 8700000 } },
    { id: "e2", type: "edit", attributes: { audioTracks: ["English - Original"], subtitles: [], duration: 120000 } },
  ],
};
const movie = extractSeriesFromJson([movieDoc], "https://play.hbomax.com/show/m1");
eq("film: kind MOVIE, 1×1, əsas video, il airDate-dən",
  [movie.kind, movie.seasons.length, movie.seasons[0]?.episodes.map((e) => `${e.providerId}:${e.seasonNumber}x${e.episodeNumber}:${e.metadataEditId}`), movie.year, movie.seasonInfo[0]?.expectedEpisodes],
  ["MOVIE", 1, ["v1:1x1:e1"], 1990, 1]);
eq("film: URL /movie/, /standalone/ tanınır", [idsFromUrl("https://play.hbomax.com/movie/m1").showId, idsFromUrl("https://play.hbomax.com/standalone/s1").showId, titlePageUrl("m1", "MOVIE", "https://play.hbomax.com")], ["m1", "s1", "https://play.hbomax.com/movie/m1"]);

console.log(failed === 0 ? "\n✅ bütün hbomax növbə/aqreqasiya testləri keçdi\n" : `\n❌ ${failed} test sındı\n`);
process.exit(failed === 0 ? 0 : 1);
