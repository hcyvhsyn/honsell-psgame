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

export async function getPublicReferralRates(): Promise<PublicRateGroup[]> {
  const defaultTier = await prisma.customerTier
    .findFirst({ where: { isDefault: true }, select: { id: true } })
    .catch(() => null);

  const [settings, products, rateRows, platformLabels] = await Promise.all([
    getSettings(),
    prisma.serviceProduct.findMany({
      where: { type: { in: ["STREAMING", "PLATFORM"] }, isActive: true },
      select: { id: true, type: true, title: true, metadata: true },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    defaultTier
      ? prisma.referralRate.findMany({
          where: { tierId: defaultTier.id },
          select: { targetType: true, serviceProductId: true, ratePct: true, enabled: true },
        })
      : Promise.resolve([]),
    getStreamingPlatformLabelMap(),
  ]);

  const byCategory = new Map<string, { ratePct: number; enabled: boolean }>();
  const byProduct = new Map<string, { ratePct: number; enabled: boolean }>();
  for (const r of rateRows) {
    if (r.targetType === "SERVICE_PRODUCT") byProduct.set(r.serviceProductId, r);
    else byCategory.set(r.targetType, r);
  }
  const catRate = (targetType: string, fallback: number) => {
    const row = byCategory.get(targetType);
    if (!row) return roundPct(fallback);
    return row.enabled ? roundPct(Math.min(100, row.ratePct)) : 0;
  };
  const productRate = (id: string, meta: Record<string, unknown>) => {
    const row = byProduct.get(id);
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
