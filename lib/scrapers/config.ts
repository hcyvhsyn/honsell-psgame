/**
 * Streaming scraper konfiqurasiyası.
 *
 * Country code və dil filtri tək nöqtədə saxlanır — gələcəkdə multi-region
 * istəsək, yalnız buranı dəyişəcəyik. Heç bir scraper-də "AZ" hardcode olunmur.
 */

export type Platform = "NETFLIX" | "HBOMAX" | "PRIME" | "GAIN";

export const PLATFORMS: readonly Platform[] = ["NETFLIX", "HBOMAX", "PRIME", "GAIN"] as const;

export const SCRAPER_CONFIG = {
  /** Hədəf ölkə — ISO 3166-1 alpha-2. JustWatch və uNoGS bu kodu istifadə edir.
   *  Netflix (uNoGS), HBO Max və Gain hələ də bu tək ölkəni (AZ) işlədir. */
  country: "AZ" as const,

  /** Prime Video hədəf ölkə(lər)i — JustWatch hər ölkəni ayrıca sorğulayır.
   *  Hazırda yalnız "AZ": istifadəçi Azərbaycandan baxanda görünən Prime
   *  kataloqunu istəyir (primevideo.com storefront AZ IP-dən məhz bunu verir).
   *  Package shortName ölkəyə görə dəyişir (AZ/FR "prv", DE/GB "amp") — prime.ts
   *  onu dinamik tapır. Multi-region üçün buraya ölkə əlavə etmək kifayətdir. */
  primeCountries: ["AZ"] as const,

  /** uNoGS köhnə v1 sorğularda istifadə olunan rəqəm ID — saxlanılır legacy üçün
   *  (lazım gələrsə). Müasir v3 ISO kod istifadə edir — bax `country` sahəsi. */
  unogsCountryId: 91,

  /** Hər platform üçün maksimum səhifə — limitsiz qoymuruq ki, run vaxtı
   *  bu qiymət maxDuration-dan çıxmasın. */
  maxPagesPerPlatform: 20,

  /** Prime "mümkün qədər tam" katalog üçün ayrıca yüksək limit. JustWatch
   *  `hasNextPage=false` qaytaranda onsuz da dayanır; bu yalnız təhlükəsizlik
   *  tavanıdır. Bu qədər səhifə Vercel-in 300s limitini keçə bilər — tam
   *  backfill `scripts/scrapePrimeFull.ts` (lokal, limitsiz) ilə işlədilməlidir.
   *  DE kataloqu ~8650 başlıq (≈217 səhifə × 40) olduğu üçün tavanı 400-ə
   *  qoyuruq ki, böyük ölkələrin quyruğu da tam tutulsun. */
  primeMaxPages: 400,

  /** TMDB enrichment istəkləri arası pacing (ms). TMDB ~50 req/s icazə verir;
   *  20ms təhlükəsiz pəncərədə qalır və IMDb cache sayəsində istək sayı azdır. */
  tmdbPacingMs: 25,

  /** HTTP retry siyasəti — başarısız istəklərdə 3 dəfə yenidən cəhd. */
  retry: {
    attempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
  },

  /** Platformlar arası rate-limit (ms). Hər istəkdən sonra bu qədər gözlənilir. */
  rateLimitMs: {
    NETFLIX: 250, // uNoGS RapidAPI free-tier üçün təhlükəsiz
    HBOMAX: 200, // JustWatch
    PRIME: 200, // JustWatch
    GAIN: 1000, // gain.tv-ə nəzakətli olmaq üçün
  } satisfies Record<Platform, number>,
} as const;

/** uNoGS RapidAPI key — .env-dən gəlir. */
export function getRapidApiKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    throw new Error(
      "RAPIDAPI_KEY .env-də təyin olunmayıb — Netflix scraper işləyə bilməz."
    );
  }
  return key;
}
