import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function metadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function roundPct(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

function readRate(value: unknown) {
  const pct = Number(value);
  return Number.isFinite(pct) && pct >= 0 ? roundPct(Math.min(100, pct)) : 0;
}

function parseRate(value: unknown, label: string) {
  const pct = Number(value);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error(`${label} düzgün deyil.`);
  }
  return Math.round(pct * 10) / 10;
}

function serviceLabel(service: string) {
  const known = STREAMING_SERVICE_META[service as keyof typeof STREAMING_SERVICE_META];
  if (known) return known.label;
  return service
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function revalidateStreaming(service: string) {
  revalidatePath("/");
  revalidatePath("/streaming");
  revalidatePath("/qazan");
  const known = STREAMING_SERVICE_META[service as keyof typeof STREAMING_SERVICE_META];
  if (known) revalidatePath(`/streaming/${known.slug}`);
}

function revalidatePlatform(category: PlatformCategory) {
  revalidatePath("/qazan");
  revalidatePath(PLATFORM_CATEGORY_PUBLIC_PATH[category]);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings, streamingProducts, platformProducts] = await Promise.all([
    getSettings(),
    prisma.serviceProduct.findMany({
      where: { type: "STREAMING" },
      select: { id: true, isActive: true, metadata: true },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    prisma.serviceProduct.findMany({
      where: { type: "PLATFORM" },
      select: { id: true, title: true, isActive: true, metadata: true },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
  ]);

  const streamingGroups = new Map<
    string,
    {
      service: string;
      productCount: number;
      activeProductCount: number;
      sourceMeta: Record<string, unknown> | null;
    }
  >();

  for (const product of streamingProducts) {
    const meta = metadataObject(product.metadata);
    const service = String(meta.service ?? "").trim().toUpperCase();
    if (!service) continue;
    const group = streamingGroups.get(service) ?? {
      service,
      productCount: 0,
      activeProductCount: 0,
      sourceMeta: null,
    };
    group.productCount += 1;
    if (product.isActive) group.activeProductCount += 1;
    if (!group.sourceMeta || meta.referralPct != null) group.sourceMeta = meta;
    streamingGroups.set(service, group);
  }

  const streaming = Array.from(streamingGroups.values()).map((group) => {
    const meta = group.sourceMeta ?? {};
    const known = STREAMING_SERVICE_META[group.service as keyof typeof STREAMING_SERVICE_META];
    return {
      service: group.service,
      label: serviceLabel(group.service),
      category: known?.category ?? "STREAMING",
      productCount: group.productCount,
      activeProductCount: group.activeProductCount,
      referralEnabled: meta.referralEnabled !== false,
      referralPct: meta.referralEnabled === false ? 0 : readRate(meta.referralPct),
    };
  });

  const platforms = platformProducts
    .map((product) => {
      const meta = metadataObject(product.metadata);
      const category = String(meta.category ?? "");
      if (!isValidPlatformCategory(category)) return null;
      const referralEnabled = meta.referralEnabled !== false;
      return {
        id: product.id,
        title: product.title,
        category,
        categoryLabel: PLATFORM_CATEGORY_LABELS[category],
        isActive: product.isActive,
        referralEnabled,
        referralPct: referralEnabled ? readRate(meta.referralPct) : 0,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    psStore: {
      games: settings.referralGamesPct,
      psPlus: settings.referralPsPlusPct,
      giftCards: settings.referralGiftCardsPct,
      accountCreation: settings.referralAccountCreationPct,
    },
    other: {
      reviewAffiliateRatePct: settings.reviewAffiliateRatePct,
      reviewCashbackRatePct: settings.reviewCashbackRatePct,
    },
    streaming,
    platforms,
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  try {
    const psStore = metadataObject(body.psStore);
    const other = metadataObject(body.other);
    const streaming: unknown[] = Array.isArray(body.streaming) ? body.streaming : [];
    const platforms: unknown[] = Array.isArray(body.platforms) ? body.platforms : [];

    const psStoreData = {
      referralGamesPct: parseRate(psStore.games, "Oyunlar faizi"),
      referralPsPlusPct: parseRate(psStore.psPlus, "PS Plus faizi"),
      referralGiftCardsPct: parseRate(psStore.giftCards, "Gift Card faizi"),
      referralAccountCreationPct: parseRate(psStore.accountCreation, "Hesab açma faizi"),
      reviewAffiliateRatePct: parseRate(other.reviewAffiliateRatePct, "Rəy affiliate faizi"),
      reviewCashbackRatePct: parseRate(other.reviewCashbackRatePct, "Rəy cashback faizi"),
    };

    await prisma.settings.upsert({
      where: { id: "global" },
      create: { id: "global", ...psStoreData },
      update: psStoreData,
    });

    const streamingProducts = await prisma.serviceProduct.findMany({
      where: { type: "STREAMING" },
      select: { id: true, metadata: true },
    });
    const streamingUpdates = [];
    const touchedServices = new Set<string>();

    for (const item of streaming) {
      const source = metadataObject(item);
      const service = String(source.service ?? "").trim().toUpperCase();
      if (!service) continue;
      const referralEnabled = source.referralEnabled !== false;
      const referralPct = referralEnabled ? parseRate(source.referralPct, `${service} faizi`) : 0;
      const targets = streamingProducts.filter((product) => {
        const meta = metadataObject(product.metadata);
        return String(meta.service ?? "").trim().toUpperCase() === service;
      });
      touchedServices.add(service);
      for (const product of targets) {
        const meta = metadataObject(product.metadata);
        streamingUpdates.push(
          prisma.serviceProduct.update({
            where: { id: product.id },
            data: {
              metadata: {
                ...meta,
                service,
                referralEnabled,
                referralPct,
              },
            },
          }),
        );
      }
    }

    if (streamingUpdates.length > 0) await prisma.$transaction(streamingUpdates);

    const platformIds = platforms
      .map((item) => metadataObject(item).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const platformProducts = await prisma.serviceProduct.findMany({
      where: { id: { in: platformIds }, type: "PLATFORM" },
      select: { id: true, metadata: true },
    });
    const platformUpdates = [];
    const touchedCategories = new Set<PlatformCategory>();

    for (const item of platforms) {
      const source = metadataObject(item);
      const id = typeof source.id === "string" ? source.id : "";
      const product = platformProducts.find((p) => p.id === id);
      if (!product) continue;
      const meta = metadataObject(product.metadata);
      const category = String(meta.category ?? "");
      if (isValidPlatformCategory(category)) touchedCategories.add(category);
      const referralEnabled = source.referralEnabled !== false;
      const referralPct = referralEnabled
        ? parseRate(source.referralPct, `${id} faizi`)
        : 0;
      platformUpdates.push(
        prisma.serviceProduct.update({
          where: { id },
          data: {
            metadata: {
              ...meta,
              referralEnabled,
              referralPct,
            },
          },
        }),
      );
    }

    if (platformUpdates.length > 0) await prisma.$transaction(platformUpdates);

    revalidatePath("/");
    revalidatePath("/qazan");
    for (const service of touchedServices) revalidateStreaming(service);
    for (const category of touchedCategories) revalidatePlatform(category);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Referal faizləri saxlanmadı.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
