/**
 * Xidmət dəstləri — SERVER qatı (DB + qiymət).
 *
 * ⚠️ `"use client"` komponent bu faylı import ETMƏMƏLİDİR — `lib/prisma` bundle-a
 * düşür və `next build` sınır (tsc keçsə də). Client tərəf yalnız
 * [lib/serviceBundleShared.ts](./serviceBundleShared.ts)-dən oxuyur.
 *
 * Qiymət ÜÇ yerdə lazımdır və üçü də `computeServiceBundlePricing`-i çağırır:
 * vitrin rail-i, `/api/cart/refresh`, `/api/cart/checkout`. Oyun paketindən fərqli
 * olaraq burada `computeDisplayPrice`/flash deal YOXDUR — xidmətin list qiyməti
 * birbaşa `ServiceProduct.priceAznCents`-dir.
 */

import { prisma } from "@/lib/prisma";
import {
  canBundleServiceType,
  serviceInputRequirement,
  summarizeServiceBundle,
  type ServiceBundleCardData,
  type ServiceBundleItemPrice,
  type ServiceBundlePricing,
} from "@/lib/serviceBundleShared";

const SERVICE_SELECT = {
  id: true,
  type: true,
  title: true,
  imageUrl: true,
  priceAznCents: true,
  costAznCents: true,
  metadata: true,
  isActive: true,
} as const;

const SERVICE_BUNDLE_INCLUDE = {
  items: {
    orderBy: { position: "asc" as const },
    include: { serviceProduct: { select: SERVICE_SELECT } },
  },
} as const;

type ServiceRow = {
  id: string;
  type: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
  costAznCents: number;
  metadata: unknown;
  isActive: boolean;
};

type ServiceBundleRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  items: {
    serviceProductId: string;
    position: number;
    priceAznCents: number | null;
    serviceProduct: ServiceRow;
  }[];
};

/**
 * Dəst vitrində göstərilə bilərmi.
 *
 * "Netflix + HBO Max" tək Netflix ilə satıla bilməz — üzvlərdən HƏR HANSI biri
 * deaktivdirsə dəst tamamilə gizlənir (admin panelində səbəb xəbərdarlıq kimi görünür).
 */
export function isServiceBundleSellable(bundle: ServiceBundleRow, now = new Date()): boolean {
  if (!bundle.isActive) return false;
  if (bundle.items.length === 0) return false;
  if (bundle.items.some((i) => !i.serviceProduct.isActive)) return false;
  if (bundle.items.some((i) => !canBundleServiceType(i.serviceProduct.type))) return false;
  if (bundle.startsAt && bundle.startsAt.getTime() > now.getTime()) return false;
  if (bundle.endsAt && bundle.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Dəstin qiymət cədvəli.
 *
 * Hər üzvün `priceAznCents`-i list qiymətə clamp olunur — override YALNIZ aşağı
 * sala bilər (flash-deal intizamının eynisi). `null` → xidmətin adi qiyməti.
 */
export function computeServiceBundlePricing(bundle: ServiceBundleRow): ServiceBundlePricing {
  const items: ServiceBundleItemPrice[] = bundle.items.map((item) => {
    const listAznCents = Math.max(0, Math.round(item.serviceProduct.priceAznCents));
    const bundleAznCents =
      item.priceAznCents != null && item.priceAznCents >= 0
        ? Math.min(Math.round(item.priceAznCents), listAznCents)
        : listAznCents;

    return {
      serviceProductId: item.serviceProduct.id,
      title: item.serviceProduct.title,
      imageUrl: item.serviceProduct.imageUrl || null,
      serviceType: item.serviceProduct.type,
      listAznCents,
      bundleAznCents,
      requirement: serviceInputRequirement(item.serviceProduct),
    };
  });

  return { items, ...summarizeServiceBundle(items) };
}

function toCardData(
  bundle: ServiceBundleRow,
  pricing: ServiceBundlePricing,
): ServiceBundleCardData {
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

/**
 * Ana səhifə rail-i üçün satıla bilən dəstlər (sortOrder ilə).
 *
 * Çağıran tərəf `unstable_cache` ilə `"service-bundles"` tag-ına bağlayır — burada
 * keşləmə yoxdur ki, checkout kimi dinamik yollar təzə data ala bilsin.
 */
export async function loadActiveServiceBundles(limit = 12): Promise<ServiceBundleCardData[]> {
  const rows = (await prisma.serviceBundle.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: SERVICE_BUNDLE_INCLUDE,
  })) as unknown as ServiceBundleRow[];

  return rows
    .filter((b) => isServiceBundleSellable(b))
    .slice(0, limit)
    .map((b) => toCardData(b, computeServiceBundlePricing(b)));
}

/** Səbət/checkout üçün: verilmiş id-lərdən dəst olanları qiymətli qaytarır. */
export type ResolvedCartServiceBundle = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  pricing: ServiceBundlePricing;
};

/**
 * `/api/cart/refresh` və `/api/cart/checkout` üçün ortaq həlledici.
 *
 * Satıla bilməyən dəst (deaktiv, vaxtı bitmiş, tərkibində deaktiv xidmət) map-ə
 * DÜŞMÜR — çağıran onu səbətdən silinməli/rədd edilməli sətir kimi oxuyur.
 */
export async function resolveServiceBundlesForCart(
  ids: string[],
): Promise<Map<string, ResolvedCartServiceBundle>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const rows = (await prisma.serviceBundle.findMany({
    where: { id: { in: unique }, isActive: true },
    include: SERVICE_BUNDLE_INCLUDE,
  })) as unknown as ServiceBundleRow[];

  return new Map(
    rows
      .filter((b) => isServiceBundleSellable(b))
      .map((b) => [
        b.id,
        {
          id: b.id,
          slug: b.slug,
          title: b.title,
          imageUrl: b.imageUrl,
          pricing: computeServiceBundlePricing(b),
        },
      ]),
  );
}

/**
 * Admin paneli üçün: satıla bilməyənlər də daxil BÜTÜN dəstlər, qiymət cədvəli
 * və deaktiv xidmət xəbərdarlığı ilə.
 */
export type AdminServiceBundle = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  badgeText: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  pricing: ServiceBundlePricing;
  /** Maya dəyəri cəmi (AZN qəpik) — dəst zərərlə satılırsa admin görsün. */
  costTotalAznCents: number;
  /** Tərkibində deaktiv (və ya dəstə salına bilməyən) xidmət olan dəst GÖRÜNMÜR. */
  blockedServiceTitles: string[];
  sellable: boolean;
  items: {
    serviceProductId: string;
    title: string;
    imageUrl: string | null;
    serviceType: string;
    isActive: boolean;
    priceAznCents: number | null;
    listAznCents: number;
    bundleAznCents: number;
    requirementKind: string;
  }[];
};

export async function loadAdminServiceBundles(): Promise<AdminServiceBundle[]> {
  const rows = (await prisma.serviceBundle.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: SERVICE_BUNDLE_INCLUDE,
  })) as unknown as ServiceBundleRow[];

  return rows.map((b) => {
    const pricing = computeServiceBundlePricing(b);
    const costTotalAznCents = b.items.reduce(
      (sum, item) => sum + Math.max(0, Math.round(item.serviceProduct.costAznCents)),
      0,
    );
    const blockedServiceTitles = b.items
      .filter((i) => !i.serviceProduct.isActive || !canBundleServiceType(i.serviceProduct.type))
      .map((i) => i.serviceProduct.title);

    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle,
      description: b.description,
      imageUrl: b.imageUrl,
      badgeText: b.badgeText,
      isActive: b.isActive,
      isFeatured: b.isFeatured,
      sortOrder: b.sortOrder,
      startsAt: b.startsAt ? b.startsAt.toISOString() : null,
      endsAt: b.endsAt ? b.endsAt.toISOString() : null,
      pricing,
      costTotalAznCents,
      blockedServiceTitles,
      sellable: isServiceBundleSellable(b),
      items: b.items.map((item, i) => ({
        serviceProductId: item.serviceProduct.id,
        title: item.serviceProduct.title,
        imageUrl: item.serviceProduct.imageUrl || null,
        serviceType: item.serviceProduct.type,
        isActive: item.serviceProduct.isActive,
        priceAznCents: item.priceAznCents,
        listAznCents: pricing.items[i].listAznCents,
        bundleAznCents: pricing.items[i].bundleAznCents,
        requirementKind: pricing.items[i].requirement.kind,
      })),
    };
  });
}

/** Admin seçicisi üçün: dəstə salına bilən bütün AKTİV xidmətlər. */
export async function loadBundleableServices() {
  const rows = await prisma.serviceProduct.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
    select: SERVICE_SELECT,
  });

  return rows
    .filter((s) => canBundleServiceType(s.type))
    .map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      imageUrl: s.imageUrl || null,
      priceAznCents: s.priceAznCents,
      requirementKind: serviceInputRequirement(s).kind,
    }));
}
