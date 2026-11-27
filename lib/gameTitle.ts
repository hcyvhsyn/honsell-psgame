/**
 * Oyun adının MÜŞTƏRİYƏ göstərilən forması. Saf, client-safe.
 *
 * `Game.title` PS Store Türkiyə mağazasından olduğu kimi gəlir: "It Takes Two PS4™ ve PS5™",
 * "EA SPORTS FC™ 26 Ultimate Sürüm PS4 ve PS5". Sondakı platforma sonluğu kartda/səhifədə
 * onsuz da nişan kimi yazılır (təkrar), "ve" isə türkcədir.
 *
 * ⚠️ YALNIZ göstərmə üçündür. DB-dəki `title`-ı dəyişmə — axtarış, sürüm qruplaşdırması
 * (lib/gameEditions.ts) və SEO meta (platformalar ayrıca əlavə olunur) xam adla işləyir.
 *
 * Test: `npm run test:gametitle`.
 */

const PS = String.raw`PS\s?[45](?:™|®)?`;
const JOIN = String.raw`(?:ve|və|and|&|\/|,|\+)`;

/** Sondakı "PS4 ve PS5" / "(PS5 & PS4)" / "- PS4/PS5" tipli İKİ platformalı sonluq. */
const TRAILING_PLATFORM_PAIR = new RegExp(
  String.raw`\s*[-–—:]?\s*\(?\s*${PS}\s*${JOIN}\s*${PS}\s*\)?\s*$`,
  "i",
);

/** Adın içində qalan "PS4 ve PS5" — yalnız platforma tokenləri arasındakı "ve" dəyişir. */
const INNER_PLATFORM_VE = new RegExp(String.raw`(${PS})\s+ve\s+(${PS})`, "gi");

export function displayGameTitle(title: string): string {
  const raw = (title ?? "").trim();
  if (!raw) return raw;
  const stripped = raw.replace(TRAILING_PLATFORM_PAIR, "").trim();
  // Ad yalnız platformadan ibarət olsaydı (nəzəri hal) — xam adı saxla.
  const base = stripped.length >= 2 ? stripped : raw;
  return base.replace(INNER_PLATFORM_VE, "$1 və $2");
}
