/**
 * /admin/streaming görünüş modeli — API cavabını "xidmət → rejim → plan → paketlər" ağacına çevirir.
 * Saf modul: yalnız client-safe importlar.
 */
import { getServiceVariantConfig } from "@/lib/streamingVariants";
import { STREAMING_GROUPS } from "@/lib/streamingGroups";
import {
  getPublicStreamingSlug,
  isLockedStreamingGroup,
  parseStreamingFeatures,
  resolvePlatformGroup,
  type StreamingAccessMode,
  type StreamingFeature,
} from "@/lib/streamingAccess";
import { NETFLIX_STORE_PATH } from "@/lib/storeScope";

export type AdminPlatform = {
  id: string;
  code: string;
  slug: string;
  label: string;
  category: string;
  tagline: string;
  description: string;
  heroImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  parentCode: string | null;
  accessMode: string | null;
  tierName: string;
  features: unknown;
  devices: string[];
  vpnRequired: boolean;
  storeSellable: boolean;
};

export type AdminProduct = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
};

export type AdminStock = {
  id: string;
  platformCode: string;
  mail: string;
  password: string;
  cabinetName: string;
  pinCode: string;
  isUsed: boolean;
  note: string | null;
  createdAt: string;
  usedAt: string | null;
};

export type ProductMeta = {
  service: string;
  variantSlug: string;
  durationMonths: number;
  seats: number;
  originalPriceAznCents: number | null;
  devices: string[];
  vpnRequired: boolean;
  platformImageUrl: string;
};

export function readProductMeta(p: AdminProduct): ProductMeta {
  const m = p.metadata ?? {};
  const opc = Number(m.originalPriceAznCents);
  return {
    service: String(m.service ?? "").toUpperCase(),
    variantSlug: typeof m.variantSlug === "string" ? m.variantSlug.trim() : "",
    durationMonths: Number(m.durationMonths ?? 0),
    seats: Number(m.seats ?? 1) || 1,
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    devices: Array.isArray(m.devices) ? (m.devices as unknown[]).filter((x): x is string => typeof x === "string") : [],
    vpnRequired: Boolean(m.vpnRequired),
    platformImageUrl: typeof m.platformImageUrl === "string" ? m.platformImageUrl.trim() : "",
  };
}

export type TierView = {
  /** React açarı + seçim: `${code}|${variantSlug}`. */
  key: string;
  platform: AdminPlatform;
  code: string;
  /** Yalnız Netflix hesab planlarında (kod variantı) dolu. */
  variantSlug: string;
  name: string;
  mode: StreamingAccessMode;
  features: StreamingFeature[];
  /** Plan məlumatı (ad, bulletlər) koddadır — admin yalnız qiymət / cihaz / stok dəyişir. */
  locked: boolean;
  /** Kod variantıdır (Netflix hesab Basic/Standart/Premium) — plan sətri üç karta bölünür. */
  isCodeVariant: boolean;
  products: AdminProduct[];
  activeCount: number;
  seats: number[];
  devices: string[];
  vpnRequired: boolean;
  stock: AdminStock[];
};

export type ServiceView = {
  platform: AdminPlatform;
  code: string;
  label: string;
  locked: boolean;
  /** Saytda satılır (Netflix koda görə həmişə). */
  sellable: boolean;
  storePath: string;
  imageUrl: string | null;
  personal: TierView[];
  shared: TierView[];
  /** Üst xidmətin öz (rejimsiz) paketləri — köhnə quruluş. */
  legacy: TierView | null;
  activeCount: number;
};

const NETFLIX_CHILD_BY_SLUG = new Map(
  (STREAMING_GROUPS.netflix?.children ?? []).map((c) => [c.platformSlug, c]),
);

function accessFromProducts(products: AdminProduct[], platform: AdminPlatform) {
  const metas = products.map(readProductMeta);
  if (metas.length === 0) return { devices: platform.devices ?? [], vpnRequired: Boolean(platform.vpnRequired) };
  return {
    devices: metas.find((m) => m.devices.length > 0)?.devices ?? [],
    vpnRequired: metas.some((m) => m.vpnRequired),
  };
}

function makeTier(params: {
  platform: AdminPlatform;
  mode: StreamingAccessMode;
  variantSlug: string;
  name: string;
  features: StreamingFeature[];
  locked: boolean;
  isCodeVariant: boolean;
  products: AdminProduct[];
  stock: AdminStock[];
}): TierView {
  const { platform, mode, variantSlug, products } = params;
  const sorted = [...products].sort((a, b) => {
    const ma = readProductMeta(a);
    const mb = readProductMeta(b);
    return ma.durationMonths - mb.durationMonths || ma.seats - mb.seats;
  });
  const access = accessFromProducts(products, platform);
  return {
    key: `${platform.code}|${variantSlug}`,
    platform,
    code: platform.code,
    variantSlug,
    name: params.name,
    mode,
    features: params.features,
    locked: params.locked,
    isCodeVariant: params.isCodeVariant,
    products: sorted,
    activeCount: products.filter((p) => p.isActive).length,
    seats: mode === "PERSONAL" ? [1] : [1, 2],
    devices: access.devices,
    vpnRequired: access.vpnRequired,
    stock: params.stock,
  };
}

/** Bir platformanın plan kartları (Netflix hesab platforması 3 kod variantına bölünür). */
function tiersOf(platform: AdminPlatform, mode: StreamingAccessMode, products: AdminProduct[], stock: AdminStock[]): TierView[] {
  const own = products.filter((p) => readProductMeta(p).service === platform.code);
  const locked = isLockedStreamingGroup(resolvePlatformGroup(platform).parentCode);
  const variantCfg = getServiceVariantConfig(platform.code);
  if (variantCfg) {
    return variantCfg.variants.map((v) =>
      makeTier({
        platform,
        mode,
        variantSlug: v.slug,
        name: v.name,
        features: v.features,
        locked: true,
        isCodeVariant: true,
        products: own.filter((p) => readProductMeta(p).variantSlug === v.slug),
        stock: [],
      }),
    );
  }
  const netflixChild = locked ? NETFLIX_CHILD_BY_SLUG.get(platform.slug) : undefined;
  const dbFeatures = parseStreamingFeatures(platform.features);
  return [
    makeTier({
      platform,
      mode,
      variantSlug: "",
      name: platform.tierName?.trim() || netflixChild?.name || platform.label,
      features: dbFeatures.length ? dbFeatures : netflixChild?.features ?? [],
      locked,
      isCodeVariant: false,
      products: own,
      stock: mode === "SHARED" ? stock.filter((s) => s.platformCode === platform.code) : [],
    }),
  ];
}

export function buildServiceViews(
  platforms: AdminPlatform[],
  products: AdminProduct[],
  stock: AdminStock[],
): ServiceView[] {
  // MUSIC platformaları (YouTube Premium, Spotify) /admin/music-dədir.
  const streaming = platforms.filter((p) => p.category !== "MUSIC");
  const codes = new Set(streaming.map((p) => p.code));
  const isTop = (p: AdminPlatform) => {
    const parent = resolvePlatformGroup(p).parentCode;
    // Üst xidməti silinmiş "yetim" plan itməsin — öz başına xidmət kimi göstərilir.
    return !parent || !codes.has(parent);
  };

  return streaming
    .filter(isTop)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((platform) => {
      const children = streaming
        .filter((c) => !isTop(c) && resolvePlatformGroup(c).parentCode === platform.code)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
      const personal = children
        .filter((c) => resolvePlatformGroup(c).accessMode === "PERSONAL")
        .flatMap((c) => tiersOf(c, "PERSONAL", products, stock));
      const shared = children
        .filter((c) => resolvePlatformGroup(c).accessMode === "SHARED")
        .flatMap((c) => tiersOf(c, "SHARED", products, stock));

      const ownProducts = products.filter((p) => readProductMeta(p).service === platform.code);
      const legacy =
        ownProducts.length > 0
          ? makeTier({
              platform,
              mode: "SHARED",
              variantSlug: "",
              name: "Rejimsiz paketlər",
              features: [],
              locked: false,
              isCodeVariant: false,
              products: ownProducts,
              stock: stock.filter((s) => s.platformCode === platform.code),
            })
          : null;

      const locked = isLockedStreamingGroup(platform.code);
      const groupProducts = [...personal, ...shared].flatMap((t) => t.products).concat(ownProducts);
      const imageUrl =
        platform.heroImageUrl ||
        groupProducts.map((p) => readProductMeta(p).platformImageUrl).find(Boolean) ||
        groupProducts.find((p) => p.imageUrl)?.imageUrl ||
        null;

      return {
        platform,
        code: platform.code,
        label: platform.label,
        locked,
        sellable: locked || platform.storeSellable,
        storePath: locked ? NETFLIX_STORE_PATH : `/streaming/${getPublicStreamingSlug(platform.slug)}`,
        imageUrl,
        personal,
        shared,
        legacy,
        activeCount: groupProducts.filter((p) => p.isActive).length,
      };
    });
}

export function formatAzn(cents: number): string {
  return (cents / 100).toFixed(2);
}
