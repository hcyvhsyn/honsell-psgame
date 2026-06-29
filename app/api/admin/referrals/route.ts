import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/pricing";
import {
  PLATFORM_CATEGORY_LABELS,
  PLATFORM_CATEGORY_PUBLIC_PATH,
  isValidPlatformCategory,
  type PlatformCategory,
} from "@/lib/platformSubscriptions";
import { STREAMING_SERVICE_META } from "@/lib/streamingCart";
import { STREAMING_VARIANTS } from "@/lib/streamingVariants";
import { getStreamingPlatformLabelMap } from "@/lib/publicReferralRates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Referal faizlərinin TƏK idarə nöqtəsi — müştəri seqmenti (CustomerTier) üzrə.
 *
 * Həqiqət mənbəyi = `ReferralRate` cədvəli (tier × hədəf). Real komissiya
 * `resolveReferralRatePct()` ilə oradan oxunur. Admin seqment seçir, həmin seqmentin
 * faizləri/dəvət bonusu burdan yazılır. Seqmentdə sətir yoxdursa default seqmentin
 * dəyərinə düşür (resolver davranışı) — GET effektiv dəyəri göstərir.
 *
 * Settings (PS pct) və ServiceProduct.metadata (referralPct) yalnız DEFAULT seqment
 * redaktə olunanda sinxronlaşır (müştəri /qazan kalkulyatoru + legacy üçün kəşf-keş).
 *
 * Maya (costAznCents) məhsula aiddir (seqmentdən asılı deyil) və yalnız admin qazanc
 * proqnozu üçündür — komissiya ödənişinə təsir etmir.
 */

const DEFAULT_TIER = { slug: "adi", name: "Adi", sortOrder: 0 };

function metadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function roundPct(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

function parseRate(value: unknown, label: string) {
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error(`${label} düzgün deyil.`);
  }
  return Math.round(pct * 10) / 10;
}

function parseCostCents(value: unknown, label: string) {
  const azn = Number(value);
  if (!Number.isFinite(azn) || azn < 0) {
    throw new Error(`${label} düzgün deyil.`);
  }
  return Math.round(azn * 100);
}

function parseBonusCents(value: unknown, label: string) {
  const azn = Number(value);
  if (!Number.isFinite(azn) || azn < 0) {
    throw new Error(`${label} düzgün deyil.`);
  }
  return Math.round(azn * 100);
}

function serviceLabel(service: string, dbLabels?: Map<string, string>) {
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
  const match = cfg?.variants.find((v) => v.slug === variantSlug);
  return match?.name ?? variantSlug;
}

function durationLabel(months: unknown): string {
  const n = Number(months);
  return Number.isFinite(n) && n > 0 ? `${n} ay` : "";
}

/** Default seqmenti tapır, yoxdursa "adi"-ni yaradır (resolver də onu istifadə edir). */
async function ensureDefaultTier(): Promise<string> {
  const existing = await prisma.customerTier.findFirst({
    where: { isDefault: true },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  if (existing) return existing.id;
  const created = await prisma.customerTier.upsert({
    where: { slug: DEFAULT_TIER.slug },
    create: { ...DEFAULT_TIER, isDefault: true },
    update: { isDefault: true },
    select: { id: true },
  });
  return created.id;
}

function revalidateStreaming(service: string) {
  const known = STREAMING_SERVICE_META[service as keyof typeof STREAMING_SERVICE_META];
  if (known) revalidatePath(`/streaming/${known.slug}`);
}

/**
 * Yazıları hissələrlə (chunk) paralel icra edir. Uzaq DB-də onlarla upsert-i tək
 * interaktiv tranzaksiyaya yığmaq 5s timeout-u aşırdı; burada atomikliyə ehtiyac
 * yoxdur (validation əvvəlcədən, partial save admin yenidən saxlayır), ona görə
 * paralellik + bağlantı sayını məhdudlaşdıran chunk istifadə olunur.
 */
async function runChunked(promises: Promise<unknown>[], size = 20) {
  for (let i = 0; i < promises.length; i += size) {
    await Promise.all(promises.slice(i, i + size));
  }
}

type RateMap = Map<string, { ratePct: number; enabled: boolean }>;

function buildRateMaps(rows: { targetType: string; serviceProductId: string; ratePct: number; enabled: boolean }[]) {
  const byCategory: RateMap = new Map();
  const byProduct: RateMap = new Map();
  for (const row of rows) {
    const target = row.targetType === "SERVICE_PRODUCT" ? byProduct : byCategory;
    const key = row.targetType === "SERVICE_PRODUCT" ? row.serviceProductId : row.targetType;
    target.set(key, { ratePct: row.ratePct, enabled: row.enabled });
  }
  return { byCategory, byProduct };
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const defaultTierId = await ensureDefaultTier();
  const url = new URL(req.url);
  const requestedTierId = url.searchParams.get("tierId");

  const [settings, tiers, serviceProducts, platformLabels] = await Promise.all([
    getSettings(),
    prisma.customerTier.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isDefault: true,
        sortOrder: true,
        color: true,
        inviteBonusCents: true,
        _count: { select: { users: true } },
      },
    }),
    prisma.serviceProduct.findMany({
      where: { type: { in: ["STREAMING", "PLATFORM"] } },
      select: {
        id: true,
        type: true,
        title: true,
        isActive: true,
        priceAznCents: true,
        costAznCents: true,
        metadata: true,
      },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    getStreamingPlatformLabelMap(),
  ]);

  const selectedTier =
    tiers.find((t) => t.id === requestedTierId) ?? tiers.find((t) => t.id === defaultTierId) ?? tiers[0];
  const selectedTierId = selectedTier?.id ?? defaultTierId;
  const isDefaultSelected = selectedTierId === defaultTierId;

  // Seçilmiş seqmentin + (fərqlidirsə) default seqmentin faiz sətirləri.
  const tierIdsToLoad = Array.from(new Set([selectedTierId, defaultTierId]));
  const rateRows = await prisma.referralRate.findMany({
    where: { tierId: { in: tierIdsToLoad } },
    select: { tierId: true, targetType: true, serviceProductId: true, ratePct: true, enabled: true },
  });
  const selected = buildRateMaps(rateRows.filter((r) => r.tierId === selectedTierId));
  const fallback = buildRateMaps(rateRows.filter((r) => r.tierId === defaultTierId));

  // Effektiv faiz: seçilmiş seqment sətiri → default seqment sətiri → köhnə fallback.
  function effective(map: RateMap, fb: RateMap, key: string, legacyFallbackPct: number) {
    const row = map.get(key) ?? fb.get(key);
    if (!row) return roundPct(legacyFallbackPct);
    return row.enabled ? roundPct(Math.min(100, row.ratePct)) : 0;
  }
  function effectiveEnabled(map: RateMap, fb: RateMap, key: string, legacyEnabled: boolean) {
    const row = map.get(key) ?? fb.get(key);
    return row ? row.enabled : legacyEnabled;
  }

  type ProductRate = {
    id: string;
    label: string;
    variantLabel: string;
    durationMonths: number | null;
    durationLabel: string;
    isActive: boolean;
    priceAznCents: number;
    costAznCents: number;
    referralPct: number;
    referralEnabled: boolean;
  };
  type Group = {
    key: string;
    kind: "STREAMING" | "PLATFORM";
    label: string;
    categoryLabel: string;
    products: ProductRate[];
  };

  const groups = new Map<string, Group>();

  for (const product of serviceProducts) {
    const meta = metadataObject(product.metadata);
    let groupKey = "";
    let groupLabel = "";
    let categoryLabel = "";
    let vLabel = "";

    const durationMonths = Number(meta.durationMonths);
    const durTxt = durationLabel(meta.durationMonths);
    // Etiket xam başlıqdan deyil — variant + müddətdən qurulur (başlıqlar qarışıqdır).
    let itemLabel = product.title;
    const rowVariantLabel = "";
    let rowDurationLabel = "";

    if (product.type === "STREAMING") {
      const service = String(meta.service ?? "").trim().toUpperCase();
      if (!service) continue;
      const known = STREAMING_SERVICE_META[service as keyof typeof STREAMING_SERVICE_META];
      groupKey = `STREAMING:${service}`;
      groupLabel = serviceLabel(service, platformLabels);
      categoryLabel = known?.category === "MUSIC" ? "Musiqi yayımı" : "Yayım platformaları";
      vLabel = variantLabel(service, String(meta.variantSlug ?? "").trim());
      itemLabel = [vLabel, durTxt].filter(Boolean).join(" · ") || product.title;
    } else {
      const category = String(meta.category ?? "");
      if (!isValidPlatformCategory(category)) continue;
      groupKey = `PLATFORM:${category}`;
      groupLabel = PLATFORM_CATEGORY_LABELS[category];
      categoryLabel = PLATFORM_CATEGORY_LABELS[category];
      itemLabel = product.title;
      rowDurationLabel = durTxt;
    }

    const group = groups.get(groupKey) ?? {
      key: groupKey,
      kind: product.type as "STREAMING" | "PLATFORM",
      label: groupLabel,
      categoryLabel,
      products: [],
    };
    group.products.push({
      id: product.id,
      label: itemLabel,
      variantLabel: rowVariantLabel,
      durationMonths: Number.isFinite(durationMonths) ? durationMonths : null,
      durationLabel: rowDurationLabel,
      isActive: product.isActive,
      priceAznCents: product.priceAznCents,
      costAznCents: product.costAznCents,
      referralPct: effective(selected.byProduct, fallback.byProduct, product.id, Number(meta.referralPct) || 0),
      referralEnabled: effectiveEnabled(
        selected.byProduct,
        fallback.byProduct,
        product.id,
        meta.referralEnabled !== false,
      ),
    });
    groups.set(groupKey, group);
  }

  return NextResponse.json({
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      isDefault: t.isDefault,
      color: t.color,
      userCount: t._count.users,
      inviteBonusCents: t.inviteBonusCents,
    })),
    tierId: selectedTierId,
    isDefaultSelected,
    inviteBonusCents: selectedTier?.inviteBonusCents ?? 0,
    psStore: {
      games: effective(selected.byCategory, fallback.byCategory, "PS_GAMES", settings.referralGamesPct),
      psPlus: effective(selected.byCategory, fallback.byCategory, "PS_PLUS", settings.referralPsPlusPct),
      giftCards: effective(
        selected.byCategory,
        fallback.byCategory,
        "GIFT_CARDS",
        settings.referralGiftCardsPct,
      ),
      accountCreation: effective(
        selected.byCategory,
        fallback.byCategory,
        "ACCOUNT_CREATION",
        settings.referralAccountCreationPct,
      ),
    },
    other: {
      reviewAffiliateRatePct: settings.reviewAffiliateRatePct,
      reviewCashbackRatePct: settings.reviewCashbackRatePct,
    },
    fees: {
      epointFeePct: settings.epointFeePct,
      taxPct: settings.taxPct,
      cashoutFeePct: settings.cashoutFeePct,
    },
    groups: Array.from(groups.values()),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  try {
    const defaultTierId = await ensureDefaultTier();

    // Redaktə olunan seqment.
    const requestedTierId = typeof body.tierId === "string" ? body.tierId : "";
    const tier = requestedTierId
      ? await prisma.customerTier.findUnique({ where: { id: requestedTierId }, select: { id: true } })
      : null;
    const tierId = tier?.id ?? defaultTierId;
    const isDefault = tierId === defaultTierId;

    const psStore = metadataObject(body.psStore);
    const other = metadataObject(body.other);
    const fees = metadataObject(body.fees);
    const products: unknown[] = Array.isArray(body.products) ? body.products : [];

    const psCategories: Array<{ targetType: string; key: string; settingsKey: string; label: string }> = [
      { targetType: "PS_GAMES", key: "games", settingsKey: "referralGamesPct", label: "Oyunlar faizi" },
      { targetType: "PS_PLUS", key: "psPlus", settingsKey: "referralPsPlusPct", label: "PS Plus faizi" },
      { targetType: "GIFT_CARDS", key: "giftCards", settingsKey: "referralGiftCardsPct", label: "Gift Card faizi" },
      {
        targetType: "ACCOUNT_CREATION",
        key: "accountCreation",
        settingsKey: "referralAccountCreationPct",
        label: "Hesab açma faizi",
      },
    ];

    // Qlobal Settings (seqmentdən asılı deyil): kəşf-keş faizləri + ödəniş kəsintiləri.
    const settingsData: Record<string, number> = {
      reviewAffiliateRatePct: parseRate(other.reviewAffiliateRatePct, "Rəy affiliate faizi"),
      reviewCashbackRatePct: parseRate(other.reviewCashbackRatePct, "Rəy cashback faizi"),
      epointFeePct: parseRate(fees.epointFeePct, "Epoint komissiyası"),
      taxPct: parseRate(fees.taxPct, "Vergi faizi"),
      cashoutFeePct: parseRate(fees.cashoutFeePct, "Nağdlaşdırma faizi"),
    };

    const rateWrites: Promise<unknown>[] = [];
    for (const cat of psCategories) {
      const pct = parseRate(psStore[cat.key], cat.label);
      if (isDefault) settingsData[cat.settingsKey] = pct; // mirror yalnız default seqment üçün
      rateWrites.push(
        prisma.referralRate.upsert({
          where: {
            tierId_targetType_serviceProductId: { tierId, targetType: cat.targetType, serviceProductId: "" },
          },
          create: { tierId, targetType: cat.targetType, serviceProductId: "", ratePct: pct, enabled: true },
          update: { ratePct: pct, enabled: true },
        }),
      );
    }

    await prisma.settings.upsert({
      where: { id: "global" },
      create: { id: "global", ...settingsData },
      update: settingsData,
    });

    // Seçilmiş seqmentin dəvət bonusu.
    const inviteBonusCents = parseBonusCents(body.inviteBonusAzn, "Dəvət bonusu");
    rateWrites.push(
      prisma.customerTier.update({ where: { id: tierId }, data: { inviteBonusCents } }),
    );

    // Məhsul faizləri (hər variant × müddət) + maya (qlobal).
    const productIds = products
      .map((item) => metadataObject(item).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const dbProducts = await prisma.serviceProduct.findMany({
      where: { id: { in: productIds }, type: { in: ["STREAMING", "PLATFORM"] } },
      select: { id: true, type: true, metadata: true },
    });
    const dbProductById = new Map(dbProducts.map((p) => [p.id, p]));

    const touchedServices = new Set<string>();
    const touchedCategories = new Set<PlatformCategory>();

    for (const item of products) {
      const source = metadataObject(item);
      const id = typeof source.id === "string" ? source.id : "";
      const product = dbProductById.get(id);
      if (!product) continue;

      const referralEnabled = source.referralEnabled !== false;
      const referralPct = referralEnabled ? parseRate(source.referralPct, `${id} faizi`) : 0;
      const costAznCents = parseCostCents(source.costAzn, `${id} maya dəyəri`);
      const meta = metadataObject(product.metadata);

      // a) Maya (qlobal sütun) — həmişə. metadata referralPct kəşf-keşi — yalnız default.
      rateWrites.push(
        prisma.serviceProduct.update({
          where: { id },
          data: isDefault
            ? { costAznCents, metadata: { ...meta, referralEnabled, referralPct } }
            : { costAznCents },
        }),
      );

      // b) Seçilmiş seqmentin məhsul faizi.
      rateWrites.push(
        prisma.referralRate.upsert({
          where: {
            tierId_targetType_serviceProductId: {
              tierId,
              targetType: "SERVICE_PRODUCT",
              serviceProductId: id,
            },
          },
          create: { tierId, targetType: "SERVICE_PRODUCT", serviceProductId: id, ratePct: referralPct, enabled: referralEnabled },
          update: { ratePct: referralPct, enabled: referralEnabled },
        }),
      );

      if (product.type === "STREAMING") {
        const service = String(meta.service ?? "").trim().toUpperCase();
        if (service) touchedServices.add(service);
      } else {
        const category = String(meta.category ?? "");
        if (isValidPlatformCategory(category)) touchedCategories.add(category);
      }
    }

    if (rateWrites.length > 0) await runChunked(rateWrites);

    // Yalnız default seqment dəyişəndə public görünüş/kalkulyator yenilənir.
    if (isDefault) {
      revalidateTag("home");
      revalidateTag("site-header");
      revalidatePath("/");
      revalidatePath("/qazan");
      revalidatePath("/streaming");
      for (const service of touchedServices) revalidateStreaming(service);
      for (const category of touchedCategories) revalidatePath(PLATFORM_CATEGORY_PUBLIC_PATH[category]);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Referal faizləri saxlanmadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
