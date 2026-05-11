import { prisma } from "@/lib/prisma";
import type { PricingSettings } from "@/lib/pricing";
import { getSettings } from "@/lib/pricing";
import {
  PLATFORM_CATEGORY_LABELS,
  isValidPlatformCategory,
  type PlatformCategory,
} from "@/lib/platformSubscriptions";
import { STREAMING_SERVICE_META } from "@/lib/streamingCart";

export type ReferralCalculatorCategory =
  | "PLAYSTATION"
  | "STREAMING"
  | "MUSIC"
  | "AI"
  | "WORK";

export type ReferralCalculatorOption = {
  id: string;
  category: ReferralCalculatorCategory;
  categoryLabel: string;
  platformLabel: string;
  ratePct: number;
  active: boolean;
};

type ServiceProductRow = {
  id: string;
  title: string;
  metadata: unknown;
};

const CATEGORY_LABELS: Record<ReferralCalculatorCategory, string> = {
  PLAYSTATION: "PlayStation",
  STREAMING: "Yayım Platformaları",
  MUSIC: "Musiqi Platformaları",
  AI: "Süni İntellekt",
  WORK: "İş Platformaları",
};

function metadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function roundPct(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

export function computeGameReferralRatePct(settings: PricingSettings) {
  return roundPct(settings.referralGamesPct);
}

export function readReferralRateFromMeta(
  metadata: unknown,
  fallbackPct: number,
) {
  const meta = metadataObject(metadata);
  if (meta.referralEnabled === false) return 0;

  const pct = Number(meta.referralPct);
  if (Number.isFinite(pct) && pct >= 0) return roundPct(Math.min(100, pct));

  return roundPct(fallbackPct);
}

function serviceLabel(service: string) {
  const normalized = service.toUpperCase();
  const known = STREAMING_SERVICE_META[normalized as keyof typeof STREAMING_SERVICE_META];
  if (known) return known.label;

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function serviceCategory(service: string): ReferralCalculatorCategory {
  const known = STREAMING_SERVICE_META[service as keyof typeof STREAMING_SERVICE_META];
  return known?.category === "MUSIC" ? "MUSIC" : "STREAMING";
}

function platformCategory(raw: unknown): PlatformCategory | null {
  const value = String(raw ?? "");
  return isValidPlatformCategory(value) ? value : null;
}

export async function getReferralCalculatorOptions(): Promise<ReferralCalculatorOption[]> {
  const [settings, streamingProducts, platformProducts] = await Promise.all([
    getSettings(),
    prisma.serviceProduct.findMany({
      where: { type: "STREAMING", isActive: true },
      select: { id: true, title: true, metadata: true },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    prisma.serviceProduct.findMany({
      where: { type: "PLATFORM", isActive: true },
      select: { id: true, title: true, metadata: true },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
  ]);

  const psStoreOptions: Array<{ id: string; label: string; ratePct: number }> = [
    { id: "ps-store:games", label: "Oyunlar", ratePct: computeGameReferralRatePct(settings) },
    { id: "ps-store:ps-plus", label: "PS Plus", ratePct: settings.referralPsPlusPct },
    { id: "ps-store:gift-cards", label: "Gift Card", ratePct: settings.referralGiftCardsPct },
    {
      id: "ps-store:account-creation",
      label: "Hesab açma",
      ratePct: settings.referralAccountCreationPct,
    },
  ];

  const options: ReferralCalculatorOption[] = psStoreOptions.map((option) => ({
    id: option.id,
    category: "PLAYSTATION",
    categoryLabel: CATEGORY_LABELS.PLAYSTATION,
    platformLabel: option.label,
    ratePct: roundPct(option.ratePct),
    active: true,
  }));

  const streamingByService = new Map<string, ServiceProductRow>();
  for (const product of streamingProducts) {
    const meta = metadataObject(product.metadata);
    const service = String(meta.service ?? "").toUpperCase();
    if (!service || streamingByService.has(service)) continue;
    streamingByService.set(service, product);
  }

  for (const [service, product] of streamingByService) {
    const category = serviceCategory(service);
    options.push({
      id: `streaming:${service}`,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      platformLabel: serviceLabel(service),
      ratePct: readReferralRateFromMeta(product.metadata, 0),
      active: true,
    });
  }

  for (const product of platformProducts) {
    const meta = metadataObject(product.metadata);
    const category = platformCategory(meta.category);
    if (!category) continue;
    options.push({
      id: `platform:${product.id}`,
      category,
      categoryLabel: PLATFORM_CATEGORY_LABELS[category],
      platformLabel: product.title,
      ratePct: readReferralRateFromMeta(product.metadata, 0),
      active: true,
    });
  }

  return options;
}
