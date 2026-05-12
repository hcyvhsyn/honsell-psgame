import { scrapeJustWatchProvider } from "@/lib/scrapers/justwatch";
import type { Scraper } from "@/lib/scrapers/types";

/**
 * HBO Max — JustWatch provider shortName "max". (Köhnə "hbm" 2023-cü il
 * sonu rebrand-dan əvvəlki dövr üçündür; əgər `max` boş cavab qaytarırsa
 * `hbm` ilə fallback edirik.)
 */
export const hboMaxScraper: Scraper = {
  platform: "HBOMAX",
  async run() {
    const primary = await scrapeJustWatchProvider("HBOMAX", "max");
    if (primary.titles.length > 0 || primary.fatalError) return primary;
    // Boş nəticə — `hbm` ilə yenidən sına.
    const fallback = await scrapeJustWatchProvider("HBOMAX", "hbm");
    return {
      ...fallback,
      warnings: [...primary.warnings, ...fallback.warnings, "primary 'max' returned 0 — fell back to 'hbm'"],
    };
  },
};
