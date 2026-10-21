/**
 * HBO Max kollektorunun DB qatı üçün inteqrasiya testi — `npm run test:hbomax-db`.
 *
 * ⚠️ YALNIZ lokal test bazasında işləyir: DATABASE_URL localhost/127.0.0.1 deyilsə
 * dərhal dayanır (Supabase/prod-a heç vaxt yazmasın). Provider* / Episode* cədvəllərini
 * TƏMİZLƏYİR. Nümunə:
 *   docker run -d --name honsell-hbomax-testdb -e POSTGRES_PASSWORD=test -e POSTGRES_DB=hbomax_test \
 *     -p 127.0.0.1:55432:5432 pgvector/pgvector:pg16
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/hbomax_test npm run test:hbomax-db
 */
import "./hbomaxDbTestGuard"; // ⚠️ İLK import qalmalıdır — lokal olmayan DB-də dayandırır
import { prisma } from "../lib/prisma";
import { recomputeTitleLanguages } from "../lib/scrapers/hbomaxCollector/db/aggregateStore";
import { applyMissingSyncs, markShowsSeen, persistShow } from "../lib/scrapers/hbomaxCollector/db/catalogStore";
import { attemptsInLast24h, claimNext, completeFailure, completeSuccess, recoverAbandoned, release } from "../lib/scrapers/hbomaxCollector/db/queueStore";
import { extractSeriesFromJson } from "../lib/scrapers/hbomaxCollector/parsers/jsonMetadata";
import { classifyAudioTracks, classifySubtitleTracks } from "../lib/scrapers/hbomaxCollector/utils/language";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.log(`  FAIL ${name}${detail ? `\n         ${detail}` : ""}`);
  }
}
function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `gözlənilən ${e}\n         alınan     ${a}`);
}

const SHOW = "show-1";
const URL_ = `https://play.hbomax.com/show/${SHOW}`;
const REGION = "AZ";

/** Real CMS strukturunu təqlid edən JSON:API fixture (show → seasons, video → show/season/edit). */
function fixture(edits: Record<string, string> = {}) {
  const ep = (id: string, season: string, s: number, e: number, audio: string[], subs: string[]) => [
    { id, type: "video", attributes: { name: `Ep ${s}.${e}`, videoType: "EPISODE", seasonNumber: s, episodeNumber: e },
      relationships: { show: { data: { id: SHOW, type: "show" } }, season: { data: { id: season, type: "season" } }, edit: { data: { id: edits[id] ?? `edit-${id}`, type: "edit" } } } },
    { id: edits[id] ?? `edit-${id}`, type: "edit", attributes: { audioTracks: audio, subtitles: subs } },
  ];
  const audio = ["English - Original", "Russian", "Turkish", "German"];
  const subs = ["English", "Turkish", "German - CC"];
  return {
    data: { id: "r", type: "route", attributes: { url: `/show/${SHOW}` } },
    included: [
      { id: SHOW, type: "show", attributes: { name: "Test Show", premiereDate: "2024-01-01T00:00:00Z" }, relationships: { seasons: { data: [{ id: "s1", type: "season" }, { id: "s2", type: "season" }] } } },
      { id: "s1", type: "season", attributes: { seasonNumber: 1, videoCountByType: { EPISODE: 2 } } },
      { id: "s2", type: "season", attributes: { seasonNumber: 2, videoCountByType: { EPISODE: 1 } } },
      // Başqa şounun sezonu (əlaqəsiz) — sayılmamalıdır.
      { id: "foreign", type: "season", attributes: { seasonNumber: 7, videoCountByType: { EPISODE: 10 } } },
      ...ep("v1", "s1", 1, 1, audio, subs),
      ...ep("v2", "s1", 1, 2, audio, subs),
      ...ep("v3", "s2", 2, 1, audio, subs),
    ],
  };
}

const tracks = (audio: string[], subs: string[]) => ({
  audio: classifyAudioTracks(audio.map((label) => ({ label }))),
  subs: classifySubtitleTracks(subs.map((label) => ({ label }))),
});

async function persist(now: Date, edits?: Record<string, string>, titleIsNew = false) {
  return persistShow({ region: REGION, show: extractSeriesFromJson([fixture(edits)], URL_), providerUrl: URL_, complete: true, titleIsNew, now, revalidateAfterDays: 30 });
}

async function main() {
  await prisma.providerTitle.deleteMany({ where: { platform: "HBOMAX" } });
  const t0 = new Date("2026-10-01T10:00:00Z");

  // ── Stage 1 ──
  const created = await markShowsSeen(REGION, [{ providerId: SHOW, name: "Test Show", providerUrl: URL_ }], t0);
  eq("yeni şou markShowsSeen-də yaranır", [...created], [SHOW]);
  const r1 = await persist(t0, undefined, true);
  eq("3 epizod, 3 PENDING (yad sezon sayılmır)", [r1.episodesCreated, r1.queueCreated], [3, 3]);
  const states = await prisma.episodeRegionState.findMany({ select: { status: true, priority: true } });
  eq("ilk kəşf → P4", [...new Set(states.map((s) => `${s.status}/P${s.priority}`))], ["PENDING/P4"]);
  eq("sezonlar yalnız əlaqədən", (await prisma.providerSeason.findMany({ orderBy: { seasonNumber: "asc" } })).map((s) => s.seasonNumber), [1, 2]);
  eq("GLOBAL treklər yazılıb (3 ep × 7)", await prisma.episodeTrack.count({ where: { scope: "GLOBAL" } }), 21);

  // ── Stage 2: claim + success/failure ──
  const t1 = new Date("2026-10-01T11:00:00Z");
  const j1 = await claimNext(REGION, t1);
  check("iş götürüldü", !!j1);
  eq("götürülən VALIDATING olur", (await prisma.episodeRegionState.findUnique({ where: { id: j1!.stateId } }))?.status, "VALIDATING");
  const az = tracks(["English - Original", "Russian"], ["English", "Turkish"]);
  await completeSuccess(j1!, REGION, az.audio, az.subs, { audioOptions: 2, subtitleOptions: 2, ungroupedOptions: 0, durationMs: 1 }, t1);
  const s1 = await prisma.episodeRegionState.findUnique({ where: { id: j1!.stateId } });
  eq("VERIFIED + barmaq izi yazılıb", [s1?.status, s1?.validatedEditId, !!s1?.verifiedAt], ["VERIFIED", `edit-v1`, true]);
  eq("REGION trekləri ayrıca (region=AZ)", await prisma.episodeTrack.count({ where: { scope: "REGION", region: "AZ" } }), 4);

  const j2 = await claimNext(REGION, t1);
  const next = await completeFailure(j2!, "PLAYER_ERROR: x", t1, 3, 3_600_000);
  eq("uğursuz → FAILED, backoff 1 saat", [(await prisma.episodeRegionState.findUnique({ where: { id: j2!.stateId } }))?.status, next?.toISOString()], ["FAILED", "2026-10-01T12:00:00.000Z"]);

  const j3 = await claimNext(REGION, t1);
  await release(j3!);
  const s3 = await prisma.episodeRegionState.findUnique({ where: { id: j3!.stateId } });
  eq("ölümcül dayanma: iş əvvəlki statusa, cəhd sayılmır", [s3?.status, s3?.attempts], ["PENDING", 0]);
  eq("FAILED backoff bitməyib → növbədə yox, PENDING götürülür", (await claimNext(REGION, t1))?.stateId, j3!.stateId);
  await release({ ...j3!, previousStatus: "PENDING" });
  eq("24 saatda cəhd sayı (uğurlu + uğursuz)", await attemptsInLast24h(REGION, t1), 2);

  // ── Aqreqasiya ──
  await recomputeTitleLanguages(r1.titleId, REGION);
  const langs1 = await prisma.providerTitleLanguage.findMany({ where: { titleId: r1.titleId, kind: "AUDIO", code: "ru" } });
  eq("1/3 təsdiqli → UNVERIFIED (qlobal 'var' sayılmır)", langs1.map((l) => [l.status, l.episodesAvailable, l.episodesVerified, l.episodesTotal]), [["UNVERIFIED", 1, 1, 3]]);

  const t2 = new Date("2026-10-01T13:00:00Z");
  for (const regionAudio of [["English - Original", "Russian", "Turkish"], ["English - Original", "Russian"]]) {
    const j = await claimNext(REGION, t2);
    const tr = tracks(regionAudio, ["English"]);
    await completeSuccess(j!, REGION, tr.audio, tr.subs, { audioOptions: regionAudio.length, subtitleOptions: 1, ungroupedOptions: 0, durationMs: 1 }, t2);
  }
  await recomputeTitleLanguages(r1.titleId, REGION);
  const byCode = Object.fromEntries(
    (await prisma.providerTitleLanguage.findMany({ where: { titleId: r1.titleId, kind: "AUDIO" } })).map((l) => [l.code, `${l.status} ${l.episodesAvailable}/${l.episodesTotal}`])
  );
  eq("ru FULL, tr PARTIAL, de NONE", [byCode.ru, byCode.tr, byCode.de], ["FULL 3/3", "PARTIAL 1/3", "NONE 0/3"]);

  // ── İnkremental ──
  const t3 = new Date("2026-10-02T10:00:00Z");
  const same = await persist(t3);
  eq("dəyişiklik yoxdur → növbəyə heç nə düşmür", [same.queueCreated, same.queueStaled, same.globalTrackSetsReplaced], [0, 0, 0]);
  const regionBefore = await prisma.episodeTrack.count({ where: { scope: "REGION" } });

  const changed = await persist(t3, { v1: "edit-v1-NEW" });
  eq("edit dəyişib → 1 STALE", changed.queueStaled, 1);
  const v1 = await prisma.providerEpisode.findFirstOrThrow({ where: { providerId: "v1" }, select: { regionStates: true } });
  eq("STALE P2", [v1.regionStates[0].status, v1.regionStates[0].priority], ["STALE", 2]);
  eq("metadata sync REGION treklərinə toxunmur", await prisma.episodeTrack.count({ where: { scope: "REGION" } }), regionBefore);
  await recomputeTitleLanguages(r1.titleId, REGION);
  eq(
    "barmaq izi dəyişən epizod təsdiqli sayılmır → UNVERIFIED",
    (await prisma.providerTitleLanguage.findFirstOrThrow({ where: { titleId: r1.titleId, kind: "AUDIO", code: "ru" } })).status,
    "UNVERIFIED"
  );

  const t4 = new Date("2026-11-05T10:00:00Z"); // > 30 gün
  const ttl = await persist(t4, { v1: "edit-v1-NEW" });
  const ttlStates = await prisma.episodeRegionState.findMany({ where: { status: "STALE" }, select: { priority: true } });
  eq("TTL bitən VERIFIED-lər STALE P5 olur", [ttl.queueStaled, ttlStates.map((s) => s.priority).sort()], [2, [2, 5, 5]]);

  // ── Sahibsiz işlərin bərpası ──
  const j = await claimNext(REGION, t4);
  check("STALE iş götürüldü", !!j);
  eq("startup: VALIDATING → PENDING", await recoverAbandoned(REGION), 1);

  // ── Kataloqdan itmə ──
  for (let i = 1; i <= 3; i++) await applyMissingSyncs(REGION, new Set(), new Date(`2026-11-0${5 + i}T00:00:00Z`));
  const gone = await prisma.providerTitleRegion.findFirstOrThrow({ where: { region: REGION } });
  eq("3-cü tam sync-də görünmədi → mövcud deyil, missingSince = sayğacın 3-ə çatdığı an", [gone.consecutiveMissingSyncs, gone.isCurrentlyAvailable, gone.missingSince?.toISOString()], [3, false, "2026-11-08T00:00:00.000Z"]);
  await markShowsSeen(REGION, [{ providerId: SHOW, name: "Test Show", providerUrl: URL_ }], new Date("2026-11-10T00:00:00Z"));
  const back = await prisma.providerTitleRegion.findFirstOrThrow({ where: { region: REGION } });
  eq("yenidən göründü → sayğac 0, mövcud", [back.consecutiveMissingSyncs, back.isCurrentlyAvailable, back.missingSince], [0, true, null]);
  eq("heç nə silinməyib", await prisma.providerEpisode.count(), 3);

  await prisma.providerTitle.deleteMany({ where: { platform: "HBOMAX" } });
}

main()
  .catch((err) => {
    failed++;
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(failed === 0 ? "\n✅ bütün hbomax DB testləri keçdi\n" : `\n❌ ${failed} test sındı\n`);
    process.exit(failed === 0 ? 0 : 1);
  });
