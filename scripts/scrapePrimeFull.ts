/**
 * Prime Video tam katalog backfill — LOKAL runner.
 *
 * Niyə ayrıca script? — Multi-region (DE+GB+FR) + tam katalog (`primeMaxPages`)
 * + TMDB enrichment Vercel route-larındakı `maxDuration = 300s` limitini keçir.
 * Bu script lokal mühitdə vaxt limiti olmadan işləyir.
 *
 * İşə salmaq:
 *   npx tsx scripts/scrapePrimeFull.ts
 *   # və ya tsx quraşdırıbsa:  npm run scrape:prime
 *
 * .env avtomatik yüklənir (dotenv/config). DATABASE_URL və TMDB_ACCESS_TOKEN
 * mütləq qurulmalıdır.
 *
 * Qeyd: incremental sync (sürətli, yalnız populyar) üçün admin paneli /
 * `POST /api/scrape` qalır — bu script ağır, tam backfill üçündür.
 */

import "dotenv/config";
import { runStreamingScrape, type ProgressEvent } from "@/lib/scrapers/orchestrator";
import { SCRAPER_CONFIG } from "@/lib/scrapers/config";
import { prisma } from "@/lib/prisma";

function logEvent(e: ProgressEvent): void {
  switch (e.type) {
    case "start":
      console.log(`▶ Scrape başladı (run ${e.scrapeRunId}) — platformlar: ${e.platforms.join(", ")}`);
      console.log(`  Prime ölkələri: ${SCRAPER_CONFIG.primeCountries.join(", ")} | maxPages: ${SCRAPER_CONFIG.primeMaxPages}`);
      break;
    case "platformStart":
      console.log(`  … ${e.platform} çəkilir`);
      break;
    case "platformDone": {
      const s = e.summary;
      console.log(
        `  ✓ ${e.platform}: ${s.status} — added ${s.added}, updated ${s.updated}, removed ${s.removed}, unchanged ${s.unchanged} (scraped ${s.scrapedCount}, ${s.requestCount ?? 0} req)`
      );
      if (s.warnings.length) {
        for (const w of s.warnings.slice(0, 10)) console.log(`      ⚠ ${w}`);
        if (s.warnings.length > 10) console.log(`      … +${s.warnings.length - 10} warning daha`);
      }
      if (s.error) console.log(`      ✗ ${s.error}`);
      break;
    }
    case "done":
      console.log(`■ Bitdi — status ${e.result.status} | totals:`, e.result.totals);
      break;
    case "error":
      console.error(`✗ Xəta: ${e.error}`);
      break;
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  try {
    const result = await runStreamingScrape({
      platforms: ["PRIME"],
      onEvent: logEvent,
    });
    const mins = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.log(`\nTamamlandı (${mins} dəq). Status: ${result.status}`);
    process.exitCode = result.status === "FAILED" ? 1 : 0;
  } catch (err) {
    console.error("Fatal:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
