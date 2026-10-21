/**
 * Audio/altyazı etiketlərinin normallaşdırılması — SAF, `npm run test:hbomax-lang`.
 *
 * `lib/scrapers/languageNormalize.ts`-dən fərqi QƏSDƏNDİR: o, vitrin üçün yalnız
 * tr/ru/en saxlayır və qalanını atır. Burada HƏR dil qorunur (ISO 639-1 + göstərilən
 * ad), çünki məqsəd platformanın real dil xəritəsini görməkdir. Vitrinə yazanda
 * köhnə funksiya işlədilə bilər.
 *
 * Qaydalar:
 * - Tanınmayan etiketdə `code` BOŞ qalır — uydurma kod yazılmır.
 * - "original" yalnız etiketdə açıq işarə ("(Original)") və ya etibarlı metadata
 *   (`originalLanguage`) olduqda.
 * - "dub" yalnız etiketdə açıq işarə VƏ YA eyni siyahıda açıq "original" trek
 *   olduqda (platformanın özü orijinalı ayırırsa, qalan dillər alternativ səsdir).
 *   Metadata-dakı orijinal dil tək başına "dub" demək üçün KİFAYƏT DEYİL.
 * - Qalan hər şey "unknown".
 */
import type { LanguageTrack, LanguageTrackType } from "@/lib/scrapers/hbomaxCollector/models";

/** [ISO 639-1, adlar: ingiliscə, öz dilində, türkcə, rusca, azərbaycanca, ISO 639-2]. */
const LANGUAGE_NAMES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["en", ["english", "ingilis", "ingilis dili", "ingilizce", "i̇ngilizce", "английский", "eng"]],
  ["tr", ["turkish", "türkçe", "turkce", "türk", "türk dili", "турецкий", "tur"]],
  ["ru", ["russian", "русский", "rusça", "rusca", "rus", "rus dili"]],
  ["az", ["azerbaijani", "azərbaycan", "azərbaycanca", "azərbaycan dili", "azerbaycan", "azerice", "azerbaycanca", "азербайджанский", "aze"]],
  ["de", ["german", "deutsch", "almanca", "alman", "немецкий", "ger", "deu"]],
  ["fr", ["french", "français", "francais", "fransızca", "fransız", "французский", "fre", "fra"]],
  ["es", ["spanish", "español", "espanol", "castellano", "ispanyolca", "испанский", "spa"]],
  ["it", ["italian", "italiano", "italyanca", "итальянский", "ita"]],
  ["pt", ["portuguese", "português", "portugues", "portekizce", "португальский", "por"]],
  ["pl", ["polish", "polski", "lehçe", "польский", "pol"]],
  ["cs", ["czech", "čeština", "cestina", "çekçe", "чешский", "cze", "ces"]],
  ["sk", ["slovak", "slovenčina", "slovencina", "slovakça", "словацкий", "slo", "slk"]],
  ["hu", ["hungarian", "magyar", "macarca", "венгерский", "hun"]],
  ["ro", ["romanian", "română", "romana", "rumence", "румынский", "rum", "ron"]],
  ["bg", ["bulgarian", "български", "bulgarca", "болгарский", "bul"]],
  ["hr", ["croatian", "hrvatski", "hırvatça", "хорватский", "hrv"]],
  ["sr", ["serbian", "srpski", "српски", "sırpça", "сербский", "srp"]],
  ["sl", ["slovenian", "slovene", "slovenščina", "slovenscina", "slovence", "словенский", "slv"]],
  ["bs", ["bosnian", "bosanski", "boşnakça", "боснийский", "bos"]],
  ["mk", ["macedonian", "македонски", "makedonca", "македонский", "mkd"]],
  ["sq", ["albanian", "shqip", "arnavutça", "албанский", "alb", "sqi"]],
  ["uk", ["ukrainian", "українська", "ukraynaca", "украинский", "ukr"]],
  ["nl", ["dutch", "nederlands", "flemish", "vlaams", "felemenkçe", "hollandaca", "нидерландский", "dut", "nld"]],
  ["sv", ["swedish", "svenska", "isveççe", "шведский", "swe"]],
  ["no", ["norwegian", "norsk", "norsk bokmål", "bokmål", "norveççe", "норвежский", "nor", "nob"]],
  ["da", ["danish", "dansk", "danca", "датский", "dan"]],
  ["fi", ["finnish", "suomi", "fince", "финский", "fin"]],
  ["is", ["icelandic", "íslenska", "izlandaca", "исландский", "ice", "isl"]],
  ["et", ["estonian", "eesti", "estonca", "эстонский", "est"]],
  ["lv", ["latvian", "latviešu", "letonca", "латышский", "lav"]],
  ["lt", ["lithuanian", "lietuvių", "litvanca", "литовский", "lit"]],
  ["el", ["greek", "ελληνικά", "yunanca", "греческий", "gre", "ell"]],
  ["he", ["hebrew", "עברית", "ibranice", "иврит", "heb"]],
  ["ar", ["arabic", "العربية", "arapça", "арабский", "ara"]],
  ["fa", ["persian", "farsi", "فارسی", "farsça", "персидский", "per", "fas"]],
  ["hi", ["hindi", "हिन्दी", "hintçe", "хинди", "hin"]],
  ["ja", ["japanese", "日本語", "japonca", "японский", "jpn"]],
  ["ko", ["korean", "한국어", "korece", "корейский", "kor"]],
  ["zh", ["chinese", "mandarin", "中文", "普通话", "简体中文", "繁體中文", "çince", "китайский", "chi", "zho"]],
  ["th", ["thai", "ไทย", "tayca", "тайский", "tha"]],
  ["id", ["indonesian", "bahasa indonesia", "endonezce", "индонезийский", "ind"]],
  ["ms", ["malay", "bahasa melayu", "malayca", "малайский", "may", "msa"]],
  ["vi", ["vietnamese", "tiếng việt", "vietnamca", "вьетнамский", "vie"]],
  ["ka", ["georgian", "ქართული", "gürcüce", "грузинский", "geo", "kat"]],
  ["kk", ["kazakh", "қазақ", "қазақша", "kazakça", "казахский", "kaz"]],
  ["uz", ["uzbek", "o'zbek", "oʻzbek", "özbekçe", "узбекский", "uzb"]],
  ["hy", ["armenian", "հայերեն", "ermenice", "армянский", "arm", "hye"]],
  ["ca", ["catalan", "català", "katalanca", "каталанский", "cat"]],
  ["tl", ["tagalog", "filipino", "tagalogca", "тагальский", "tgl", "fil"]],
];

const NAME_TO_CODE = new Map<string, string>();
const KNOWN_CODES = new Set<string>();
for (const [code, names] of LANGUAGE_NAMES) {
  KNOWN_CODES.add(code);
  NAME_TO_CODE.set(code, code);
  for (const n of names) NAME_TO_CODE.set(n.normalize("NFC"), code);
}

/** Region/yazı işarələri → locale sonluğu. Yalnız aydın olanlar. */
const REGION_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(us|usa|united states|american|amerikan)$/, "US"],
  [/^(uk|gb|united kingdom|british|i̇ngiltere)$/, "GB"],
  [/^(brasil|brazil|brezilya|brasileiro)$/, "BR"],
  [/^(portugal|europeu)$/, "PT"],
  [/^(latinoamérica|latinoamerica|latin america|latam|latino|latinoamericano|américa latina)$/, "419"],
  [/^(españa|spain|europe|european|castilian|castellano)$/, "ES"],
  [/^(canada|canadien|canadian|québec|quebec)$/, "CA"],
  [/^(france|fransa)$/, "FR"],
  [/^(moldova|moldovan)$/, "MD"],
  [/^(switzerland|swiss|schweiz)$/, "CH"],
  [/^(belgium|belgian|belgique)$/, "BE"],
  [/^(mexico|méxico)$/, "MX"],
  [/^(latin|latinica|latinski)$/, "Latn"],
  [/^(cyrillic|ćirilica|кириллица)$/, "Cyrl"],
  [/^(simplified|简体|basitleştirilmiş)$/, "Hans"],
  [/^(traditional|繁體|geleneksel)$/, "Hant"],
];

// Etiket işarələri — tək yerdə saxlanır ki, platforma yeni ifadə işlətsə buraya əlavə olunsun.
const ORIGINAL_RE = /\b(original|orijinal)\b|оригинал/i;
const AUDIO_DESCRIPTION_RE =
  /audio\s*description|audio[- ]described|described\s*video|\bdescriptive\b|sesli\s*betimleme|sesli\s*anlatım|тифлокомментари|аудиоописани/i;
const AD_TOKEN_RE = /(^|[\s([-])AD($|[\s)\]-])/; // böyük hərflə "AD" — "Ad" sözü ilə qarışmasın
const CLOSED_CAPTION_RE =
  /\bcc\b|closed\s*caption|\bsdh\b|hearing\s*impaired|deaf|işitme\s*engelli|для\s*слабослышащих|для\s*глухих/i;
const FORCED_RE = /\bforced\b|zorunlu|форсированн/i;
const DUB_RE = /\bdub(bed|bing)?\b|dublaj|дубляж|дублированн/i;
const VOICE_OVER_RE = /voice[- ]?over|закадров|многоголос|одноголос|двухголос/i;
/** Bu sözlər dil adından kəsilir (yalnız işarədir, dil deyil). */
const QUALIFIER_WORDS_RE =
  /\b(original|orijinal|dubbed|dubbing|dub|dublaj|forced|zorunlu|sdh|cc|closed\s*captions?|audio\s*description|audio[- ]described|described\s*video|descriptive|voice[- ]?over|subtitles?|captions?|audio|stereo|mono|surround|5\.1|2\.0|dolby|atmos)\b|оригинал|дубляж|субтитры/gi;

/** Altyazı siyahısındakı "söndür" variantları — trek deyil. */
const OFF_OPTION_RE = /^(off|none|no subtitles|kapalı|kapali|yok|выкл\.?|отключены|нет|söndür|yoxdur|bağlı)$/i;

export function isSubtitleOffOption(label: string): boolean {
  return OFF_OPTION_RE.test(label.trim());
}

export interface ParsedLanguage {
  code?: string;
  locale?: string;
}

/** "en", "en-US", "eng", "pt_BR", "es-419" → { code, locale }. Tanınmırsa null. */
export function parseLanguageCode(raw: string): ParsedLanguage | null {
  const m = raw.trim().match(/^([A-Za-z]{2,3})(?:[-_]([A-Za-z0-9]{2,4}))?$/);
  if (!m) return null;
  const base = NAME_TO_CODE.get(m[1].toLowerCase());
  if (!base || !(KNOWN_CODES.has(base))) return null;
  // 3 hərfli kod ad kimi də keçir ("rus") — yalnız cədvəldə olanlar qəbul edilir.
  const sub = m[2];
  if (!sub) return { code: base };
  const region = /^\d+$/.test(sub) ? sub : sub.length === 4 ? sub[0].toUpperCase() + sub.slice(1).toLowerCase() : sub.toUpperCase();
  return { code: base, locale: `${base}-${region}` };
}

function regionFrom(token: string): string | undefined {
  const t = token.trim().toLowerCase();
  for (const [re, region] of REGION_HINTS) if (re.test(t)) return region;
  return undefined;
}

/**
 * Göstərilən addan dili tapır: "English US", "English (Original)", "Português (Brasil)",
 * "Türkçe", "Русский", "Azərbaycan". Kod tanınmırsa `{}`.
 */
export function parseLanguageName(label: string): ParsedLanguage {
  const text = label.normalize("NFC").trim();
  if (!text) return {};

  // Mötərizə içi: ya işarə ("Original", "CC"), ya region ("Brasil").
  let region: string | undefined;
  const outside = text.replace(/[([]([^)\]]*)[)\]]/g, (_, inner: string) => {
    region ??= regionFrom(inner);
    return " ";
  });

  const cleaned = outside
    .replace(QUALIFIER_WORDS_RE, " ")
    .replace(/[-–—:|,/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Bütöv ad kod kimi də gələ bilər ("en-US").
  const asCode = parseLanguageCode(cleaned);
  if (asCode) return asCode;

  const tokens = cleaned.split(" ").filter(Boolean);
  // Ən uzun prefiks: "norsk bokmål", "bahasa indonesia", sonra tək söz.
  for (let len = tokens.length; len >= 1; len--) {
    const candidate = tokens.slice(0, len).join(" ");
    const code = NAME_TO_CODE.get(candidate);
    if (code) {
      const rest = tokens.slice(len).join(" ");
      region ??= rest ? regionFrom(rest) : undefined;
      return region ? { code, locale: `${code}-${region}` } : { code };
    }
  }
  return {};
}

interface LabelFlags {
  original: boolean;
  audioDescription: boolean;
  closedCaption: boolean;
  forced: boolean;
  dub: boolean;
  voiceOver: boolean;
}

export function labelFlags(label: string): LabelFlags {
  return {
    original: ORIGINAL_RE.test(label),
    audioDescription: AUDIO_DESCRIPTION_RE.test(label) || AD_TOKEN_RE.test(label),
    closedCaption: CLOSED_CAPTION_RE.test(label),
    forced: FORCED_RE.test(label),
    dub: DUB_RE.test(label),
    voiceOver: VOICE_OVER_RE.test(label),
  };
}

function cleanName(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

/** Növ işarəsi olan mötərizə/sonluq hissələri — göstərmə adından kəsilir. */
const QUALIFIER_SEGMENT_RE =
  /\s*(?:[-–—:|,]\s*|[([]\s*)(?:original|orijinal|оригинал|audio\s*description|audio[- ]described|described\s*video|descriptive|ad|cc|sdh|closed\s*captions?|forced|zorunlu|dubbed|dub|dublaj|дубляж|voice[- ]?over|закадровый)\s*[)\]]?(?=\s*(?:[-–—:|,([]|$))/gi;

/**
 * "English - Original" → "English", "Portuguese (Brazil) - Audio Description" →
 * "Portuguese (Brazil)", "English [CC]" → "English". Region mötərizəsi qalır.
 */
export function displayNameFrom(label: string): string {
  const stripped = cleanName(label).replace(QUALIFIER_SEGMENT_RE, "").trim();
  return stripped || cleanName(label);
}

function withLanguage(rawLabel: string, type: LanguageTrackType, parsed: ParsedLanguage): LanguageTrack {
  const track: LanguageTrack = { rawLabel, name: displayNameFrom(rawLabel), type };
  if (parsed.code) track.code = parsed.code;
  if (parsed.locale) track.locale = parsed.locale;
  return track;
}

/** Tək audio etiketi — siyahı konteksti olmadan (açıq işarələr). */
export function parseAudioLabel(label: string, codeHint?: string): LanguageTrack {
  const name = cleanName(label);
  const parsed = (codeHint && parseLanguageCode(codeHint)) || parseLanguageName(name);
  const f = labelFlags(name);
  const type: LanguageTrackType = f.audioDescription
    ? "audio_description"
    : f.original
      ? "original"
      : f.dub
        ? "dub"
        : f.voiceOver
          ? "voice_over"
          : "unknown";
  return withLanguage(name, type, parsed);
}

export function parseSubtitleLabel(label: string, codeHint?: string): LanguageTrack {
  const name = cleanName(label);
  const parsed = (codeHint && parseLanguageCode(codeHint)) || parseLanguageName(name);
  const f = labelFlags(name);
  const track = withLanguage(name, f.closedCaption ? "closed_caption" : "subtitle", parsed);
  if (f.forced) track.forced = true;
  return track;
}

export interface RawTrack {
  label: string;
  /** JSON mənbəsində ayrıca kod sahəsi varsa ("en-US"). */
  code?: string;
}

export interface AudioClassifyContext {
  /** Metadata-da orijinal dil AÇIQ yazılıbsa (ISO 639-1). Təxmin ötürmə. */
  originalLanguage?: string;
}

function dedupe(tracks: LanguageTrack[]): LanguageTrack[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const key = `${t.type}|${t.locale ?? t.code ?? ""}|${t.forced ? "f" : ""}|${t.rawLabel.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Bütöv audio siyahısı — "original"/"dub" qərarı siyahı səviyyəsində verilir. */
export function classifyAudioTracks(raw: RawTrack[], ctx: AudioClassifyContext = {}): LanguageTrack[] {
  const tracks = raw.filter((r) => r.label.trim()).map((r) => parseAudioLabel(r.label, r.code));
  const explicitOriginal = tracks.find((t) => t.type === "original");

  for (const t of tracks) {
    if (t.type !== "unknown" || !t.code) continue;
    if (explicitOriginal?.code) {
      // Platforma orijinalı özü işarələyib → digər dillər alternativ (dublyaj) səsdir.
      if (t.code !== explicitOriginal.code) t.type = "dub";
    } else if (ctx.originalLanguage && t.code === ctx.originalLanguage) {
      t.type = "original";
    }
  }
  return dedupe(tracks);
}

export function classifySubtitleTracks(raw: RawTrack[]): LanguageTrack[] {
  return dedupe(
    raw
      .filter((r) => r.label.trim() && !isSubtitleOffOption(r.label))
      .map((r) => parseSubtitleLabel(r.label, r.code))
  );
}
