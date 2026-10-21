/**
 * Tutulmuş metadata JSON-larından serial/sezon/epizod çıxarışı — SAF.
 *
 * HBO Max CMS-i (`/cms/routes/...`, `/cms/collections/...`) JSON:API formasındadır:
 * `{ data, included: [{ id, type, attributes, relationships }] }`. Bütün sənədlərdəki
 * entity-lər bir mağazada (`type:id`) birləşdirilir, sonra əlaqələr izlənir.
 *
 * Struktur Phase 1-də real cavablarla təsdiqlənməlidir — ona görə hər addım
 * defensivdir: sahə yoxdursa boş qalır, uydurulmur. JSON:API olmayan cavablar
 * üçün `seasonNumber`+`episodeNumber` daşıyan obyektləri tapan ümumi fallback var.
 */
import type { Episode, LanguageTrack, Season } from "@/lib/scrapers/hbomaxCollector/models";
import {
  classifyAudioTracks,
  classifySubtitleTracks,
  parseLanguageCode,
  type RawTrack,
} from "@/lib/scrapers/hbomaxCollector/utils/language";

type Obj = Record<string, unknown>;

export interface Entity {
  id: string;
  type: string;
  attributes: Obj;
  relationships: Obj;
}

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

// ── Entity mağazası ─────────────────────────────────────────────────────────
export function collectEntities(docs: unknown[]): Map<string, Entity> {
  const store = new Map<string, Entity>();
  let budget = 500_000;
  const stack: unknown[] = [...docs];
  while (stack.length && budget-- > 0) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
      continue;
    }
    if (!isObj(cur)) continue;
    const id = str(cur.id);
    const type = str(cur.type);
    if (id && type && (isObj(cur.attributes) || isObj(cur.relationships))) {
      const key = `${type}:${id}`;
      const prev = store.get(key);
      store.set(key, {
        id,
        type,
        attributes: { ...(prev?.attributes ?? {}), ...(isObj(cur.attributes) ? cur.attributes : {}) },
        relationships: { ...(prev?.relationships ?? {}), ...(isObj(cur.relationships) ? cur.relationships : {}) },
      });
    }
    for (const v of Object.values(cur)) if (v && typeof v === "object") stack.push(v);
  }
  return store;
}

export function relRefs(e: Entity, name: RegExp): Array<{ id: string; type: string }> {
  const out: Array<{ id: string; type: string }> = [];
  for (const [k, v] of Object.entries(e.relationships)) {
    if (!name.test(k) || !isObj(v)) continue;
    const data = v.data;
    for (const d of Array.isArray(data) ? data : [data]) {
      if (isObj(d) && str(d.id) && str(d.type)) out.push({ id: d.id as string, type: d.type as string });
    }
  }
  return out;
}

function resolve(store: Map<string, Entity>, refs: Array<{ id: string; type: string }>): Entity[] {
  return refs.map((r) => store.get(`${r.type}:${r.id}`)).filter((e): e is Entity => !!e);
}

// ── URL-dən ID-lər ──────────────────────────────────────────────────────────
export interface UrlIds {
  showId?: string;
  videoId?: string;
  editId?: string;
}

/** `/show/<id>`, `/movie/<id>`, `/standalone/<id>`, `/series/<slug>/<id>`, `/video/watch/<videoId>/<editId>`, `/episode/<id>`. */
export function idsFromUrl(raw: string): UrlIds {
  let p: string;
  try {
    p = new URL(raw).pathname;
  } catch {
    return {};
  }
  const parts = p.split("/").filter(Boolean);
  const out: UrlIds = {};
  const i = (name: string) => parts.findIndex((x) => x.toLowerCase() === name);
  const titleSeg = ["show", "movie", "standalone"].map(i).find((x) => x >= 0 && parts[x + 1]);
  if (titleSeg !== undefined) out.showId = parts[titleSeg + 1];
  else if (i("series") >= 0 && parts[i("series") + 1]) out.showId = parts[parts.length - 1];
  const watch = i("watch");
  if (watch >= 0 && parts[watch + 1]) {
    out.videoId = parts[watch + 1];
    if (parts[watch + 2]) out.editId = parts[watch + 2];
  }
  const ep = i("episode");
  if (ep >= 0 && parts[ep + 1]) out.videoId = parts[ep + 1];
  return out;
}

// ── Şəkillər ────────────────────────────────────────────────────────────────
interface ImageInfo {
  kind: string;
  src: string;
  width?: number;
  height?: number;
}

function imagesOf(store: Map<string, Entity>, e: Entity): ImageInfo[] {
  const out: ImageInfo[] = [];
  for (const img of resolve(store, relRefs(e, /^images?$/i))) {
    const src = str(img.attributes.src) ?? str(img.attributes.url);
    if (src) out.push({ kind: str(img.attributes.kind) ?? "", src, width: num(img.attributes.width), height: num(img.attributes.height) });
  }
  // Bəzi cavablarda şəkillər birbaşa atributdadır.
  const inline = e.attributes.images;
  if (Array.isArray(inline)) {
    for (const img of inline) {
      if (!isObj(img)) continue;
      const src = str(img.src) ?? str(img.url);
      if (src) out.push({ kind: str(img.kind) ?? str(img.type) ?? "", src, width: num(img.width), height: num(img.height) });
    }
  }
  return out;
}

// "poster-with-logo" posterdir — yalnız loqonun ÖZÜ (kind loqo ilə başlayır) atılır.
const LOGO_KIND = /^(logo|title-?treatment|wordmark|badge)/i;

export function pickPoster(images: ImageInfo[]): string | undefined {
  const usable = images.filter((i) => !LOGO_KIND.test(i.kind));
  return (
    usable.find((i) => /poster/i.test(i.kind))?.src ??
    usable.find((i) => i.width && i.height && i.width / i.height < 0.85)?.src
  );
}

export function pickBackdrop(images: ImageInfo[]): string | undefined {
  const usable = images.filter((i) => !LOGO_KIND.test(i.kind));
  return (
    usable.find((i) => /backdrop|background|hero|default-wide|wide|cover-artwork-horizontal|key-?art/i.test(i.kind))?.src ??
    usable.find((i) => i.width && i.height && i.width / i.height > 1.5)?.src ??
    usable.find((i) => /^default$|cover/i.test(i.kind))?.src
  );
}

// ── Dil treklər (JSON-da varsa) ─────────────────────────────────────────────
const AUDIO_KEY = /^(audio|audioTracks?|audioLanguages?|audioStreams?|dubbedLanguages?|spokenLanguages?)$/i;
const SUBTITLE_KEY = /^(subtitles?|subtitleTracks?|subtitleLanguages?|textTracks?|captions?|closedCaptions?|timedText)$/i;

function toRawTracks(value: unknown): RawTrack[] {
  if (!Array.isArray(value)) return [];
  const out: RawTrack[] = [];
  for (const v of value) {
    if (typeof v === "string") {
      out.push(parseLanguageCode(v) ? { label: v, code: v } : { label: v });
      continue;
    }
    if (!isObj(v)) continue;
    const code = str(v.language) ?? str(v.languageCode) ?? str(v.languageTag) ?? str(v.lang) ?? str(v.code) ?? str(v.locale);
    let label = str(v.displayName) ?? str(v.label) ?? str(v.name) ?? str(v.title) ?? code;
    if (!label) continue;
    // Struktur bayraqlar etiketə əlavə olunur — növ qərarı tək yerdə (language.ts) verilsin.
    const kind = `${str(v.kind) ?? ""} ${str(v.role) ?? ""} ${str(v.type) ?? ""}`;
    // "main"/"primary" orijinal demək DEYİL (default trek ola bilər) — yalnız açıq "original".
    if (v.isOriginal === true || v.original === true || /original/i.test(kind)) label += " (Original)";
    if (/descri/i.test(kind) || v.audioDescription === true) label += " - Audio Description";
    if (/sdh|caption|\bcc\b/i.test(kind) || v.closedCaptions === true || v.sdh === true) label += " CC";
    if (v.forced === true || /forced/i.test(kind)) label += " (Forced)";
    out.push(code && parseLanguageCode(code) ? { label, code } : { label });
  }
  return out;
}

export interface JsonTracks {
  audio: LanguageTrack[];
  subtitles: LanguageTrack[];
}

/** Entity atributlarında (və ona bağlı edit/variant entity-lərdə) trek axtarır. */
export function tracksFromEntities(entities: Entity[], originalLanguage?: string): JsonTracks | null {
  const audio: RawTrack[] = [];
  const subs: RawTrack[] = [];
  for (const e of entities) {
    for (const [k, v] of Object.entries(e.attributes)) {
      if (AUDIO_KEY.test(k)) audio.push(...toRawTracks(v));
      else if (SUBTITLE_KEY.test(k)) subs.push(...toRawTracks(v));
    }
  }
  if (!audio.length && !subs.length) return null;
  return {
    audio: classifyAudioTracks(audio, { originalLanguage }),
    subtitles: classifySubtitleTracks(subs),
  };
}

// ── Serial ──────────────────────────────────────────────────────────────────
//
// SAHİBLİK YALNIZ ƏLAQƏLƏRLƏ təyin olunur (real AZ cavabı, 2026-10):
//
//   show(<id>).relationships.seasons.data[]      → season entity-ləri (bu şounun)
//   video.relationships.show.data.id             → epizodun şousu
//   video.relationships.season.data.id           → epizodun sezonu
//   video.relationships.edit.data.id             → edit (treklər buradadır)
//   season.attributes.seasonNumber / videoCountByType.EPISODE
//
// ⚠️ `season` entity-lərində show əlaqəsi YOXDUR — eyni səhifədə başqa şouların
// (tövsiyə rail-ləri) sezonları da gəlir. Tip üzrə skan etmək olmaz: köhnə parser
// 34 yad sezonu (məs. Game of Thrones 1–8) bu şouya yazırdı.
const SHOW_TYPE = /^(show|series)$/i;
const VIDEO_TYPE = /^(video|episode)$/i;

function isEpisode(e: Entity): boolean {
  if (!VIDEO_TYPE.test(e.type)) return false;
  const vt = str(e.attributes.videoType);
  if (vt) return /^episode$/i.test(vt);
  return num(e.attributes.seasonNumber) !== undefined && num(e.attributes.episodeNumber) !== undefined;
}

function showIdOf(e: Entity): string | undefined {
  return relRefs(e, /^show$/i)[0]?.id;
}

function seasonIdOf(e: Entity): string | undefined {
  return relRefs(e, /^season$/i)[0]?.id;
}

function yearFrom(attrs: Obj): number | undefined {
  const y = num(attrs.year) ?? num(attrs.releaseYear);
  if (y && y > 1900) return y;
  for (const k of ["premiereDate", "firstAirDate", "releaseDate", "airDate", "originalReleaseDate"]) {
    const d = str(attrs[k]);
    if (d && /^\d{4}/.test(d)) return Number(d.slice(0, 4));
  }
  return undefined;
}

/** Yalnız redaksiya janrları (`txGenres`). `txCorporate-genre` ayrı taksonomiyadır. */
function genresOf(store: Map<string, Entity>, e: Entity): string[] {
  const names = new Set<string>();
  for (const g of resolve(store, relRefs(e, /^txGenres$/i))) {
    const n = str(g.attributes.name);
    if (n) names.add(n);
  }
  return [...names];
}

/** Entity-lərin route-larından ilk `/video/watch/…` yolu. */
function watchUrlOf(store: Map<string, Entity>, entities: Entity[], origin: string): string | undefined {
  for (const ent of entities) {
    for (const route of resolve(store, relRefs(ent, /^routes?$/i))) {
      const u = str(route.attributes.url);
      if (u && /^\/video\/watch\//.test(u)) return new URL(u, origin).toString();
    }
  }
  return undefined;
}

function editOf(store: Map<string, Entity>, e: Entity): Entity | undefined {
  return resolve(store, relRefs(e, /^edit$/i))[0];
}

function episodeFromEntity(store: Map<string, Entity>, e: Entity, origin: string, originalLanguage?: string): Episode {
  const edit = editOf(store, e);
  const ep: Episode = {
    providerId: e.id,
    title: str(e.attributes.name),
    description: str(e.attributes.description) ?? str(e.attributes.longDescription),
    seasonNumber: num(e.attributes.seasonNumber) ?? 0,
    episodeNumber: num(e.attributes.episodeNumber) ?? 0,
    // ⚠️ Videonun `routes`-unda redaksiya səhifələri də ola bilər (`/editorial/prequels`) —
    // yalnız player yolu qəbul olunur, yoxsa URL video ID-dən qurulur.
    providerUrl: watchUrlOf(store, edit ? [e, edit] : [e], origin) ?? new URL(`/video/watch/${e.id}`, origin).toString(),
    metadataEditId: edit?.id,
    audioTracks: [],
    subtitleTracks: [],
  };
  const tracks = tracksFromEntities(edit ? [e, edit] : [e], originalLanguage);
  if (tracks) {
    ep.audioTracks = tracks.audio;
    ep.subtitleTracks = tracks.subtitles;
    ep.tracksSource = "json";
    ep.tracksScope = "global-assets";
  }
  return ep;
}

export interface SeasonInfo {
  providerId: string;
  seasonNumber: number;
  /** `videoCountByType.EPISODE` — tamlıq yoxlaması üçün. */
  expectedEpisodes?: number;
}

/** Səhifədəki epizod kolleksiyasının sezon süzgəci (UI dropdown-u bunu göstərir). */
export interface SeasonFilter {
  collectionId: string;
  seasonNumbers: number[];
  initiallySelected?: number;
}

/** Seriallar (sezon/epizod) — qalan tiplər (MOVIE, STANDALONE) tək videoludur. */
export const SERIES_SHOW_TYPES: ReadonlySet<string> = new Set(["SERIES", "MINISERIES", "TOPICAL"]);
export const FEATURE_SHOW_TYPES: ReadonlySet<string> = new Set(["MOVIE", "STANDALONE"]);

export type TitleKind = "SERIES" | "MOVIE";
export const titleKindOf = (showType: string | undefined): TitleKind => (showType && FEATURE_SHOW_TYPES.has(showType) ? "MOVIE" : "SERIES");

/** Başlığın HBO səhifəsi: /show/<id>, /movie/<id>, /standalone/<id>. */
export function titlePageUrl(showId: string, showType: string | undefined, origin: string): string {
  const seg = showType === "MOVIE" ? "movie" : showType === "STANDALONE" ? "standalone" : "show";
  return new URL(`/${seg}/${showId}`, origin).toString();
}

/** Filmin "sezonu" — DB-də film 1 sezon × 1 epizod kimi saxlanılır (növbə/validasiya eynidir). */
export const FEATURE_SEASON_NUMBER = 1;
export const featureSeasonId = (showId: string) => `${showId}:feature`;

export interface JsonSeriesResult {
  providerId?: string;
  /** `show.attributes.showType` (SERIES, MINISERIES, MOVIE, STANDALONE …) */
  showType?: string;
  kind: TitleKind;
  title?: string;
  originalTitle?: string;
  description?: string;
  year?: number;
  genres: string[];
  posterUrl?: string;
  backdropUrl?: string;
  originalLanguage?: string;
  seasons: Season[];
  seasonInfo: SeasonInfo[];
  seasonFilter?: SeasonFilter;
  /** Əlaqə ilə uyğun gəlməyən, atılmış epizodlar (diaqnostika). */
  rejectedEpisodes: number;
  warnings: string[];
  /** Diaqnostika: mağazadakı entity tipləri və sayları. */
  entityTypes: Record<string, number>;
}

/**
 * Şounun epizod kolleksiyası: `component.id = "tabbed-content"`,
 * `mandatoryParams = "pf[show.id]=<showId>"`, `filters[id=seasonNumber].options[].value`.
 *
 * ⚠️ "Extras" rail-i (`generic-show-page-rail-extras`) EYNİ forma daşıyır, amma yalnız
 * əlavə videosu olan sezonları sadalayır — ona görə alias-da "episodes" tələb olunur.
 */
export function findSeasonFilter(store: Map<string, Entity>, showId: string): SeasonFilter | undefined {
  for (const c of store.values()) {
    if (c.type !== "collection") continue;
    const alias = `${str(c.attributes.alias) ?? ""} ${str(c.attributes.name) ?? ""}`;
    if (!/episodes/i.test(alias) || /extras/i.test(alias)) continue;
    const comp = c.attributes.component;
    if (!isObj(comp) || str(comp.mandatoryParams) !== `pf[show.id]=${showId}` || !Array.isArray(comp.filters)) continue;
    const f = comp.filters.find((x): x is Obj => isObj(x) && x.id === "seasonNumber");
    if (!f || !Array.isArray(f.options)) continue;
    const seasonNumbers = f.options
      .map((o) => (isObj(o) ? num(o.value) : undefined))
      .filter((n): n is number => n !== undefined);
    const init = Array.isArray(f.initiallySelectedOptionIds) ? num(f.initiallySelectedOptionIds[0]) : undefined;
    return { collectionId: c.id, seasonNumbers, initiallySelected: init };
  }
  return undefined;
}

export function extractSeriesFromJson(docs: unknown[], seriesUrl: string): JsonSeriesResult {
  const store = collectEntities(docs);
  const entityTypes: Record<string, number> = {};
  for (const e of store.values()) entityTypes[e.type] = (entityTypes[e.type] ?? 0) + 1;
  const warnings: string[] = [];

  const origin = new URL(seriesUrl).origin;
  const { showId } = idsFromUrl(seriesUrl);
  const show = showId ? [...store.values()].find((e) => SHOW_TYPE.test(e.type) && e.id === showId) : undefined;
  if (!show) {
    // Başqa şounu "ən yaxın" kimi götürmürük — bu, yanlış serialı yazmaq olardı.
    warnings.push(`Requested show ${showId ?? "(no id in URL)"} not present in captured JSON`);
    return { providerId: showId, kind: "SERIES", genres: [], seasons: [], seasonInfo: [], rejectedEpisodes: 0, warnings, entityTypes };
  }

  const showType = str(show.attributes.showType);
  if (showType && FEATURE_SHOW_TYPES.has(showType)) return extractFeature(store, show, showType, origin, warnings, entityTypes);

  const originalLanguage = parseLanguageCode(str(show.attributes.originalLanguage) ?? "")?.code;

  // 1) show → seasons
  const seasonInfo: SeasonInfo[] = [];
  for (const se of resolve(store, relRefs(show, /^seasons$/i))) {
    const n = num(se.attributes.seasonNumber);
    if (n === undefined) {
      warnings.push(`Season ${se.id} has no seasonNumber`);
      continue;
    }
    const counts = se.attributes.videoCountByType;
    seasonInfo.push({ providerId: se.id, seasonNumber: n, expectedEpisodes: isObj(counts) ? num(counts.EPISODE) : undefined });
  }
  seasonInfo.sort((a, b) => a.seasonNumber - b.seasonNumber);
  const missingRefs = relRefs(show, /^seasons$/i).length - seasonInfo.length;
  if (missingRefs > 0) warnings.push(`${missingRefs} season reference(s) not included in the payload`);

  // 2) season → episodes (video.show == show.id VƏ video.season ∈ bu şounun sezonları)
  const bySeasonId = new Map(seasonInfo.map((si) => [si.providerId, si]));
  const seasons: Season[] = seasonInfo.map((si) => ({ seasonNumber: si.seasonNumber, providerId: si.providerId, episodes: [] }));
  const seasonByNumber = new Map(seasons.map((se) => [se.seasonNumber, se]));
  let rejectedEpisodes = 0;
  for (const v of store.values()) {
    if (!isEpisode(v)) continue;
    const si = bySeasonId.get(seasonIdOf(v) ?? "");
    if (showIdOf(v) !== show.id || !si) {
      rejectedEpisodes++;
      continue;
    }
    const ep = episodeFromEntity(store, v, origin, originalLanguage);
    if (ep.seasonNumber !== si.seasonNumber) {
      warnings.push(`Episode ${v.id}: seasonNumber attribute ${ep.seasonNumber} ≠ related season ${si.seasonNumber} — using relationship`);
      ep.seasonNumber = si.seasonNumber;
    }
    const season = seasonByNumber.get(si.seasonNumber)!;
    if (!season.episodes.some((x) => x.providerId === ep.providerId)) season.episodes.push(ep);
  }
  for (const se of seasons) se.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

  const seasonFilter = findSeasonFilter(store, show.id);
  if (seasonFilter) {
    const fromRel = seasonInfo.map((x) => x.seasonNumber).join(",");
    const fromFilter = [...seasonFilter.seasonNumbers].sort((a, b) => a - b).join(",");
    if (fromRel !== fromFilter) warnings.push(`show.seasons [${fromRel}] ≠ season filter options [${fromFilter}]`);
  }

  const images = imagesOf(store, show);
  return {
    providerId: show.id,
    showType,
    kind: "SERIES",
    title: str(show.attributes.name),
    originalTitle: str(show.attributes.originalName),
    description: str(show.attributes.longDescription) ?? str(show.attributes.description),
    year: yearFrom(show.attributes),
    genres: genresOf(store, show),
    posterUrl: pickPoster(images),
    backdropUrl: pickBackdrop(images),
    originalLanguage,
    seasons,
    seasonInfo,
    seasonFilter,
    rejectedEpisodes,
    warnings,
    entityTypes,
  };
}

const FEATURE_VIDEO_TYPE = /^(movie|standalone)$/i;

/**
 * Film / standalone: əsas video = `video.show == show.id` VƏ `videoType` MOVIE|STANDALONE
 * (treyler, SHORT_PREVIEW, extras atılır). Bir neçə versiya varsa (məs. rejissor versiyası)
 * `videoType`-ı şou tipi ilə eyni olan, sonra ən uzun `edit.duration` seçilir.
 */
function extractFeature(store: Map<string, Entity>, show: Entity, showType: string, origin: string, warnings: string[], entityTypes: Record<string, number>): JsonSeriesResult {
  const originalLanguage = parseLanguageCode(str(show.attributes.originalLanguage) ?? "")?.code;
  const candidates = [...store.values()].filter(
    (v) => VIDEO_TYPE.test(v.type) && showIdOf(v) === show.id && FEATURE_VIDEO_TYPE.test(str(v.attributes.videoType) ?? "")
  );
  const duration = (v: Entity) => num(editOf(store, v)?.attributes.duration) ?? 0;
  candidates.sort(
    (a, b) =>
      Number(str(b.attributes.videoType)?.toUpperCase() === showType) - Number(str(a.attributes.videoType)?.toUpperCase() === showType) ||
      duration(b) - duration(a) ||
      a.id.localeCompare(b.id)
  );
  if (candidates.length > 1) warnings.push(`${candidates.length} feature videos — using ${candidates[0].id}`);
  const main = candidates[0];
  const seasonId = featureSeasonId(show.id);
  const episodes = main
    ? [{ ...episodeFromEntity(store, main, origin, originalLanguage), seasonNumber: FEATURE_SEASON_NUMBER, episodeNumber: 1 }]
    : [];
  if (!main) warnings.push(`No ${showType} video for ${show.id}`);
  const images = imagesOf(store, show);
  return {
    providerId: show.id,
    showType,
    kind: "MOVIE",
    title: str(show.attributes.name),
    originalTitle: str(show.attributes.originalName),
    description: str(show.attributes.longDescription) ?? str(show.attributes.description),
    // Şounun tarixləri HBO-ya gəliş tarixidir (firstAvailableDate) — buraxılış ili videonun airDate-indədir.
    year: yearFrom(show.attributes) ?? (main ? yearFrom(main.attributes) : undefined),
    genres: genresOf(store, show),
    posterUrl: pickPoster(images),
    backdropUrl: pickBackdrop(images),
    originalLanguage,
    seasons: [{ seasonNumber: FEATURE_SEASON_NUMBER, providerId: seasonId, episodes }],
    seasonInfo: [{ providerId: seasonId, seasonNumber: FEATURE_SEASON_NUMBER, expectedEpisodes: 1 }],
    rejectedEpisodes: 0,
    warnings,
    entityTypes,
  };
}

export interface JsonEpisodeResult {
  episode?: Episode;
  showId?: string;
  seasonId?: string;
  editId?: string;
  originalLanguage?: string;
}

/** Epizod: URL-dəki videoId ilə `video` entity-si → `relationships.edit` → treklər. */
export function extractEpisodeFromJson(docs: unknown[], episodeUrl: string): JsonEpisodeResult {
  const store = collectEntities(docs);
  const { videoId } = idsFromUrl(episodeUrl);
  if (!videoId) return {};
  const target = [...store.values()].find((e) => VIDEO_TYPE.test(e.type) && e.id === videoId);
  if (!target) return {};
  const showId = showIdOf(target);
  const show = showId ? [...store.values()].find((e) => SHOW_TYPE.test(e.type) && e.id === showId) : undefined;
  const originalLanguage = show ? parseLanguageCode(str(show.attributes.originalLanguage) ?? "")?.code : undefined;
  const episode = episodeFromEntity(store, target, new URL(episodeUrl).origin, originalLanguage);
  episode.providerUrl = episodeUrl;
  return { episode, showId, seasonId: seasonIdOf(target), editId: editOf(store, target)?.id, originalLanguage };
}
