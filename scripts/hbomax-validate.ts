/**
 * HBO Max — Stage 2: AZ player validasiyası (növbə).
 *
 *   npm run hbomax:validate-pending                    # növbə (gündəlik limitə tabedir)
 *   npm run hbomax:validate-pending -- --limit 50      # bu run üçün tavan
 *   npm run hbomax:validate-show -- <showId|titleId>   # bir şounun bütün epizodları (status nəzərə alınmır)
 *   npm run hbomax:validate-episode -- <videoId|episodeId>
 *
 * Tələb: HBOMAX_PROFILE_NAME (kollektor üçün ayrıca HBO profili) və həmin profil
 * `npm run hbomax:login`-də seçilmiş olmalıdır. Profil seçimi tələb olunarsa və ya
 * aktiv profil fərqlidirsə validasiya DAYANIR.
 */
import "dotenv/config";
import "@/lib/scrapers/hbomaxCollector/db/collectorDb"; // ⚠️ lib/prisma-dan ƏVVƏL — DB seçimi (Supabase-ə düşməsin)
import { parseArgs } from "node:util";
import { prisma } from "@/lib/prisma";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { PLATFORM } from "@/lib/scrapers/hbomaxCollector/db/catalogStore";
import { runValidation, type ValidationRunOptions } from "@/lib/scrapers/hbomaxCollector/queue/worker";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    mode: { type: "string", default: "pending" },
    limit: { type: "string" },
  },
  allowPositionals: true,
});

async function resolveOptions(): Promise<ValidationRunOptions> {
  const limit = values.limit !== undefined ? Number(values.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new HboCollectorError("CONFIG", `--limit must be a positive integer, got ${values.limit}`);
  const mode = values.mode;
  if (mode === "pending") return { mode, limit };

  const target = positionals[0];
  if (!target) throw new HboCollectorError("CONFIG", `Usage: npm run hbomax:validate-${mode} -- <id>`);
  if (mode === "show") {
    const title = await prisma.providerTitle.findFirst({
      where: { OR: [{ id: target }, { platform: PLATFORM, providerId: target }] },
      select: { id: true, title: true },
    });
    if (!title) throw new HboCollectorError("NOT_FOUND", `Show ${target} not in DB — run hbomax:catalog-sync -- --show ${target} first`);
    hboLog.info(`Target show: ${title.title}`);
    return { mode, titleId: title.id, limit };
  }
  if (mode === "episode") {
    const ep = await prisma.providerEpisode.findFirst({ where: { OR: [{ id: target }, { providerId: target }] }, select: { id: true } });
    if (!ep) throw new HboCollectorError("NOT_FOUND", `Episode ${target} not in DB — sync its show first`);
    return { mode, episodeId: ep.id, limit: 1 };
  }
  throw new HboCollectorError("CONFIG", `Unknown --mode ${mode} (pending | show | episode)`);
}

runCli(async () => {
  const opts = await resolveOptions();
  const summary = await runValidation(opts);
  hboLog.info("Validation run finished", {
    verified: summary.verified,
    failed: summary.failed,
    recovered: summary.recovered,
    titlesRecomputed: summary.titlesRecomputed,
    stoppedBy: summary.stoppedBy,
  });
});
