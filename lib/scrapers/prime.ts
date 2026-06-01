import { SCRAPER_CONFIG } from "@/lib/scrapers/config";
import { scrapeJustWatchProvider, resolvePackageShortName } from "@/lib/scrapers/justwatch";
import type { Scraper, ScraperResult } from "@/lib/scrapers/types";

/**
 * Prime Video — JustWatch provider shortName "amp".
 *
 * Multi-region: `SCRAPER_CONFIG.primeCountries`-dəki hər ölkə üçün ayrıca
 * sorğu atılır və ölkə başına bir `ScraperResult` qaytarılır. Orchestrator
 * hər nəticəni öz ölkəsi üzrə persist edir — eyni başlıq bir neçə ölkədə
 * görünə bilər (canonical title IMDb ID üzrə paylaşılır, availability isə
 * ölkə üzrə ayrılır).
 *
 * Tam katalog üçün `primeMaxPages` (böyük tavan) ötürülür — JustWatch
 * `hasNextPage=false` qaytaranda onsuz da dayanır.
 *
 * Package shortName region-spesifikdir (DE/GB "amp", FR "prv"), ona görə hər
 * ölkə üçün "Amazon Prime Video" adına görə dinamik tapılır; tapılmazsa "amp".
 */
export const primeScraper: Scraper = {
  platform: "PRIME",
  async run(): Promise<ScraperResult[]> {
    const results: ScraperResult[] = [];
    for (const country of SCRAPER_CONFIG.primeCountries) {
      const shortName = await resolvePackageShortName(country, "Amazon Prime Video", "amp");
      results.push(
        await scrapeJustWatchProvider("PRIME", shortName, country, SCRAPER_CONFIG.primeMaxPages)
      );
    }
    return results;
  },
};
