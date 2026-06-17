import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  DEFAULT_STREAMING_PLATFORMS,
  getStreamingPlatformByCode,
} from "@/lib/streamingPlatforms";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DURATIONS = new Set([1, 2, 3, 6, 12]);
const VALID_SEATS = new Set([1, 2]);
const ALLOWED_DEVICES = new Set(["computer", "tv", "phone", "tablet"]);
const PLATFORM_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const VALID_PLATFORM_CATEGORIES = new Set(["STREAMING", "MUSIC"]);

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureDefaultStreamingPlatforms() {
  await prisma.streamingPlatform.createMany({
    data: DEFAULT_STREAMING_PLATFORMS.map((p, index) => ({
      code: p.code,
      slug: p.slug,
      label: p.label,
      category: p.category,
      tagline: p.tagline,
      description: p.description,
      sortOrder: index,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

function metadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function normalizeDevices(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((d) => String(d))
    .filter((d) => {
      if (!ALLOWED_DEVICES.has(d) || seen.has(d)) return false;
      seen.add(d);
      return true;
    });
}

function productMeta(metadata: unknown) {
  const raw = metadataObject(metadata);
  const referralPct = Number(raw.referralPct);
  return {
    raw,
    service: String(raw.service ?? "").toUpperCase(),
    devices: normalizeDevices(raw.devices),
    vpnRequired: Boolean(raw.vpnRequired),
    referralEnabled: raw.referralEnabled !== false,
    referralPct: Number.isFinite(referralPct) && referralPct >= 0 ? Math.min(100, referralPct) : null,
  };
}

async function revalidateStreaming(service?: string) {
  revalidatePath("/");
  revalidatePath("/streaming");
  revalidatePath("/music");
  revalidatePath("/qazan");
  if (!service) return;
  const meta = await getStreamingPlatformByCode(service);
  if (meta) {
    revalidatePath(meta.category === "MUSIC" ? `/music/${meta.slug}` : `/streaming/${meta.slug}`);
  }
}

function productService(metadata: unknown) {
  return productMeta(metadata).service;
}

// Platforma şəkli (metadata.platformImageUrl) — xidmət üzrə bütün paketlərdə
// eyni saxlanılır. Hər hansı paketdən birinci tapılanı qaytarır.
function servicePlatformImageFromProducts(
  products: Array<{ id?: string; metadata: unknown }>,
  service: string,
  excludedId?: string,
) {
  const normalized = service.toUpperCase();
  for (const p of products) {
    if (excludedId && p.id === excludedId) continue;
    if (productService(p.metadata) !== normalized) continue;
    const img = metadataObject(p.metadata).platformImageUrl;
    if (typeof img === "string" && img.trim()) return img.trim();
  }
  return null;
}

function serviceImageFromProducts(
  products: Array<{ id: string; imageUrl: string | null; metadata: unknown }>,
  service: string,
  excludedId?: string,
) {
  const normalized = service.toUpperCase();
  return (
    products.find(
      (p) => p.id !== excludedId && productService(p.metadata) === normalized && p.imageUrl,
    )?.imageUrl ??
    products.find((p) => productService(p.metadata) === normalized && p.imageUrl)?.imageUrl ??
    null
  );
}

function serviceAccessFromProducts(
  products: Array<{ metadata: unknown }>,
  service: string,
) {
  const normalized = service.toUpperCase();
  const metas = products
    .map((p) => productMeta(p.metadata))
    .filter((m) => m.service === normalized);
  const devicesSource = metas.find((m) => m.devices.length > 0);

  return {
    devices: devicesSource?.devices ?? [],
    vpnRequired: metas.some((m) => m.vpnRequired),
  };
}

function serviceReferralFromProducts(
  products: Array<{ id?: string; metadata: unknown }>,
  service: string,
  excludedId?: string,
) {
  const normalized = service.toUpperCase();
  const metas = products
    .filter((p) => p.id !== excludedId)
    .map((p) => productMeta(p.metadata))
    .filter((m) => m.service === normalized);
  const source = metas.find((m) => m.referralPct != null) ?? metas[0];

  return {
    hasOverride: Boolean(source && source.referralPct != null),
    referralEnabled: source?.referralEnabled ?? true,
    referralPct: source?.referralPct ?? null,
  };
}

function parseReferralPct(value: unknown) {
  const pct = value === "" || value == null ? 0 : Number(value);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return pct;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDefaultStreamingPlatforms();
  const [products, platforms] = await Promise.all([
    prisma.serviceProduct.findMany({
      where: { type: "STREAMING" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    prisma.streamingPlatform.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  return NextResponse.json({ products, platforms });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT_PRODUCT") {
      const { id, title, description, isActive, sortOrder } = body;
      const service = String(body.service ?? "").trim().toUpperCase();
      const durationMonths = Number(body.durationMonths);
      const seats = Number(body.seats ?? 1);
      const priceAzn = Number(body.priceAzn);
      const originalPriceAznRaw = body.originalPriceAzn;
      const originalPriceAzn =
        originalPriceAznRaw === "" || originalPriceAznRaw == null
          ? null
          : Number(originalPriceAznRaw);

      if (!service) {
        return NextResponse.json({ error: "Xidmət adı tələb olunur." }, { status: 400 });
      }
      if (!VALID_DURATIONS.has(durationMonths)) {
        return NextResponse.json({ error: "Müddət 1/2/3/6/12 ay olmalıdır." }, { status: 400 });
      }
      if (!VALID_SEATS.has(seats)) {
        return NextResponse.json({ error: "Yalnız 1 və ya 2 nəfərlik qəbul olunur." }, { status: 400 });
      }
      if (!Number.isFinite(priceAzn) || priceAzn <= 0) {
        return NextResponse.json({ error: "Qiymət düzgün deyil." }, { status: 400 });
      }
      if (originalPriceAzn != null) {
        if (!Number.isFinite(originalPriceAzn) || originalPriceAzn <= 0) {
          return NextResponse.json({ error: "Köhnə qiymət düzgün deyil." }, { status: 400 });
        }
        if (originalPriceAzn <= priceAzn) {
          return NextResponse.json(
            { error: "Köhnə qiymət hazırkı qiymətdən böyük olmalıdır." },
            { status: 400 }
          );
        }
      }

      const existingProducts = await prisma.serviceProduct.findMany({
        where: { type: "STREAMING" },
        select: { id: true, imageUrl: true, metadata: true },
      });
      const currentProduct =
        typeof id === "string" ? existingProducts.find((p) => p.id === id) : null;
      const serviceImageUrl = serviceImageFromProducts(
        existingProducts,
        service,
        typeof id === "string" ? id : undefined,
      );
      const serviceAccess = serviceAccessFromProducts(existingProducts, service);
      const servicePlatformImage = servicePlatformImageFromProducts(existingProducts, service);
      const previousService = currentProduct ? productService(currentProduct.metadata) : "";
      const serviceReferral = serviceReferralFromProducts(
        existingProducts,
        service,
        previousService === service ? undefined : typeof id === "string" ? id : undefined,
      );

      // Mövcud paketin öz şəkli varsa onu qoru (per-paket şəkil sıfırlanmasın);
      // yeni paket üçün platforma şəklini default kimi götür.
      const imageUrl = currentProduct ? currentProduct.imageUrl ?? serviceImageUrl : serviceImageUrl;

      const payload = {
        type: "STREAMING",
        title: String(title ?? "").trim() || `${service} ${durationMonths} ay`,
        description: typeof description === "string" ? description : null,
        imageUrl,
        priceAznCents: Math.round(priceAzn * 100),
        isActive: Boolean(isActive),
        metadata: {
          service,
          durationMonths,
          seats,
          deliveryMode: "CODE",
          devices: serviceAccess.devices,
          vpnRequired: serviceAccess.vpnRequired,
          ...(servicePlatformImage ? { platformImageUrl: servicePlatformImage } : {}),
          ...(serviceReferral.hasOverride
            ? {
                referralEnabled: serviceReferral.referralEnabled,
                referralPct: serviceReferral.referralEnabled ? serviceReferral.referralPct ?? 0 : 0,
              }
            : {}),
          ...(originalPriceAzn != null
            ? { originalPriceAznCents: Math.round(originalPriceAzn * 100) }
            : {}),
        },
        sortOrder: Number(sortOrder || 0),
      };

      const p = id
        ? await prisma.serviceProduct.update({ where: { id }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });
      if (previousService && previousService !== service) await revalidateStreaming(previousService);
      await revalidateStreaming(service);
      return NextResponse.json(p);
    }

    if (action === "SET_PRODUCT_IMAGE") {
      const { id } = body;
      const imageUrl =
        typeof body.imageUrl === "string" && body.imageUrl.trim()
          ? body.imageUrl.trim()
          : null;

      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });

      const existing = await prisma.serviceProduct.findUnique({
        where: { id },
        select: { metadata: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Paket tapılmadı." }, { status: 404 });
      }

      await prisma.serviceProduct.update({ where: { id }, data: { imageUrl } });

      await revalidateStreaming(productService(existing.metadata));
      return NextResponse.json({ ok: true, imageUrl });
    }

    if (action === "SET_SERVICE_PLATFORM_IMAGE") {
      const service = String(body.service ?? "").trim().toUpperCase();
      const imageUrl =
        typeof body.imageUrl === "string" && body.imageUrl.trim()
          ? body.imageUrl.trim()
          : null;

      if (!service) {
        return NextResponse.json({ error: "Xidmət adı tələb olunur." }, { status: 400 });
      }

      const products = await prisma.serviceProduct.findMany({
        where: { type: "STREAMING" },
        select: { id: true, metadata: true },
      });
      const targets = products.filter((p) => productService(p.metadata) === service);

      if (targets.length === 0) {
        return NextResponse.json(
          { error: "Bu platforma üçün əvvəlcə paket yaradılmalıdır." },
          { status: 400 },
        );
      }

      await prisma.$transaction(
        targets.map((p) => {
          const meta: Record<string, unknown> = { ...productMeta(p.metadata).raw, service };
          if (imageUrl) meta.platformImageUrl = imageUrl;
          else delete meta.platformImageUrl;
          return prisma.serviceProduct.update({
            where: { id: p.id },
            data: { metadata: meta as Prisma.InputJsonValue },
          });
        }),
      );

      await revalidateStreaming(service);
      return NextResponse.json({ ok: true, updated: targets.length, imageUrl });
    }

    if (action === "SET_SERVICE_ACCESS") {
      const service = String(body.service ?? "").trim().toUpperCase();
      const devices = normalizeDevices(body.devices);
      const vpnRequired = Boolean(body.vpnRequired);

      if (!service) {
        return NextResponse.json({ error: "Xidmət adı tələb olunur." }, { status: 400 });
      }

      const products = await prisma.serviceProduct.findMany({
        where: { type: "STREAMING" },
        select: { id: true, metadata: true },
      });
      const targets = products.filter((p) => productService(p.metadata) === service);

      if (targets.length === 0) {
        return NextResponse.json(
          { error: "Bu platforma üçün əvvəlcə paket yaradılmalıdır." },
          { status: 400 },
        );
      }

      await prisma.$transaction(
        targets.map((p) => {
          const meta = productMeta(p.metadata).raw;
          return prisma.serviceProduct.update({
            where: { id: p.id },
            data: {
              metadata: {
                ...meta,
                service,
                devices,
                vpnRequired,
              },
            },
          });
        }),
      );

      await revalidateStreaming(service);
      return NextResponse.json({ ok: true, updated: targets.length, devices, vpnRequired });
    }

    if (action === "SET_SERVICE_REFERRAL") {
      const service = String(body.service ?? "").trim().toUpperCase();
      const referralPct = parseReferralPct(body.referralPct);
      const referralEnabled = body.referralEnabled !== false;

      if (!service) {
        return NextResponse.json({ error: "Xidmət adı tələb olunur." }, { status: 400 });
      }
      if (referralPct == null) {
        return NextResponse.json({ error: "Referal faizi düzgün deyil." }, { status: 400 });
      }

      const products = await prisma.serviceProduct.findMany({
        where: { type: "STREAMING" },
        select: { id: true, metadata: true },
      });
      const targets = products.filter((p) => productService(p.metadata) === service);

      if (targets.length === 0) {
        return NextResponse.json(
          { error: "Bu platforma üçün əvvəlcə paket yaradılmalıdır." },
          { status: 400 },
        );
      }

      await prisma.$transaction(
        targets.map((p) => {
          const meta = productMeta(p.metadata).raw;
          return prisma.serviceProduct.update({
            where: { id: p.id },
            data: {
              metadata: {
                ...meta,
                service,
                referralEnabled,
                referralPct: referralEnabled ? referralPct : 0,
              },
            },
          });
        }),
      );

      await revalidateStreaming(service);
      revalidatePath("/qazan");
      return NextResponse.json({
        ok: true,
        updated: targets.length,
        referralEnabled,
        referralPct: referralEnabled ? referralPct : 0,
      });
    }

    if (action === "UPSERT_PLATFORM") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!PLATFORM_CODE_PATTERN.test(code)) {
        return NextResponse.json(
          { error: "Platforma kodu yalnız böyük hərf, rəqəm və alt xətdən ibarət olmalıdır (məs: PRIME_VIDEO)." },
          { status: 400 },
        );
      }

      const label = String(body.label ?? "").trim();
      if (!label) return NextResponse.json({ error: "Ad tələb olunur." }, { status: 400 });

      const slugInput = String(body.slug ?? "").trim();
      const slug = slugify(slugInput || label);
      if (!slug) return NextResponse.json({ error: "Slug düzgün deyil." }, { status: 400 });

      const category = String(body.category ?? "STREAMING").trim().toUpperCase();
      if (!VALID_PLATFORM_CATEGORIES.has(category)) {
        return NextResponse.json({ error: "Kateqoriya STREAMING və ya MUSIC olmalıdır." }, { status: 400 });
      }

      const tagline = String(body.tagline ?? "").trim();
      const description = String(body.description ?? "").trim();
      const sortRaw = Number(body.sortOrder);
      const sortOrder = Number.isFinite(sortRaw) ? sortRaw : 0;
      const isActive = body.isActive !== false;

      // Slug başqa platformada istifadə olunmamalıdır.
      const slugOwner = await prisma.streamingPlatform.findUnique({ where: { slug } });
      if (slugOwner && slugOwner.code !== code) {
        return NextResponse.json({ error: "Bu slug başqa platformada istifadə olunur." }, { status: 409 });
      }

      const platform = await prisma.streamingPlatform.upsert({
        where: { code },
        create: { code, slug, label, category, tagline, description, sortOrder, isActive },
        update: { slug, label, category, tagline, description, sortOrder, isActive },
      });

      await revalidateStreaming(code);
      return NextResponse.json(platform);
    }

    if (action === "DELETE_PLATFORM") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!code) return NextResponse.json({ error: "Platforma kodu tələb olunur." }, { status: 400 });

      // STREAMING (metadata.service) və MUSIC (type PLATFORM, metadata.musicBrand)
      // paketlərini say — paket varsa silməni blokla.
      const products = await prisma.serviceProduct.findMany({
        where: { type: { in: ["STREAMING", "PLATFORM"] } },
        select: { metadata: true },
      });
      const count = products.filter((p) => {
        const raw = metadataObject(p.metadata);
        const svc = String(raw.service ?? "").toUpperCase();
        const brand = String(raw.musicBrand ?? "").toUpperCase();
        return svc === code || brand === code;
      }).length;

      if (count > 0) {
        return NextResponse.json(
          {
            error: `Bu platformanın ${count} paketi var. Əvvəlcə paketləri silin və ya platformanı gizlədin.`,
          },
          { status: 400 },
        );
      }

      await prisma.streamingPlatform.delete({ where: { code } }).catch(() => null);
      await revalidateStreaming(code);
      return NextResponse.json({ ok: true });
    }

    if (action === "DELETE_PRODUCT") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const existing = await prisma.serviceProduct.findUnique({
        where: { id },
        select: { metadata: true },
      });
      const existingMeta = productMeta(existing?.metadata);
      await prisma.$transaction([
        prisma.serviceCode.deleteMany({ where: { serviceProductId: id } }),
        prisma.serviceProduct.delete({ where: { id } }),
      ]);
      await revalidateStreaming(existingMeta.service);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
