/**
 * HBO Max — lokal kollektor datasını PROD-a göndər (HTTPS, token ilə).
 *
 *   npm run hbomax:publish                 # son göndərişdən sonra dəyişənlər + prod-da proyeksiya
 *   npm run hbomax:publish -- --all        # hamısı
 *   npm run hbomax:publish -- --dry-run    # neçə başlıq gedəcək — heç nə göndərilmir
 *
 * Tələb (.env): HBOMAX_PUBLISH_URL=https://honsell.site, HBOMAX_IMPORT_TOKEN (prod .env ilə eyni).
 * Prod-da əvvəlcə HBO miqrasiyaları tətbiq olunmalıdır (deploy) — yoxsa endpoint 500 verir.
 */
import "dotenv/config";
import "@/lib/scrapers/hbomaxCollector/db/collectorDb";
import { parseArgs } from "node:util";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { publishToProd } from "@/lib/scrapers/hbomaxCollector/publish/publishToProd";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    all: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "skip-projection": { type: "boolean", default: false },
  },
});

runCli(async () => {
  const s = await publishToProd({ all: values.all, dryRun: values["dry-run"], skipProjection: values["skip-projection"] });
  hboLog.info("Publish finished", {
    candidates: s.candidates,
    sent: s.sent,
    batches: s.batches,
    episodes: s.episodes,
    tracks: s.tracks,
    projection: s.projection ? JSON.stringify(s.projection) : "skipped",
  });
});
