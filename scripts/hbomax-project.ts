/**
 * HBO Max — Phase 3: AZ kataloqunun vitrinə proyeksiyası (brauzer açmır).
 *
 *   npm run hbomax:project                    # bütün AZ-da görünən HBO şouları
 *   npm run hbomax:project -- --dry-run       # yalnız say: neçəsi uyğunlaşır / yaradılar, dil sətirləri
 *   npm run hbomax:project -- --show <id>     # tək şou (ProviderTitle id və ya HBO show id)
 *   npm run hbomax:project -- --skip-tmdb     # TMDB sorğusu yox (yalnız ad + il uyğunlaşması)
 *
 * Yazır: StreamingTitle (yeni HBO başlıqları), ContentAvailability(platform=HBOMAX, AZ),
 * ContentLanguage (YALNIZ FULL/PARTIAL — qlobal metadata heç vaxt). DB = HBOMAX_DATABASE_URL.
 */
import "dotenv/config";
import "@/lib/scrapers/hbomaxCollector/db/collectorDb"; // ⚠️ lib/prisma-dan ƏVVƏL — DB seçimi (Supabase-ə düşməsin)
import { parseArgs } from "node:util";
import { HBOMAX_REGION } from "@/lib/scrapers/hbomaxCollector/config";
import { runCli } from "@/lib/scrapers/hbomaxCollector/cli";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { projectHboToStorefront } from "@/lib/scrapers/hbomaxCollector/projection/projectToStorefront";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "dry-run": { type: "boolean", default: false },
    show: { type: "string" },
    "skip-tmdb": { type: "boolean", default: false },
  },
});

runCli(async () => {
  const s = await projectHboToStorefront({
    region: HBOMAX_REGION,
    dryRun: values["dry-run"],
    title: values.show,
    skipTmdb: values["skip-tmdb"],
  });
  hboLog.info(values["dry-run"] ? "Projection dry-run (nothing written)" : "Projection finished", {
    titles: s.titles,
    alreadyLinked: s.linked.ALREADY,
    matchedImdb: s.linked.MATCHED_IMDB,
    matchedTitle: s.linked.MATCHED_TITLE,
    created: s.linked.CREATED,
    availabilityActive: s.availabilityActive,
    availabilityRemoved: s.availabilityRemoved,
    titlesWithLanguages: s.titlesWithLanguages,
    languageRows: s.languageRows,
    priorityRaisedToP0: s.priorityRaised,
  });
});
