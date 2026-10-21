/**
 * lib/scrapers/hbomaxCollector/utils/language.ts testləri — `npm run test:hbomax-lang`.
 *
 * Bu məntiq sınsa kataloqda dublyaj olmayan serial "türkcə dublyajlı" kimi
 * görünə bilər — müştəriyə yanlış vəd. Brauzer/şəbəkə tələb etmir.
 */
import {
  classifyAudioTracks,
  classifySubtitleTracks,
  parseAudioLabel,
  parseLanguageCode,
  parseLanguageName,
  parseSubtitleLabel,
} from "../lib/scrapers/hbomaxCollector/utils/language";
import { compareTracks } from "../lib/scrapers/hbomaxCollector/utils/trackCompare";

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

// ── Ad → kod ────────────────────────────────────────────────────────────────
eq("English", parseLanguageName("English"), { code: "en" });
eq("English US", parseLanguageName("English US"), { code: "en", locale: "en-US" });
eq("English (Original)", parseLanguageName("English (Original)"), { code: "en" });
eq("Türkçe", parseLanguageName("Türkçe"), { code: "tr" });
eq("Turkish", parseLanguageName("Turkish"), { code: "tr" });
eq("Русский", parseLanguageName("Русский"), { code: "ru" });
eq("Russian", parseLanguageName("Russian"), { code: "ru" });
eq("Azərbaycan", parseLanguageName("Azərbaycan"), { code: "az" });
eq("Azerbaijani", parseLanguageName("Azerbaijani"), { code: "az" });
eq("Português (Brasil)", parseLanguageName("Português (Brasil)"), { code: "pt", locale: "pt-BR" });
eq("Español (Latinoamérica)", parseLanguageName("Español (Latinoamérica)"), { code: "es", locale: "es-419" });
eq("Norsk bokmål", parseLanguageName("Norsk bokmål"), { code: "no" });
eq("English [CC]", parseLanguageName("English [CC]"), { code: "en" });
eq("English - Audio Description", parseLanguageName("English - Audio Description"), { code: "en" });
eq("tanınmayan dil kod uydurmur", parseLanguageName("Klingon"), {});
eq("boş etiket", parseLanguageName("  "), {});

// ── Kod → kod ───────────────────────────────────────────────────────────────
eq("en-US", parseLanguageCode("en-US"), { code: "en", locale: "en-US" });
eq("eng (639-2)", parseLanguageCode("eng"), { code: "en" });
eq("es-419", parseLanguageCode("es-419"), { code: "es", locale: "es-419" });
eq("zh-hans", parseLanguageCode("zh-hans"), { code: "zh", locale: "zh-Hans" });
eq("xx tanınmır", parseLanguageCode("xx"), null);

// ── Tək etiketin növü ───────────────────────────────────────────────────────
eq("açıq orijinal", parseAudioLabel("English (Original)").type, "original");
eq("işarəsiz → unknown (dublyaj güman edilmir)", parseAudioLabel("Türkçe").type, "unknown");
eq("açıq dublaj", parseAudioLabel("Türkçe Dublaj").type, "dub");
eq("audio description", parseAudioLabel("English - Audio Description").type, "audio_description");
eq("AD qısaltması", parseAudioLabel("English AD").type, "audio_description");
eq("'Ad' sözü AD deyil", parseAudioLabel("Ad English").type, "unknown");
eq("voice-over", parseAudioLabel("Русский (закадровый)").type, "voice_over");
eq("altyazı", parseSubtitleLabel("Türkçe").type, "subtitle");
eq("CC", parseSubtitleLabel("English CC").type, "closed_caption");
eq("SDH", parseSubtitleLabel("English [SDH]").type, "closed_caption");
eq("forced", parseSubtitleLabel("English (Forced)"), { rawLabel: "English (Forced)", name: "English", type: "subtitle", code: "en", forced: true });

// ── Real HBO Max etiketləri (AZ, House of the Dragon S03E08, edit.attributes) ──
const realAudio = classifyAudioTracks(
  [
    "Spanish (Latin America)", "English - Original", "Portuguese (Brazil)", "English - Audio Description",
    "Portuguese (Brazil) - Audio Description", "Spanish (Spain)", "Turkish", "Russian",
  ].map((label) => ({ label }))
);
eq(
  "real audio: rawLabel qorunur, ad normallaşır, locale-lər birləşmir",
  realAudio.map((t) => [t.rawLabel, t.name, t.code, t.locale ?? null, t.type]),
  [
    ["Spanish (Latin America)", "Spanish (Latin America)", "es", "es-419", "dub"],
    ["English - Original", "English", "en", null, "original"],
    ["Portuguese (Brazil)", "Portuguese (Brazil)", "pt", "pt-BR", "dub"],
    ["English - Audio Description", "English", "en", null, "audio_description"],
    ["Portuguese (Brazil) - Audio Description", "Portuguese (Brazil)", "pt", "pt-BR", "audio_description"],
    ["Spanish (Spain)", "Spanish (Spain)", "es", "es-ES", "dub"],
    ["Turkish", "Turkish", "tr", null, "dub"],
    ["Russian", "Russian", "ru", null, "dub"],
  ]
);
const realSubs = classifySubtitleTracks(
  ["Portuguese (Brazil) - CC", "English - CC", "English", "Portuguese", "Serbian (Latin)", "Romanian (Moldova)", "Norwegian (Bokmål)", "Turkish"].map(
    (label) => ({ label })
  )
);
eq(
  "real subtitles: CC ayrı növdür, region/yazı variantı qorunur",
  realSubs.map((t) => [t.rawLabel, t.name, t.code ?? null, t.locale ?? null, t.type]),
  [
    ["Portuguese (Brazil) - CC", "Portuguese (Brazil)", "pt", "pt-BR", "closed_caption"],
    ["English - CC", "English", "en", null, "closed_caption"],
    ["English", "English", "en", null, "subtitle"],
    ["Portuguese", "Portuguese", "pt", null, "subtitle"],
    ["Serbian (Latin)", "Serbian (Latin)", "sr", "sr-Latn", "subtitle"],
    ["Romanian (Moldova)", "Romanian (Moldova)", "ro", "ro-MD", "subtitle"],
    ["Norwegian (Bokmål)", "Norwegian (Bokmål)", "no", null, "subtitle"],
    ["Turkish", "Turkish", "tr", null, "subtitle"],
  ]
);

// ── Siyahı səviyyəsi ────────────────────────────────────────────────────────
eq(
  "açıq orijinal varsa digər dillər dub olur, AD toxunulmur",
  classifyAudioTracks([
    { label: "English (Original)" },
    { label: "Türkçe" },
    { label: "English - Audio Description" },
  ]).map((t) => [t.code, t.type]),
  [
    ["en", "original"],
    ["tr", "dub"],
    ["en", "audio_description"],
  ]
);
eq(
  "orijinal işarəsi yoxdursa hamısı unknown",
  classifyAudioTracks([{ label: "English" }, { label: "Türkçe" }]).map((t) => t.type),
  ["unknown", "unknown"]
);
eq(
  "metadata orijinal dili yalnız 'original' verir, 'dub' YOX",
  classifyAudioTracks([{ label: "English" }, { label: "Türkçe" }], { originalLanguage: "en" }).map((t) => t.type),
  ["original", "unknown"]
);
eq(
  "JSON kod sahəsi addan üstündür",
  classifyAudioTracks([{ label: "Main", code: "en-US" }]).map((t) => t.locale),
  ["en-US"]
);
eq(
  "Off variantı altyazı deyil, təkrar atılır",
  classifySubtitleTracks([{ label: "Off" }, { label: "Türkçe" }, { label: "Türkçe" }, { label: "English CC" }]).map(
    (t) => [t.code, t.type]
  ),
  [
    ["tr", "subtitle"],
    ["en", "closed_caption"],
  ]
);

// ── Metadata ↔ UI müqayisəsi (real S03E08 nümunəsi) ──────────────────────
const cmp = compareTracks(
  {
    audio: classifyAudioTracks(["English - Original", "Turkish", "English - Audio Description", "Russian"].map((label) => ({ label }))),
    subtitles: classifySubtitleTracks(["English - CC", "English", "Romanian (Moldova)"].map((label) => ({ label }))),
  },
  {
    audio: classifyAudioTracks(["English - Original", "Russian"].map((label) => ({ label }))),
    subtitles: classifySubtitleTracks(["Off", "English", "Romanian"].map((label) => ({ label }))),
  }
);
eq("UI-da olmayan audio metadataOnly-dir", cmp.metadataOnlyAudio.map((t) => t.rawLabel), ["Turkish", "English - Audio Description"]);
eq("'English - Original' ↔ 'English - Original' uyğun, uiOnly boş", cmp.uiOnlyAudio, []);
eq("CC ayrıca trekdir", cmp.metadataOnlySubtitles.map((t) => t.rawLabel), ["English - CC"]);
eq("Romanian (Moldova) ↔ Romanian etiket variantı kimi cütlənir", cmp.labelVariants.map((v) => [v.metadata.rawLabel, v.ui.rawLabel]), [["Romanian (Moldova)", "Romanian"]]);
eq("uyğunsuzluq varsa match=false", [cmp.audioMatch, cmp.subtitleMatch], [false, false]);

console.log(failed === 0 ? "\n✅ bütün hbomax dil testləri keçdi\n" : `\n❌ ${failed} test sındı\n`);
process.exit(failed === 0 ? 0 : 1);
