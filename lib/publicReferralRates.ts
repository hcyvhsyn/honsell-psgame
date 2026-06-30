import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/pricing";
import { PLATFORM_CATEGORY_LABELS, isValidPlatformCategory } from "@/lib/platformSubscriptions";
import { STREAMING_SERVICE_META } from "@/lib/streamingCart";
import { STREAMING_VARIANTS } from "@/lib/streamingVariants";

/**
 * PS Store kateqoriya referal faizləri (standart seqment) — KEŞLƏNMİŞ.
 * Root layout hər route-da istifadə edir; keşsiz DB sorğusu bütün səhifələri
 * dinamikləşdirərdi. `site-header` tag-ı ilə keşlənir (admin default-tier save
 * onu artıq revalidate edir) + saatlıq fallback.
 */
export const getReferralCategoryRatesCached = unstable_cache(
  async () => {
    const s = await getSettings();
    return {
      games: s.referralGamesPct,
      psPlus: s.referralPsPlusPct,
      giftCards: s.referralGiftCardsPct,
      accountCreation: s.referralAccountCreationPct,
    };
  },
  ["referral-category-rates-v1"],
  { tags: ["site-header"], revalidate: 3600 },
);

/**
 * Müştəriyə görünən TAM referal faiz siyahısı (standart "Adi" seqment) — 0 daxil.
 * Komissiya `ReferralRate` (default tier) cədvəlindən oxunur; sətir yoxdursa
 * metadata/Settings fallback. Maya/qazanc burada YOXDUR (yalnız faiz).
 */

export type PublicRateItem = { id: string; label: string; sub: string; pct: number };
export type PublicRateGroup = { key: string; label: string; items: PublicRateItem[] };

function metadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function roundPct(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

/** Streaming xidmət kodu → səliqəli ad. Əvvəl DB (StreamingPlatform), sonra
 *  statik META, sonra title-case fallback. NETFLIX_YANIMDA/EVIMD/EVIMD_VIP kimi
 *  dinamik kodların düzgün adları yalnız DB-də olur. */
export async function getStreamingPlatformLabelMap(): Promise<Map<string, string>> {
  const rows = await prisma.streamingPlatform
    .findMany({ select: { code: true, label: true } })
    .catch(() => [] as { code: string; label: string }[]);
  return new Map(rows.map((r) => [r.code.toUpperCase(), r.label]));
}

export function serviceLabel(service: string, dbLabels?: Map<string, string>) {
  const fromDb = dbLabels?.get(service);
  if (fromDb) return fromDb;
  const known = STREAMING_SERVICE_META[service as keyof typeof STREAMING_SERVICE_META];
  if (known) return known.label;
  return service
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function variantLabel(service: string, variantSlug: string): string {
  if (!variantSlug) return "";
  const cfg = STREAMING_VARIANTS[service];
  return cfg?.variants.find((v) => v.slug === variantSlug)?.name ?? variantSlug;
}

export type PublicTierOption = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  icon: string | null;
};

/**
 * Public referal səhifəsində faizlərinə baxıla bilən xüsusi (MANUAL) seqmentlər —
 * Ambassador kimi. Daxili "sponsorlu" statusu kənarda saxlanılır.
 */
export type PublicTierView = {
  key: string;
  label: string;
  icon: string | null;
  groups: PublicRateGroup[];
};

/**
 * Public referal səhifəsi üçün bütün görünüşlər: Standart (default seqment) +
 * hər Ambassador seqmenti. Hər biri öz effektiv faizləri ilə.
 */
export async function getPublicTierViews(): Promise<PublicTierView[]> {
  const [groups, ambassadors] = await Promise.all([
    getPublicReferralRates(),
    getPublicAmbassadorTiers(),
  ]);
  const extra = await Promise.all(
    ambassadors.map(async (t) => ({
      key: t.slug,
      label: t.displayName,
      icon: t.icon,
      groups: await getPublicReferralRates(t.id),
    })),
  );
  return [{ key: "default", label: "Standart", icon: null, groups }, ...extra];
}

export async function getPublicAmbassadorTiers(): Promise<PublicTierOption[]> {
  const rows = await prisma.customerTier
    .findMany({
      where: { kind: "MANUAL", slug: { not: "sponsorlu" } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, displayName: true, icon: true },
    })
    .catch(() => [] as PublicTierOption[]);
  return rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    displayName: t.displayName || t.name,
    icon: t.icon,
  }));
}

/**
 * Müştəriyə görünən faiz siyahısı. `tierId` verilməzsə default (Bronze/standart)
 * seqment; verilərsə həmin seqmentin effektiv faizləri (öz sətiri → default sətiri
 * → metadata fallback) — Ambassador kimi seqmentlərin faizlərinə baxmaq üçün.
 */
export async function getPublicReferralRates(tierId?: string): Promise<PublicRateGroup[]> {
  const defaultTier = await prisma.customerTier
    .findFirst({ where: { isDefault: true }, select: { id: true } })
    .catch(() => null);

  const targetTierId = tierId ?? defaultTier?.id ?? null;
  const tierIds = Array.from(new Set([targetTierId, defaultTier?.id].filter(Boolean) as string[]));

  const [settings, products, rateRows, platformLabels] = await Promise.all([
    getSettings(),
    prisma.serviceProduct.findMany({
      where: { type: { in: ["STREAMING", "PLATFORM"] }, isActive: true },
      select: { id: true, type: true, title: true, metadata: true },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    tierIds.length
      ? prisma.referralRate.findMany({
          where: { tierId: { in: tierIds } },
          select: { tierId: true, targetType: true, serviceProductId: true, ratePct: true, enabled: true },
        })
      : Promise.resolve([]),
    getStreamingPlatformLabelMap(),
  ]);

  // Seçilmiş seqment + default seqment xəritələri (default = fallback).
  const mk = () => ({
    cat: new Map<string, { ratePct: number; enabled: boolean }>(),
    prod: new Map<string, { ratePct: number; enabled: boolean }>(),
  });
  const target = mk();
  const fallback = mk();
  for (const r of rateRows) {
    const dest = r.tierId === targetTierId ? target : fallback;
    if (r.targetType === "SERVICE_PRODUCT") dest.prod.set(r.serviceProductId, r);
    else dest.cat.set(r.targetType, r);
    // default sətirləri fallback-ə də yazılır (targetTierId === default olduqda eyni map).
    if (r.tierId === defaultTier?.id && dest !== fallback) {
      if (r.targetType === "SERVICE_PRODUCT") fallback.prod.set(r.serviceProductId, r);
      else fallback.cat.set(r.targetType, r);
    }
  }
  const catRate = (targetType: string, fb: number) => {
    const row = target.cat.get(targetType) ?? fallback.cat.get(targetType);
    if (!row) return roundPct(fb);
    return row.enabled ? roundPct(Math.min(100, row.ratePct)) : 0;
  };
  const productRate = (id: string, meta: Record<string, unknown>) => {
    const row = target.prod.get(id) ?? fallback.prod.get(id);
    if (row) return row.enabled ? roundPct(Math.min(100, row.ratePct)) : 0;
    if (meta.referralEnabled === false) return 0;
    return roundPct(Number(meta.referralPct) || 0);
  };

  const groups: PublicRateGroup[] = [];

  // PS Store
  groups.push({
    key: "PS_STORE",
    label: "PlayStation Store",
    items: [
      { id: "games", label: "Oyunlar", sub: "PS Store oyun alışları", pct: catRate("PS_GAMES", settings.referralGamesPct) },
      { id: "psplus", label: "PS Plus", sub: "Abunəlik paketləri", pct: catRate("PS_PLUS", settings.referralPsPlusPct) },
      { id: "gift", label: "Gift Card", sub: "TRY hədiyyə kartları", pct: catRate("GIFT_CARDS", settings.referralGiftCardsPct) },
      {
        id: "account",
        label: "Hesab açma",
        sub: "Türkiyə PSN hesabı",
        pct: catRate("ACCOUNT_CREATION", settings.referralAccountCreationPct),
      },
    ],
  });

  // Streaming / platform — qruplaşdırılmış
  const dynamicGroups = new Map<string, PublicRateGroup>();
  for (const p of products) {
    const meta = metadataObject(p.metadata);
    const dur = Number(meta.durationMonths);
    const durTxt = dur > 0 ? `${dur} ay` : "";
    let key = "";
    let groupLabel = "";
    let itemLabel = "";
    let sub = "";
    if (p.type === "STREAMING") {
      const service = String(meta.service ?? "").trim().toUpperCase();
      if (!service) continue;
      key = `STREAMING:${service}`;
      groupLabel = serviceLabel(service, platformLabels);
      // Etiket xam başlıqdan deyil — variant + müddətdən qurulur (başlıqlar qarışıqdır).
      const variant = variantLabel(service, String(meta.variantSlug ?? "").trim());
      itemLabel = [variant, durTxt].filter(Boolean).join(" · ") || p.title;
    } else {
      const category = String(meta.category ?? "");
      if (!isValidPlatformCategory(category)) continue;
      key = `PLATFORM:${category}`;
      groupLabel = PLATFORM_CATEGORY_LABELS[category];
      itemLabel = p.title;
      sub = durTxt;
    }
    const group = dynamicGroups.get(key) ?? { key, label: groupLabel, items: [] };
    group.items.push({ id: p.id, label: itemLabel, sub, pct: productRate(p.id, meta) });
    dynamicGroups.set(key, group);
  }

  return [...groups, ...dynamicGroups.values()];
}
