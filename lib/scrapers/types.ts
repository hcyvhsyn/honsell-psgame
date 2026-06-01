import type { LanguageCode } from "@/lib/streamingLanguages";
import type { Platform } from "@/lib/scrapers/config";

/** Bir scrape-də çəkilmiş tək başlıq — platform-agnostik shape. */
export interface ScrapedTitle {
  /** Platform daxilindəki ID/slug — deep link üçün lazımdır. Hər platformda
   *  unikal olmalıdır (məs. Netflix netflix_id, JustWatch jw_entity_id). */
  platformExternalId: string;
  /** Platform tərəfindəki deep link (varsa). */
  deepLinkUrl?: string;
  title: string;
  /** "MOVIE" | "SERIES" */
  kind: "MOVIE" | "SERIES";
  year?: number;
  /** Janr siyahısı — bütün dillərdə bir-birinə uyğunlaşdırma yox, raw etiket. */
  genres?: string[];
  /** Canonical matching üçün IMDb ID (varsa) — məs. "tt0372784". */
  imdbId?: string;
  posterUrl?: string;
  /** Geniş (16:9) backdrop şəkli — adətən TMDB enrichment-dən gəlir. */
  backdropUrl?: string;
  description?: string;
  /** TMDB reytinqi (vote_average, 0-10) — enrichment-dən. */
  rating?: number;
  /** TMDB səs sayı (vote_count) — reytinq tie-breaker. */
  voteCount?: number;
  /** TMDB populyarlıq skoru — "ən çox baxılan" sıralaması üçün. */
  popularity?: number;
  /** Yalnız streamingLanguages.ts-dəki LanguageCode-lardan biri saxlanır;
   *  digər dillər scraper səviyyəsində süzülməlidir. */
  audioLanguages: LanguageCode[];
  subtitleLanguages: LanguageCode[];
}

/** Bir platform scraper-inin run nəticəsi. */
export interface ScraperResult {
  platform: Platform;
  /** Bu nəticənin aid olduğu ölkə (ISO 3166-1 alpha-2). Multi-region
   *  scraper-lər (Prime) hər ölkə üçün ayrıca ScraperResult qaytarır; persist
   *  availability-ni məhz bu ölkə üzrə yazır. */
  country: string;
  /** Platformun bu ölkədə mövcud olduğu bütün başlıqlar. Eyni run-da heç biri
   *  təkrarlanmamalıdır (`platformExternalId` üzrə unikal). */
  titles: ScrapedTitle[];
  /** Run ərzində baş verən recoverable error-lar — failure deyil, lakin
   *  ScrapeRun.summary-də log üçün saxlanır. */
  warnings: string[];
  /** Scraper işləyə bilmədikdə bu doldurulur — orchestrator onu PARTIAL run
   *  kimi qeyd edir, digər platformları davam etdirir. */
  fatalError?: string;
  /** İstək sayı, ms cəmi və s. — telemetriya üçün opsional. */
  stats?: {
    requestCount?: number;
    durationMs?: number;
  };
}

export interface Scraper {
  platform: Platform;
  /** Tək ölkə üçün bir nəticə, və ya multi-region halında ölkə başına bir
   *  nəticə massivi. Orchestrator hər ikisini normalize edir. */
  run(): Promise<ScraperResult | ScraperResult[]>;
}
