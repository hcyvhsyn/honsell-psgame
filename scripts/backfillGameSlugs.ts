/**
 * Game.slug backfill — SEO URL-lərinin bir dəfəlik doldurulması.
 *
 * Slug-suz hər aktiv/passiv oyuna lib/gameSlug.ts qaydaları ilə unikal slug
 * təyin edir. İdempotentdir: artıq slug-u olan sətirə TOXUNMUR (slug-u sonradan
 * dəyişmək linkləri və toplanmış ranking-i itirər), ona görə skripti istənilən
 * vaxt təkrar çalışdırmaq olar — yalnız yeni scrape olunmuş oyunlar slug alır.
 *
 * İşə salmaq:
 *   npx tsx scripts/backfillGameSlugs.ts           # yaz
 *   npx tsx scripts/backfillGameSlugs.ts --dry-run # yalnız göstər
 *
 * .env avtomatik yüklənir. DATABASE_URL qurulmalıdır.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { buildUniqueGameSlug } from "@/lib/gameSlug";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 500;

async function main() {
  // Mövcud slug-ları bir dəfə yaddaşa alırıq — hər namizəd üçün ayrıca SELECT
  // atmaq 10k+ sətirdə skripti dəqiqələrlə uzadır. Set eyni zamanda cari
  // işləmə ərzində yaradılan slug-ları da tutur (batch-daxili toqquşma).
  const existing = await prisma.game.findMany({
    where: { slug: { not: null } },
    select: { slug: true },
  });
  const taken = new Set<string>(
    existing.map((g) => g.slug).filter((s): s is string => Boolean(s))
  );
  console.log(`Mövcud slug: ${taken.size}`);

  const pending = await prisma.game.findMany({
    where: { slug: null },
    select: { id: true, productId: true, title: true, platform: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Slug gözləyən oyun: ${pending.length}${DRY_RUN ? " (dry-run)" : ""}`);
  if (pending.length === 0) return;

  let written = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH);
    const updates: { id: string; slug: string }[] = [];

    for (const game of chunk) {
      try {
        const slug = await buildUniqueGameSlug(game, (s) => taken.has(s));
        taken.add(slug);
        updates.push({ id: game.id, slug });
        if (DRY_RUN && updates.length <= 10) {
          console.log(`  ${game.productId} → ${slug}`);
        }
      } catch (err) {
        failed++;
        console.error(`  XƏTA ${game.productId}:`, (err as Error).message);
      }
    }

    if (!DRY_RUN && updates.length > 0) {
      // Ardıcıl deyil, paralel — hər biri primary key üzrə tək sətir update-idir.
      const results = await Promise.allSettled(
        updates.map((u) =>
          prisma.game.update({ where: { id: u.id }, data: { slug: u.slug } })
        )
      );
      for (const r of results) {
        if (r.status === "fulfilled") written++;
        else {
          failed++;
          console.error("  update uğursuz:", r.reason);
        }
      }
    }

    console.log(
      `Batch ${Math.floor(i / BATCH) + 1}: ${Math.min(i + BATCH, pending.length)}/${pending.length}`
    );
  }

  console.log(`\nBitdi. Yazıldı: ${DRY_RUN ? 0 : written}, xəta: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
