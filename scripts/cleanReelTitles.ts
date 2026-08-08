/**
 * Reel başlıqlarının bir dəfəlik təmizlənməsi.
 *
 * Telegram ingest-i əvvəllər başlıq kimi MƏNBƏ ADINI yazırdı ("TikTok video",
 * "Instagram video"). Feed-də bu, videonun altında mənasız bir sətir kimi görünür —
 * müştəriyə heç nə demir və oyunun adının yerini tutur. Yeni ingest artıq belə
 * yazmır (başlıq yalnız caption-dan gəlir), amma KÖHNƏ sətirlər qalıb.
 *
 * Başlıq `""` olur, `null` yox — sxemdə sütun nullable deyil. Feed boş başlığı
 * onsuz da render etmir (ReelSlot-dakı `{item.title && …}` qorunması).
 *
 * İdempotentdir — istənilən vaxt təkrar işlədilə bilər.
 *
 * İşə salmaq:
 *   npx tsx scripts/cleanReelTitles.ts           # yaz
 *   npx tsx scripts/cleanReelTitles.ts --dry-run # yalnız göstər
 *
 * ⚠️ Serverdə `DIRECT_URL` `127.0.0.1:5433`-ə baxmalıdır — `db:5432` Docker-in
 * daxili adıdır (host-dan həll olunmur), `localhost:5432` isə BAŞQA layihənin
 * bazasıdır.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

/** Mənbə adları — ingest kodunda artıq yoxdur, yalnız köhnə sətirlərdədir. */
const SOURCE_TITLES = [
  "TikTok video",
  "Instagram video",
  "YouTube video",
  "Facebook video",
  "Telegram video",
];

async function main() {
  const rows = await prisma.reel.findMany({
    where: { title: { in: SOURCE_TITLES } },
    select: { id: true, title: true },
  });

  if (rows.length === 0) {
    console.log("Təmizlənəcək başlıq yoxdur.");
    return;
  }

  console.log(`${rows.length} reel tapıldı:`);
  for (const r of rows) console.log(`  ${r.id}  "${r.title}"`);

  if (DRY_RUN) {
    console.log("\n--dry-run — heç nə yazılmadı.");
    return;
  }

  const res = await prisma.reel.updateMany({
    where: { title: { in: SOURCE_TITLES } },
    data: { title: "" },
  });
  console.log(`\n✅ ${res.count} başlıq təmizləndi.`);
  console.log("Feed keşini sıfırlamaq üçün admin panelindən bir reel-i yenilə və ya");
  console.log("`revalidateReels()` işə düşən istənilən CRUD əməliyyatını et.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
