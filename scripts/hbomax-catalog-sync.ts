/**
 * HBO Max — Stage 1: metadata kataloq sync-i (player açılmır).
 *
 *   npm run hbomax:catalog-sync                          # tam kəşf + bütün şoular
 *   npm run hbomax:catalog-sync -- --show <showId>       # tək şou (təkrar ola bilər), qismən run
 *   npm run hbomax:catalog-sync -- --limit 20            # kəşf tam, detal 20 şou
 *   npm run hbomax:catalog-sync -- --missing             # kəşf tam, detal yalnız metadata-sı olmayanlar (yarımçıq run-un davamı)
 *   npm run hbomax:catalog-sync -- --dry-run             # yalnız kəşf sayı, DB-yə yazmır
 *   npm run hbomax:catalog-sync -- --source all-rails    # kəşf mənbəyi (default: az)
 *
 * ⚠️ Tam sync-dən əvvəl coverage spike nəticəsinə bax (`hbomax:coverage-spike`).
 */
import "dotenv/config";
import "@/lib/scrapers/hbomaxCollector/db/collectorDb"; // ⚠️ lib/prisma-dan ƏVVƏL — DB seçimi (Supabase-ə düşməsin)
import { parseArgs } from "node:util";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { openSession } from "@/lib/scrapers/hbomaxCollector/browser/session";
import { runCatalogSync } from "@/lib/scrapers/hbomaxCollector/catalog/syncCatalog";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    show: { type: "string", multiple: true },
    limit: { type: "string" },
    missing: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    source: { type: "string", default: "az" },
  },
});

runCli(async () => {
  const source = values.source;
  if (source !== "az" && source !== "all-rails") throw new HboCollectorError("CONFIG", `--source must be az | all-rails, got ${source}`);
  const limit = values.limit !== undefined ? Number(values.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new HboCollectorError("CONFIG", `--limit must be a positive integer`);

  const session = await openSession();
  try {
    const summary = await runCatalogSync(session.page, { source, showIds: values.show, limit, onlyMissing: values.missing, dryRun: values["dry-run"] });
    hboLog.info("Catalog sync finished", {
      full: summary.full,
      discovered: summary.discovered,
      newTitles: summary.newTitles,
      detailed: summary.detailed,
      incomplete: summary.incompleteShows,
      failed: summary.failedShows,
      episodesCreated: summary.episodesCreated,
      queued: summary.queueCreated,
      staled: summary.queueStaled,
      missingIncremented: summary.missing?.incremented,
      deactivated: summary.missing?.deactivated,
      requests: summary.requests,
    });
  } finally {
    await session.close();
  }
});
