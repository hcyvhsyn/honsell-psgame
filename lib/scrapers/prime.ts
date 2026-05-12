import { scrapeJustWatchProvider } from "@/lib/scrapers/justwatch";
import type { Scraper } from "@/lib/scrapers/types";

/** Prime Video — JustWatch provider shortName "amp". */
export const primeScraper: Scraper = {
  platform: "PRIME",
  run: () => scrapeJustWatchProvider("PRIME", "amp"),
};
