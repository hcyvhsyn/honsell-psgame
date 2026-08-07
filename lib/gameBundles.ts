/**
 * Oyun paketləri — SERVER tərəfi (DB + qiymət hesablanması).
 *
 * ⚠️ `"use client"` komponent bu faylı import ETMƏMƏLİDİR — `lib/prisma` bundle-a
 * düşür və `next build` sınır. Client tərəf üçün lazım olan hər şey
 * [lib/gameBundleShared.ts](./gameBundleShared.ts)-dədir.
 *
 * Paket qiyməti ÜÇ yerdə lazım olur — vitrin (ana səhifə rail-i + `/paket/[slug]`),
 * `/api/cart/refresh` və `/api/cart/checkout`. Üçü də `computeBundlePricing`
 * çağırır ki, vitrində bir rəqəm, kassada başqa rəqəm çıxmasın.
 */
import { prisma } from "@/lib/prisma";
import { applyFlashDeal, getFlashDealOverrides, type FlashDealOverride } from "@/lib/flashDeals";
import {
  computeDisplayPrice,
  getSettings,
  tryCentsToCostAzn,
  type PricingSettings,
} from "@/lib/pricing";
import {
  allocateBundlePrices,
  clampDiscountPct,
  normalizePricingMode,
  summarizeBundle,
  type BundleCardData,
  type BundleItemPrice,
  type BundlePricing,
} from "@/lib/gameBundleShared";

/** Qiymət hesablanması üçün oyundan lazım olan minimum sahələr (`embedding` YOX). */
export const BUNDLE_GAME_SELECT = {
  id: true,
  slug: true,
  // Slug-ı olmayan köhnə sətirlər üçün detal linki `productId`-yə düşür
  // (`gameDetailHref`).
  productId: true,
  title: true,
  imageUrl: true,
  isActive: true,
  store: true,
  priceTryCents: true,
  discountTryCents: true,
  discountEndAt: true,
  priceUsdCents: true,
  discountUsdCents: true,
} as const;

const BUNDLE_INCLUDE = {
  items: {
    orderBy: { position: "asc" as const },
    include: { game: { select: BUNDLE_GAME_SELECT } },
  },
} as const;

type BundleRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  pricingMode: string;
  discountPct: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  items: {
    gameId: string;
    priceAznCents: number | null;
    game: {
      id: string;
      slug: string | null;
      productId: string;
      title: string;
      imageUrl: string;
      isActive: boolean;
      store: string;
      priceTryCents: number;
      discountTryCents: number | null;
      discountEndAt: Date | null;
      priceUsdCents: number | null;
      discountUsdCents: number | null;
    };
  }[];
};

/**
 * Paket vitrində göstərilə bilərmi.
 *
 * "4-lü paket" 3 oyunla satıla bilməz — tərkibdəki HƏR HANSI oyun deaktivdirsə
 * paket tamamilə gizlənir (admin panelində bunun səbəbi xəbərdarlıq kimi görünür).
 */
export function isBundleSellable(bundle: BundleRow, now = new Date()): boolean {
  if (!bundle.isActive) return false;
  if (bundle.items.length === 0) return false;
  if (bundle.items.some((i) => !i.game.isActive)) return false;
  if (bundle.startsAt && bundle.startsAt.getTime() > now.getTime()) return false;
  if (bundle.endsAt && bundle.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Paketin qiymət cədvəlini qurur.
 *
 * List qiymət checkout-dakı ifadənin EYNİSİ ilə alınır
 * (`applyFlashDeal(computeDisplayPrice(...))`) — yəni flash deal və bitmiş endirim
 * məntiqi təkrarlanmır.
 *
 * `PERCENT` → hədəf cəm largest-remainder ilə oyunlara bölünür (qəpik dəqiqliyi
 * checkout-dakı `Transaction` sətirləri üçün vacibdir).
 * `CUSTOM`  → hər sətrin öz `priceAznCents`-i, list qiymətdən BÖYÜK ola bilməz
 *             (flash-deal "override yalnız aşağı sala bilər" intizamı).
 */
export function computeBundlePricing(
  bundle: BundleRow,
  settings: PricingSettings,
  flashDeals: Map<string, FlashDealOverride>,
): BundlePricing {
  const listCents = bundle.items.map((item) => {
    const price = applyFlashDeal(
      computeDisplayPrice(item.game, settings),
      flashDeals.get(item.game.id),
    );
    return Math.max(0, Math.round(price.finalAzn * 100));
  });

  const mode = normalizePricingMode(bundle.pricingMode);
  const bundleCents =
    mode === "CUSTOM"
      ? bundle.items.map((item, i) =>
          item.priceAznCents != null && item.priceAznCents >= 0
            ? Math.min(Math.round(item.priceAznCents), listCents[i])
            : listCents[i],
        )
      : allocateBundlePrices(listCents, clampDiscountPct(bundle.discountPct));

  const items: BundleItemPrice[] = bundle.items.map((item, i) => ({
    gameId: item.game.id,
    title: item.game.title,
    imageUrl: item.game.imageUrl || null,
    slug: item.game.slug,
    listAznCents: listCents[i],
    bundleAznCents: bundleCents[i],
  }));

  return { items, ...summarizeBundle(items) };
}

function toCardData(bundle: BundleRow, pricing: BundlePricing): BundleCardData {
  return {
    id: bundle.id,
    slug: bundle.slug,
    title: bundle.title,
    subtitle: bundle.subtitle,
    description: bundle.description,
    imageUrl: bundle.imageUrl,
    badgeText: bundle.badgeText,
    pricing,
  };
}

async function priceBundles(bundles: BundleRow[]): Promise<Map<string, BundlePricing>> {
  if (bundles.length === 0) return new Map();
  const gameIds = bundles.flatMap((b) => b.items.map((i) => i.game.id));
  const [settings, flashDeals] = await Promise.all([
    getSettings(),
    getFlashDealOverrides(gameIds),
  ]);
  return new Map(bundles.map((b) => [b.id, computeBundlePricing(b, settings, flashDeals)]));
}

/**
 * Ana səhifə rail-i üçün satıla bilən paketlər (sortOrder ilə).
 *
 * Çağıran tərəf `unstable_cache` ilə `"bundles"` tag-ına bağlayır — burada
 * keşləmə yoxdur ki, checkout kimi dinamik yollar təzə data ala bilsin.
 */
export async function loadActiveBundles(limit = 12): Promise<BundleCardData[]> {
  const rows = (await prisma.gameBundle.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: BUNDLE_INCLUDE,
  })) as unknown as BundleRow[];

  const sellable = rows.filter((b) => isBundleSellable(b)).slice(0, limit);
  const pricing = await priceBundles(sellable);
  return sellable.map((b) => toCardData(b, pricing.get(b.id)!));
}

export type BundleDetail = BundleCardData & {
  /** Detal səhifəsindəki oyun grid-i üçün — oyun səhifəsinə link buradan qurulur. */
  games: {
    id: string;
    slug: string | null;
    productId: string;
    title: string;
    imageUrl: string | null;
  }[];
};

export async function loadBundleBySlug(slug: string): Promise<BundleDetail | null> {
  const row = (await prisma.gameBundle.findUnique({
    where: { slug },
    include: BUNDLE_INCLUDE,
  })) as unknown as BundleRow | null;

  if (!row || !isBundleSellable(row)) return null;

  const pricing = (await priceBundles([row])).get(row.id)!;
  return {
    ...toCardData(row, pricing),
    games: row.items.map((i) => ({
      id: i.game.id,
      slug: i.game.slug,
      productId: i.game.productId,
      title: i.game.title,
      imageUrl: i.game.imageUrl || null,
    })),
  };
}

/** Səbət/checkout üçün: verilmiş id-lərdən paket olanları qiymətli qaytarır. */
export type ResolvedCartBundle = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  pricing: BundlePricing;
};

/**
 * `/api/cart/refresh` və `/api/cart/checkout` üçün ortaq həlledici.
 *
 * Satıla bilməyən paket (deaktiv, vaxtı bitmiş, tərkibində deaktiv oyun) map-ə
 * DÜŞMÜR — çağıran onu səbətdən silinməli/rədd edilməli sətir kimi oxuyur.
 */
export async function resolveBundlesForCart(
  ids: string[],
): Promise<Map<string, ResolvedCartBundle>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const rows = (await prisma.gameBundle.findMany({
    where: { id: { in: unique }, isActive: true },
    include: BUNDLE_INCLUDE,
  })) as unknown as BundleRow[];

  const sellable = rows.filter((b) => isBundleSellable(b));
  const pricing = await priceBundles(sellable);

  return new Map(
    sellable.map((b) => [
      b.id,
      {
        id: b.id,
        slug: b.slug,
        title: b.title,
        imageUrl: b.imageUrl,
        pricing: pricing.get(b.id)!,
      },
    ]),
  );
}

/**
 * Admin paneli üçün: satıla bilməyənlər də daxil BÜTÜN paketlər, qiymət cədvəli
 * və deaktiv oyun xəbərdarlığı ilə.
 */
export type AdminBundle = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  pricingMode: string;
  discountPct: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  pricing: BundlePricing;
  /** Maya dəyəri cəmi (AZN qəpik) — paket zərərlə satılırsa admin görsün. */
  costTotalAznCents: number;
  /** Tərkibində deaktiv oyun olan paket vitrində GÖRÜNMÜR. */
  inactiveGameTitles: string[];
  sellable: boolean;
  items: {
    gameId: string;
    title: string;
    imageUrl: string | null;
    isActive: boolean;
    priceAznCents: number | null;
    listAznCents: number;
    bundleAznCents: number;
  }[];
};

export async function loadAdminBundles(): Promise<AdminBundle[]> {
  const rows = (await prisma.gameBundle.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: BUNDLE_INCLUDE,
  })) as unknown as (BundleRow & { isFeatured: boolean; sortOrder: number })[];

  const gameIds = rows.flatMap((b) => b.items.map((i) => i.game.id));
  const [settings, flashDeals] = await Promise.all([
    getSettings(),
    getFlashDealOverrides(gameIds),
  ]);

  // Maya dəyəri list qiymətdən ayrıca hesablanır (list marja daxil qiymətdir) —
  // checkout-dakı `tryCentsToCostAzn` ifadəsinin eynisi işlədilir.
  return rows.map((b) => {
    const pricing = computeBundlePricing(b, settings, flashDeals);
    const costTotalAznCents = b.items.reduce((sum, item) => {
      const g = item.game;
      const tryForCost =
        g.discountTryCents != null && g.discountTryCents < g.priceTryCents
          ? g.discountTryCents
          : g.priceTryCents;
      return sum + Math.round(tryCentsToCostAzn(tryForCost, settings) * 100);
    }, 0);

    const inactiveGameTitles = b.items.filter((i) => !i.game.isActive).map((i) => i.game.title);

    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle,
      description: b.description,
      imageUrl: b.imageUrl,
      badgeText: b.badgeText,
      pricingMode: normalizePricingMode(b.pricingMode),
      discountPct: b.discountPct,
      isActive: b.isActive,
      isFeatured: b.isFeatured,
      sortOrder: b.sortOrder,
      startsAt: b.startsAt ? b.startsAt.toISOString() : null,
      endsAt: b.endsAt ? b.endsAt.toISOString() : null,
      pricing,
      costTotalAznCents,
      inactiveGameTitles,
      sellable: isBundleSellable(b),
      items: b.items.map((item, i) => ({
        gameId: item.game.id,
        title: item.game.title,
        imageUrl: item.game.imageUrl || null,
        isActive: item.game.isActive,
        priceAznCents: item.priceAznCents,
        listAznCents: pricing.items[i].listAznCents,
        bundleAznCents: pricing.items[i].bundleAznCents,
      })),
    };
  });
}
