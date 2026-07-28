/**
 * PS Store detal səhifələrindən oyun metadata-sını çəkir (SEO bünövrəsi).
 *
 * Əsas scrape axını (app/api/scrape-ps-store) yalnız listinq səhifələrini gəzir
 * və orada təsvir/janr/nəşriyyatçı YOXDUR. Bu skript hər oyunun öz məhsul
 * səhifəsini açıb `lib/psStoreMetadata.ts` ilə parse edir.
 *
 * DAYANDIRILA/DAVAM ETDİRİLƏ BİLƏN: `metadataFetchedAt` ən köhnə olan (və ya
 * heç vaxt çəkilməmiş) sətirlərdən başlayır, ona görə `--limit` ilə hissə-hissə
 * çalışdırmaq olar; cron-a qoyulanda yeni scrape olunan oyunlar avtomatik
 * növbəyə düşür (yeni sətirdə `metadataFetchedAt` NULL olur).
 *
 * İşə salmaq:
 *   npx tsx scripts/enrichGameMetadata.ts --limit 200
 *   npx tsx scripts/enrichGameMetadata.ts --limit 50 --dry-run
 *   npx tsx scripts/enrichGameMetadata.ts --product-id UP0006-PPSA27360_00-FC26WOCUPBUNDLE0
 *   npx tsx scripts/enrichGameMetadata.ts --refresh-days 30   # köhnəlmişləri yenilə
 *
 * QEYD: PS Store bot qoruması var — konkurensiyanı yüksək qoymayın (default 4)
 * və serverdən çalışdırın (scrape axını onsuz da oradan işləyir).
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  parsePsStoreMetadata,
  isMetadataEmpty,
  type PsStoreMetadata,
} from "@/lib/psStoreMetadata";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(arg("limit")) || 200;
const CONCURRENCY = Number(arg("concurrency")) || 4;
const REFRESH_DAYS = Number(arg("refresh-days")) || 0;
const ONLY_PRODUCT_ID = arg("product-id");
const DELAY_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Target = { id: string; productId: string; title: string };

/** Detal səhifəsini çəkir. `null` = şəbəkə/HTTP xətası (yenidən cəhd ediləcək). */
async function fetchMetadata(productId: string): Promise<PsStoreMetadata | null> {
  try {
    const res = await fetch(
      `https://store.playstation.com/tr-tr/product/${encodeURIComponent(productId)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        },
        cache: "no-store",
        redirect: "follow",
      }
    );
    if (!res.ok) return null;
    return parsePsStoreMetadata(await res.text());
  } catch {
    return null;
  }
}

async function selectTargets(): Promise<Target[]> {
  if (ONLY_PRODUCT_ID) {
    const one = await prisma.game.findUnique({
      where: { productId: ONLY_PRODUCT_ID },
      select: { id: true, productId: true, title: true },
    });
    return one ? [one] : [];
  }

  const staleBefore =
    REFRESH_DAYS > 0
      ? new Date(Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000)
      : null;

  return prisma.game.findMany({
    where: {
      // Epic sətirlərinin PS Store səhifəsi yoxdur.
      store: "PS",
      isActive: true,
      ...(staleBefore
        ? { OR: [{ metadataFetchedAt: null }, { metadataFetchedAt: { lt: staleBefore } }] }
        : { metadataFetchedAt: null }),
    },
    select: { id: true, productId: true, title: true },
    // NULL-lar əvvəl gəlsin ki, heç vaxt zənginləşdirilməmiş oyunlar prioritet olsun.
    orderBy: { metadataFetchedAt: { sort: "asc", nulls: "first" } },
    take: LIMIT,
  });
}

async function main() {
  const targets = await selectTargets();
  console.log(
    `Zənginləşdiriləcək oyun: ${targets.length}${DRY_RUN ? " (dry-run)" : ""}` +
      ` | konkurensiya: ${CONCURRENCY}`
  );
  if (targets.length === 0) return;

  let done = 0;
  let enriched = 0;
  let empty = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const game = targets[cursor++];
      const meta = await fetchMetadata(game.productId);
      done++;

      if (meta === null) {
        failed++;
        // metadataFetchedAt TOXUNULMUR → növbəti işləmədə yenidən cəhd olunur.
      } else if (isMetadataEmpty(meta)) {
        empty++;
        // Səhifə açıldı, amma məlumat yoxdur (silinmiş/regional məhsul).
        // Vaxt möhürünü yazırıq ki, hər dəfə eyni boş səhifəni çəkməyək.
        if (!DRY_RUN) {
          await prisma.game
            .update({
              where: { id: game.id },
              data: { metadataFetchedAt: new Date() },
            })
            .catch(() => {});
        }
      } else {
        enriched++;
        if (DRY_RUN) {
          console.log(
            `  ${game.title.slice(0, 45).padEnd(45)} | ${meta.genres.join(", ") || "-"}` +
              ` | ${meta.publisherName ?? "-"} | ${meta.psRatingAvg ?? "-"}★`
          );
        } else {
          // YALNIZ dolu sahələr yazılır — boş dəyər mövcud datanı silməməlidir
          // (məs. səhifə müvəqqəti natamam render olunubsa).
          await prisma.game
            .update({
              where: { id: game.id },
              data: {
                ...(meta.descriptionShort ? { descriptionShort: meta.descriptionShort } : {}),
                ...(meta.descriptionLong ? { descriptionLong: meta.descriptionLong } : {}),
                ...(meta.publisherName ? { publisherName: meta.publisherName } : {}),
                ...(meta.releaseDate ? { releaseDate: meta.releaseDate } : {}),
                ...(meta.genres.length > 0 ? { genres: meta.genres } : {}),
                ...(meta.contentRating ? { contentRating: meta.contentRating } : {}),
                ...(meta.psRatingAvg != null
                  ? { psRatingAvg: meta.psRatingAvg, psRatingCount: meta.psRatingCount }
                  : {}),
                metadataFetchedAt: new Date(),
              },
            })
            .catch((e) => {
              failed++;
              enriched--;
              console.error(`  update uğursuz ${game.productId}:`, e.message);
            });
        }
      }

      if (done % 25 === 0 || done === targets.length) {
        console.log(
          `${done}/${targets.length} | zənginləşdi: ${enriched}, boş: ${empty}, xəta: ${failed}`
        );
      }
      await sleep(DELAY_MS);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker)
  );

  console.log(
    `\nBitdi. Zənginləşdi: ${enriched}, boş: ${empty}, xəta: ${failed} (xətalar növbəti işləmədə təkrar cəhd olunacaq)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
