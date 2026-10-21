/**
 * HBO Max kollektorunun vəziyyəti — yalnız oxuyur (brauzer açmır).
 *
 *   npm run hbomax:status
 *   npm run hbomax:status -- --recompute     # bütün şouların dil aqreqasiyasını yenidən hesabla
 *   npm run hbomax:status -- --show <showId> # bir şounun AZ dil cədvəli
 */
import "dotenv/config";
import "@/lib/scrapers/hbomaxCollector/db/collectorDb"; // ⚠️ lib/prisma-dan ƏVVƏL — DB seçimi (Supabase-ə düşməsin)
import { parseArgs } from "node:util";
import { prisma } from "@/lib/prisma";
import { HBOMAX_CONFIG, HBOMAX_REGION } from "@/lib/scrapers/hbomaxCollector/config";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { recomputeTitleLanguages } from "@/lib/scrapers/hbomaxCollector/db/aggregateStore";
import { PLATFORM } from "@/lib/scrapers/hbomaxCollector/db/catalogStore";
import { attemptsInLast24h } from "@/lib/scrapers/hbomaxCollector/db/queueStore";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { recompute: { type: "boolean", default: false }, show: { type: "string" } },
});

runCli(async () => {
  const region = HBOMAX_REGION;
  const now = new Date();

  if (values.show) {
    const title = await prisma.providerTitle.findFirst({
      where: { OR: [{ id: values.show }, { platform: PLATFORM, providerId: values.show }] },
      select: { id: true, title: true, languages: { where: { region }, orderBy: [{ kind: "asc" }, { trackGroup: "asc" }, { code: "asc" }] } },
    });
    if (!title) throw new Error(`Show ${values.show} not found`);
    console.log(`\n${title.title} — ${region}`);
    console.table(
      title.languages.map((l) => ({
        kind: l.kind,
        group: l.trackGroup,
        lang: l.locale || l.code,
        name: l.displayName,
        available: `${l.episodesAvailable}/${l.episodesTotal}`,
        verified: `${l.episodesVerified}/${l.episodesTotal}`,
        status: l.status,
      }))
    );
    return;
  }

  if (values.recompute) {
    const titles = await prisma.providerTitle.findMany({ where: { platform: PLATFORM }, select: { id: true } });
    for (const t of titles) await recomputeTitleLanguages(t.id, region);
    console.log(`Recomputed ${titles.length} title(s)`);
  }

  const [titles, availableTitles, linkedTitles, missingTitles, episodes, listed, byStatus, failedTerminal, used, runs] = await Promise.all([
    prisma.providerTitle.count({ where: { platform: PLATFORM } }),
    prisma.providerTitleRegion.count({ where: { region, isCurrentlyAvailable: true, title: { platform: PLATFORM } } }),
    prisma.providerTitle.count({ where: { platform: PLATFORM, linkKind: { in: ["MATCHED_IMDB", "MATCHED_TITLE"] } } }),
    prisma.providerTitleRegion.count({ where: { region, consecutiveMissingSyncs: { gt: 0 }, title: { platform: PLATFORM } } }),
    prisma.providerEpisode.count({ where: { title: { platform: PLATFORM } } }),
    prisma.providerEpisode.count({ where: { title: { platform: PLATFORM }, isCurrentlyListed: true } }),
    prisma.episodeRegionState.groupBy({ by: ["status", "priority"], where: { region }, _count: { _all: true }, orderBy: [{ status: "asc" }, { priority: "asc" }] }),
    prisma.episodeRegionState.count({ where: { region, status: "FAILED", nextAttemptAt: null } }),
    attemptsInLast24h(region, now),
    prisma.scrapeRun.findMany({ where: { kind: { in: ["HBOMAX_CATALOG", "HBOMAX_VALIDATE"] } }, orderBy: { startedAt: "desc" }, take: 6 }),
  ]);

  console.log(`\nHBO Max collector — region ${region}`);
  console.table({
    titles: { value: titles },
    "titles currently available": { value: availableTitles },
    "titles matched to existing Honsell titles (P0)": { value: linkedTitles },
    "titles missing in ≥1 recent full sync": { value: missingTitles },
    episodes: { value: episodes },
    "episodes currently listed": { value: listed },
    "terminal FAILED (needs metadata change)": { value: failedTerminal },
    "attempts in last 24h": { value: `${used}/${HBOMAX_CONFIG.validation.dailyLimit}` },
  });
  console.log("\nValidation queue (status × priority):");
  console.table(byStatus.map((r) => ({ status: r.status, priority: `P${r.priority}`, count: r._count._all })));
  console.log("\nRecent runs:");
  console.table(
    runs.map((r) => ({
      kind: r.kind,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? "",
      error: r.error?.slice(0, 60) ?? "",
    }))
  );
});
