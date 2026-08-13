/**
 * Kataloqdakı **concept** sətirlərini satıla bilən SKU-lara çevirir.
 *
 * PS Store kateqoriya hub-ları oyunları concept kimi qaytarır (id sırf rəqəm:
 * `230079`), axtarış səhifəsi isə SKU kimi (`EP9000-PPSA15508_00-…`). Skreyper
 * uzun müddət hər ikisini eyni `Game` cədvəlinə yazıb. Nəticə:
 *
 *   • `/tr-tr/product/230079` → 302 ana səhifəyə (vitrində və admin sifariş
 *     panelində ölü link);
 *   • `platform` NULL — kartda PS4/PS5 çipi yoxdur;
 *   • eyni oyun həm concept, həm SKU sətri kimi **iki dəfə** görünür;
 *   • ən pisi: **ad concept-in, qiymət default SKU-nun** olur. `Concept:230079`
 *     adı "The Last of Us™ Part II", `defaultProduct`-u isə Part II
 *     **Remastered** — yəni vitrində olmayan bir "Part II −40%" məhsulu.
 *
 * Skreyper artıq concept-i upsert-dən əvvəl çevirir (Phase 2.4), amma KÖHNƏ
 * sətirlər qalıb. Bu skript onları bir dəfəlik düzəldir. İdempotentdir.
 *
 * İki yol var:
 *
 *   A) Həll olunan SKU **artıq kataloqdadır** → concept sətri dublikatdır.
 *      `isActive: false` edilir (SİLİNMİR: `Favorite`, `GamePriceWatch`,
 *      `LootBoxItem`, `GameBundleItem`, `CollectionGame`, `GameReview`
 *      cascade ilə uçardı, `Transaction.gameId` isə köhnə sifarişlərdə
 *      NULL-a düşərdi). İstifadəçi favoritləri və qiymət izləmələri əsl SKU
 *      sətrinə **köçürülür**.
 *
 *   B) SKU kataloqda YOXDUR → concept sətrinin özü yenilənir (`productId`,
 *      `title`, `platform`, `productUrl`). `Game.id` dəyişmədiyi üçün bütün
 *      əlaqələr yerində qalır.
 *
 * İşə salmaq:
 *   npm run fix:concepts -- --dry-run     # yalnız hesabat, yazmır
 *   npm run fix:concepts                  # tətbiq et
 *   npm run fix:concepts -- --limit 50    # kiçik partiya ilə sına
 *
 * ⚠️ Serverdə `DIRECT_URL` `127.0.0.1:5433`-ə baxmalıdır — `db:5432` Docker-in
 * daxili adıdır (host-dan həll olunmur), `localhost:5432` isə BAŞQA layihənin
 * bazasıdır.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  fetchConceptDefaultProduct,
  isConceptProductId,
  psStoreProductUrl,
} from "../lib/psStoreConcept";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i === -1) return Infinity;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

const CONCURRENCY = 6;

/** `resolvePlatform`-un skreyperdəki məntiqi — SKU kodundan platformanı çıxarır. */
function platformFromSku(sku: string): string | null {
  if (sku.includes("PPSA")) return "PS5";
  if (sku.includes("CUSA")) return "PS4";
  return null;
}

type Row = {
  id: string;
  productId: string;
  title: string;
  isActive: boolean;
};

type Outcome =
  | { kind: "UNRESOLVED"; row: Row }
  | { kind: "DUPLICATE"; row: Row; sku: string; skuTitle: string; targetId: string }
  | { kind: "RENAMED"; row: Row; sku: string; newTitle: string };

async function main() {
  const all = await prisma.game.findMany({
    where: { store: "PS" },
    select: { id: true, productId: true, title: true, isActive: true },
  });
  const concepts = all
    .filter((g) => isConceptProductId(g.productId))
    .slice(0, LIMIT === Infinity ? undefined : LIMIT);

  console.log(
    `${all.length} PS sətri, bunlardan ${concepts.length} concept sətri emal olunacaq` +
      (DRY_RUN ? "  [DRY RUN — yazılmayacaq]" : "")
  );
  if (concepts.length === 0) {
    console.log("Concept sətri yoxdur — heç nə edilmədi.");
    return;
  }

  // Keşdən oxu ki, təkrar işə salmada eyni səhifələr yenidən çəkilməsin.
  // Cədvəl yoxdursa (miqrasiya hələ tətbiq olunmayıb) skript dayanmır —
  // sadəcə hər concept şəbəkədən çəkilir. Xəbərdarlıq göz deşən olsun ki,
  // buraxılmış miqrasiya səssiz qalmasın.
  let cacheAvailable = true;
  const cached = new Map<string, { productId: string | null; productTitle: string | null }>(
    (
      await prisma.psStoreConcept
        .findMany({
          where: { conceptId: { in: concepts.map((c) => c.productId) } },
        })
        .catch((e) => {
          cacheAvailable = false;
          console.warn(
            `\n⚠️  PsStoreConcept cədvəli oxunmadı (${
              e?.code ?? "xəta"
            }) — keşsiz davam edilir.\n` +
              `   Miqrasiyanı işlət: npx prisma migrate deploy\n`
          );
          return [];
        })
    ).map((r) => [r.conceptId, { productId: r.productId, productTitle: r.productTitle }])
  );

  const outcomes: Outcome[] = [];
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= concepts.length) return;
      const row = concepts[idx];

      const hitCache = cached.get(row.productId);
      let sku: string | null;
      let skuTitle: string | null;

      if (hitCache?.productId) {
        // Keşdə həm SKU, həm ADI var — şəbəkəyə çıxmağa ehtiyac yoxdur.
        sku = hitCache.productId;
        skuTitle = hitCache.productTitle;
      } else {
        const hit = await fetchConceptDefaultProduct(row.productId);
        sku = hit?.productId ?? null;
        skuTitle = hit?.title ?? null;
        if (!DRY_RUN && cacheAvailable) {
          await prisma.psStoreConcept
            .upsert({
              where: { conceptId: row.productId },
              create: {
                conceptId: row.productId,
                productId: sku,
                productTitle: skuTitle,
              },
              update: {
                productId: sku,
                productTitle: skuTitle,
                attemptedAt: new Date(),
                attempts: { increment: 1 },
              },
            })
            .catch((e) => console.error("keş yazıla bilmədi", row.productId, e));
        }
      }

      done++;
      if (done % 25 === 0 || done === concepts.length) {
        process.stdout.write(`\r  çözülür: ${done}/${concepts.length}`);
      }

      if (!sku) {
        outcomes.push({ kind: "UNRESOLVED", row });
        continue;
      }

      const existing = all.find((g) => g.productId === sku && g.id !== row.id);
      if (existing) {
        outcomes.push({
          kind: "DUPLICATE",
          row,
          sku,
          skuTitle: existing.title,
          targetId: existing.id,
        });
      } else {
        outcomes.push({ kind: "RENAMED", row, sku, newTitle: skuTitle ?? row.title });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, concepts.length) }, () => worker())
  );
  process.stdout.write("\n");

  const dupes = outcomes.filter((o): o is Extract<Outcome, { kind: "DUPLICATE" }> => o.kind === "DUPLICATE");
  const renames = outcomes.filter((o): o is Extract<Outcome, { kind: "RENAMED" }> => o.kind === "RENAMED");
  const unresolved = outcomes.filter((o) => o.kind === "UNRESOLVED");

  console.log(`\nNəticə:`);
  console.log(`  dublikat (deaktiv ediləcək)      : ${dupes.length}`);
  console.log(`  SKU-ya çevriləcək (yerində)      : ${renames.length}`);
  console.log(`  həll olunmadı (toxunulmur)       : ${unresolved.length}`);

  const retitled = renames.filter((r) => r.newTitle !== r.row.title);
  if (retitled.length > 0) {
    console.log(`\n  Adı da dəyişənlər (${retitled.length}) — nümunə:`);
    for (const r of retitled.slice(0, 10)) {
      console.log(`    ${r.row.productId}  "${r.row.title}"  →  "${r.newTitle}"`);
    }
  }
  if (dupes.length > 0) {
    console.log(`\n  Dublikat nümunələri:`);
    for (const d of dupes.slice(0, 10)) {
      console.log(`    ${d.row.productId} "${d.row.title}"  ⇒ mövcud ${d.sku} "${d.skuTitle}"`);
    }
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] heç nə yazılmadı.");
    return;
  }

  // ── Tətbiq ────────────────────────────────────────────────────────────────
  let deactivated = 0;
  let movedFavorites = 0;
  let movedWatches = 0;
  let renamed = 0;
  let errors = 0;

  for (const d of dupes) {
    try {
      // Favoritləri əsl SKU sətrinə köçür — istifadəçi siyahısından oyun
      // yoxa çıxmasın. Hədəfdə eyni istifadəçi artıq varsa köhnə sətir
      // sadəcə silinir (`@@id([userId, gameId])` toqquşmasın).
      const favs = await prisma.favorite.findMany({ where: { gameId: d.row.id } });
      for (const f of favs) {
        const exists = await prisma.favorite.findUnique({
          where: { userId_gameId: { userId: f.userId, gameId: d.targetId } },
        });
        if (!exists) {
          await prisma.favorite.create({
            data: { userId: f.userId, gameId: d.targetId, createdAt: f.createdAt },
          });
          movedFavorites++;
        }
        await prisma.favorite.delete({
          where: { userId_gameId: { userId: f.userId, gameId: d.row.id } },
        });
      }

      const watches = await prisma.gamePriceWatch.findMany({
        where: { gameId: d.row.id },
      });
      for (const w of watches) {
        const exists = await prisma.gamePriceWatch.findUnique({
          where: { phone_gameId: { phone: w.phone, gameId: d.targetId } },
        });
        if (!exists) {
          await prisma.gamePriceWatch.update({
            where: { id: w.id },
            data: { gameId: d.targetId },
          });
          movedWatches++;
        }
      }

      await prisma.game.update({
        where: { id: d.row.id },
        data: { isActive: false },
      });
      deactivated++;
    } catch (e) {
      errors++;
      console.error(`  ✗ dublikat ${d.row.productId}:`, e);
    }
  }

  for (const r of renames) {
    try {
      await prisma.game.update({
        where: { id: r.row.id },
        data: {
          productId: r.sku,
          title: r.newTitle,
          platform: platformFromSku(r.sku),
          productUrl: psStoreProductUrl(r.sku),
          // Ad dəyişdiyi üçün semantik vektor köhnəlir; hash-i sıfırlamaq
          // növbəti skreypdə yenidən embed olunmasını təmin edir.
          embeddingHash: null,
        },
      });
      renamed++;
    } catch (e) {
      errors++;
      console.error(`  ✗ çevirmə ${r.row.productId} → ${r.sku}:`, e);
    }
  }

  console.log(`\nYazıldı:`);
  console.log(`  deaktiv edilən dublikat : ${deactivated}`);
  console.log(`  köçürülən favorit       : ${movedFavorites}`);
  console.log(`  köçürülən qiymət izləmə : ${movedWatches}`);
  console.log(`  SKU-ya çevrilən sətir   : ${renamed}`);
  console.log(`  xəta                    : ${errors}`);
  console.log(
    `\n⚠️ Vitrin keşini sıfırlamağı unutma (admin panelindən revalidate və ya növbəti skreyp).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
