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
  description?: string;
  /** Yalnız streamingLanguages.ts-dəki LanguageCode-lardan biri saxlanır;
   *  digər dillər scraper səviyyəsində süzülməlidir. */
  audioLanguages: LanguageCode[];
  subtitleLanguages: LanguageCode[];
}

/** Bir platform scraper-inin run nəticəsi. */
export interface ScraperResult {
  platform: Platform;
  /** Platformun AZ-də mövcud olduğu bütün başlıqlar. Eyni run-da heç biri
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
  run(): Promise<ScraperResult>;
}
