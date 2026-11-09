import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  DEFAULT_STREAMING_PLATFORMS,
  getStreamingPlatformByCode,
} from "@/lib/streamingPlatforms";
import { getServiceVariantConfig, getServiceVariantSlugs } from "@/lib/streamingVariants";
import { streamingUsesCustomerEmail } from "@/lib/streamingCart";
import { NETFLIX_SERVICE_CODES, STORE_SELLABLE_META_KEY } from "@/lib/storeScope";
import {
  STREAMING_DURATION_OPTIONS,
  STREAMING_SEAT_OPTIONS,
  childPlatformCode,
  childPlatformSlug,
  isLockedStreamingGroup,
  isStreamingAccessMode,
  parseStreamingFeatures,
  resolvePlatformGroup,
  streamingSlug,
  type StreamingAccessMode,
} from "@/lib/streamingAccess";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DURATIONS = new Set(STREAMING_DURATION_OPTIONS);
const VALID_SEATS = new Set(STREAMING_SEAT_OPTIONS);
const ALLOWED_DEVICES = new Set(["computer", "tv", "phone", "tablet"]);
const PLATFORM_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const VALID_PLATFORM_CATEGORIES = new Set(["STREAMING", "MUSIC"]);

type PlatformRow = Awaited<ReturnType<typeof prisma.streamingPlatform.findMany>>[number];

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
    variantSlug: typeof raw.variantSlug === "string" ? raw.variantSlug.trim() : "",
    durationMonths: Number(raw.durationMonths ?? 0),
    seats: Number(raw.seats ?? 1) || 1,
    devices: normalizeDevices(raw.devices),
    vpnRequired: Boolean(raw.vpnRequired),
    referralEnabled: raw.referralEnabled !== false,
    referralPct: Number.isFinite(referralPct) && referralPct >= 0 ? Math.min(100, referralPct) : null,
  };
}

function productService(metadata: unknown) {
  return productMeta(metadata).service;
}

function parsePrice(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

// ─── Qrup (Şəxsi / Paylaşımlı) ────────────────────────────────────────────

async function loadPlatformMap(): Promise<Map<string, PlatformRow>> {
  const rows = await prisma.streamingPlatform.findMany();
  return new Map(rows.map((r) => [r.code.toUpperCase(), r]));
}

/** Plan kodu + bütün qrup kodları (üst xidmət özü və planları). */
function groupCodesOf(topCode: string, byCode: Map<string, PlatformRow>): string[] {
  const top = topCode.toUpperCase();
  const codes = [top];
  for (const row of byCode.values()) {
    if (resolvePlatformGroup(row).parentCode === top) codes.push(row.code.toUpperCase());
  }
  return codes;
}

/**
 * Plan məlumatından paket metadata-sına köçürülən sahələr — checkout / səbət / satış əhatəsi
 * bunları DB-yə getmədən sinxron oxuyur (lib/streamingAccess.ts başlığına bax).
 */
function derivedFields(service: string, byCode: Map<string, PlatformRow>) {
  const code = service.toUpperCase();
  const row = byCode.get(code);
  const group = resolvePlatformGroup(row ?? { code });
  const top = group.parentCode ? byCode.get(group.parentCode) : row;
  const isNetflix = NETFLIX_SERVICE_CODES.includes(code);
  return {
    accessMode: group.accessMode,
    groupCode: group.parentCode,
    // Netflix koda görə satılır — bayraq yalnız admin-dən açılan xidmətlər üçündür.
    storeSellable: !isNetflix && Boolean(top?.storeSellable),
    deliveryMode:
      streamingUsesCustomerEmail(code) || group.accessMode === "PERSONAL" ? ("GMAIL" as const) : ("CODE" as const),
    groupImageUrl: top?.heroImageUrl?.trim() || null,
  };
}

function applyDerived(meta: Record<string, unknown>, d: ReturnType<typeof derivedFields>) {
  const out: Record<string, unknown> = { ...meta, deliveryMode: d.deliveryMode };
  if (d.accessMode) out.accessMode = d.accessMode;
  else delete out.accessMode;
  if (d.groupCode) out.groupCode = d.groupCode;
  else delete out.groupCode;
  if (d.storeSellable) out[STORE_SELLABLE_META_KEY] = true;
  else delete out[STORE_SELLABLE_META_KEY];
  return out;
}

/** Plan / xidmət dəyişəndə həmin kodların bütün paketlərinə köçürülən sahələri yenidən yazır. */
async function syncProductsForCodes(codes: string[], byCode: Map<string, PlatformRow>) {
  const set = new Set(codes.map((c) => c.toUpperCase()));
  const products = await prisma.serviceProduct.findMany({
    where: { type: "STREAMING" },
    select: { id: true, metadata: true },
  });
  const ops = products
    .filter((p) => set.has(productService(p.metadata)))
    .map((p) => {
      const raw = metadataObject(p.metadata);
      const next = applyDerived(raw, derivedFields(productService(p.metadata), byCode));
      return prisma.serviceProduct.update({
        where: { id: p.id },
        data: { metadata: next as Prisma.InputJsonValue },
      });
    });
  if (ops.length) await prisma.$transaction(ops);
  return ops.length;
}

async function revalidateStreaming(service?: string) {
  // Ana səhifənin datası `unstable_cache`-dədir (tag "home") — kart qiyməti / satış açarı dərhal düşsün.
  revalidateTag("home");
  revalidatePath("/");
  revalidatePath("/streaming");
  revalidatePath("/music");
  revalidatePath("/qazan");
  if (!service) return;
  const meta = await getStreamingPlatformByCode(service);
  if (!meta) return;
  revalidatePath(meta.category === "MUSIC" ? `/music/${meta.slug}` : `/streaming/${meta.slug}`);
  // Plan səhifəsi üst xidmətə yönləndirir — alış ekranı üst xidmətin səhifəsidir.
  if (meta.parentCode) {
    const parent = await getStreamingPlatformByCode(meta.parentCode);
    if (parent) revalidatePath(`/streaming/${parent.slug}`);
  }
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
  platform?: PlatformRow | null,
) {
  const normalized = service.toUpperCase();
  const metas = products
    .map((p) => productMeta(p.metadata))
    .filter((m) => m.service === normalized);
  // Paket hələ yoxdursa plan yaradılanda seçilən cihaz/VPN götürülür.
  if (metas.length === 0 && platform) {
    return { devices: normalizeDevices(platform.devices), vpnRequired: platform.vpnRequired };
  }
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

/**
 * Yeni paketin metadata-sı. Qiymət cədvəli (SAVE_PRICE_GRID) və detallı redaktə (UPSERT_PRODUCT)
 * eyni funksiyadan keçir ki, cihaz/VPN/şəkil/referal/qrup sahələri bir yerdə qurulsun.
 */
function buildProductMetadata(params: {
  service: string;
  variantSlug: string;
  durationMonths: number;
  seats: number;
  originalPriceAznCents: number | null;
  existing: Array<{ id: string; imageUrl: string | null; metadata: unknown }>;
  excludedId?: string;
  byCode: Map<string, PlatformRow>;
}) {
  const { service, variantSlug, durationMonths, seats, originalPriceAznCents, existing, excludedId, byCode } = params;
  const access = serviceAccessFromProducts(existing, service, byCode.get(service));
  const derived = derivedFields(service, byCode);
  const platformImage = servicePlatformImageFromProducts(existing, service) ?? derived.groupImageUrl;
  const referral = serviceReferralFromProducts(existing, service, excludedId);
  return applyDerived(
    {
      service,
      durationMonths,
      seats,
      devices: access.devices,
      vpnRequired: access.vpnRequired,
      ...(variantSlug ? { variantSlug } : {}),
      ...(platformImage ? { platformImageUrl: platformImage } : {}),
      ...(referral.hasOverride
        ? {
            referralEnabled: referral.referralEnabled,
            referralPct: referral.referralEnabled ? referral.referralPct ?? 0 : 0,
          }
        : {}),
      ...(originalPriceAznCents != null ? { originalPriceAznCents } : {}),
    },
    derived,
  );
}

/** Cədvəldən yaranan paketin adı: "HBO Max Standart · paylaşımlı · 3 ay · 2 nəfər". */
function autoProductTitle(params: {
  service: string;
  variantSlug: string;
  durationMonths: number;
  seats: number;
  byCode: Map<string, PlatformRow>;
}) {
  const { service, variantSlug, durationMonths, seats, byCode } = params;
  const row = byCode.get(service);
  const group = resolvePlatformGroup(row ?? { code: service });
  const variantName = getServiceVariantConfig(service)?.variants.find((v) => v.slug === variantSlug)?.name ?? "";
  const seatPart = seats > 1 ? ` · ${seats} nəfər` : "";
  // Netflix-in köhnə adlandırması saxlanılır (sifariş tarixçəsində eyni görünsün).
  if (!row || isLockedStreamingGroup(group.parentCode) || !group.parentCode || !group.accessMode) {
    const base = row?.label ?? service;
    return `${base}${variantName ? ` ${variantName}` : ""} ${durationMonths} ay${seats > 1 ? ` · ${seats} nəfərlik` : ""}`;
  }
  const parentLabel = byCode.get(group.parentCode)?.label ?? group.parentCode;
  const tier = row.tierName?.trim() || row.label;
  const modeWord = group.accessMode === "PERSONAL" ? "şəxsi hesab" : "paylaşımlı";
  return `${parentLabel} ${tier} · ${modeWord} · ${durationMonths} ay${seatPart}`;
}

/** Bu plan yalnız 1 nəfərlikdir? (şəxsi hesab, Netflix hesab planı) */
function isSingleSeatService(service: string, byCode: Map<string, PlatformRow>) {
  if (getServiceVariantConfig(service)?.inlineVariantPicker) return true;
  const row = byCode.get(service);
  return resolvePlatformGroup(row ?? { code: service }).accessMode === "PERSONAL";
}

function validateVariant(service: string, variantSlug: string): string | null {
  const variantCfg = getServiceVariantConfig(service);
  if (variantSlug && !getServiceVariantSlugs(service).includes(variantSlug)) return "Variant düzgün deyil.";
  if (variantCfg && !variantSlug) return `${service} üçün variant (tier) seçilməlidir.`;
  return null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDefaultStreamingPlatforms();
  const [products, platforms, stock] = await Promise.all([
    prisma.serviceProduct.findMany({
      where: { type: "STREAMING" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
    prisma.streamingPlatform.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    // Stok platformaya görədir (aya görə deyil). Boşda olanlar əvvəl.
    prisma.streamingStock.findMany({
      orderBy: [{ isUsed: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  // Köhnə mühitdə (miqrasiya UPDATE-i düşməyibsə) Netflix planları koddan tanınır.
  const resolved = platforms.map((p) => {
    const group = resolvePlatformGroup(p);
    return { ...p, parentCode: group.parentCode, accessMode: group.accessMode };
  });

  return NextResponse.json({ products, platforms: resolved, stock });
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
      const originalPriceAzn = parsePrice(body.originalPriceAzn);

      // Variant (tier) slug — yalnız config-i olan xidmətlər üçün (məs. Netflix).
      const variantSlug = String(body.variantSlug ?? "").trim();
      if (!service) {
        return NextResponse.json({ error: "Xidmət adı tələb olunur." }, { status: 400 });
      }
      const variantError = validateVariant(service, variantSlug);
      if (variantError) return NextResponse.json({ error: variantError }, { status: 400 });
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

      const [existingProducts, byCode] = await Promise.all([
        prisma.serviceProduct.findMany({
          where: { type: "STREAMING" },
          select: { id: true, imageUrl: true, metadata: true },
        }),
        loadPlatformMap(),
      ]);
      if (isSingleSeatService(service, byCode) && seats !== 1) {
        return NextResponse.json({ error: "Şəxsi hesab planı yalnız 1 nəfərlikdir." }, { status: 400 });
      }
      const currentProduct =
        typeof id === "string" ? existingProducts.find((p) => p.id === id) : null;
      const previousService = currentProduct ? productService(currentProduct.metadata) : "";
      const serviceImageUrl =
        serviceImageFromProducts(existingProducts, service, typeof id === "string" ? id : undefined) ??
        derivedFields(service, byCode).groupImageUrl;

      // Mövcud paketin öz şəkli varsa onu qoru (per-paket şəkil sıfırlanmasın);
      // yeni paket üçün platforma şəklini default kimi götür.
      const imageUrl = currentProduct ? currentProduct.imageUrl ?? serviceImageUrl : serviceImageUrl;

      const metadata = buildProductMetadata({
        service,
        variantSlug,
        durationMonths,
        seats,
        originalPriceAznCents: originalPriceAzn != null ? Math.round(originalPriceAzn * 100) : null,
        existing: existingProducts,
        excludedId: previousService === service ? undefined : typeof id === "string" ? id : undefined,
        byCode,
      });

      const payload = {
        type: "STREAMING",
        title:
          String(title ?? "").trim() ||
          autoProductTitle({ service, variantSlug, durationMonths, seats, byCode }),
        description: typeof description === "string" ? description : null,
        imageUrl,
        priceAznCents: Math.round(priceAzn * 100),
        isActive: Boolean(isActive),
        metadata: metadata as Prisma.InputJsonValue,
        sortOrder: Number(sortOrder || 0),
      };

      const p = id
        ? await prisma.serviceProduct.update({ where: { id }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });
      if (previousService && previousService !== service) await revalidateStreaming(previousService);
      await revalidateStreaming(service);
      return NextResponse.json(p);
    }

    /**
     * Qiymət cədvəli: bir plan (+ Netflix hesab variantı) üçün müddət × nəfər xanaları bir dəfəyə
     * yazılır. Boş xana → paket satışdan çıxır (isActive=false, SİLİNMİR — sifariş tarixçəsi qalır);
     * qiymət yazılan xana → paket yenilənir / yenidən aktivləşir / yaranır.
     */
    if (action === "SAVE_PRICE_GRID") {
      const service = String(body.service ?? "").trim().toUpperCase();
      const variantSlug = String(body.variantSlug ?? "").trim();
      const cellsRaw: unknown[] = Array.isArray(body.cells) ? body.cells : [];
      if (!service) return NextResponse.json({ error: "Plan seçilməyib." }, { status: 400 });
      const variantError = validateVariant(service, variantSlug);
      if (variantError) return NextResponse.json({ error: variantError }, { status: 400 });
      if (cellsRaw.length === 0 || cellsRaw.length > 40) {
        return NextResponse.json({ error: "Cədvəl boşdur." }, { status: 400 });
      }

      const byCode = await loadPlatformMap();
      if (!byCode.has(service)) {
        return NextResponse.json({ error: "Plan tapılmadı." }, { status: 404 });
      }
      const singleSeat = isSingleSeatService(service, byCode);

      type Cell = { durationMonths: number; seats: number; price: number | null };
      const cells: Cell[] = [];
      const seen = new Set<string>();
      for (const raw of cellsRaw) {
        const c = metadataObject(raw);
        const durationMonths = Number(c.durationMonths);
        const seats = Number(c.seats ?? 1);
        const price = parsePrice(c.priceAzn);
        if (!VALID_DURATIONS.has(durationMonths) || !VALID_SEATS.has(seats)) {
          return NextResponse.json({ error: "Müddət və ya nəfər sayı düzgün deyil." }, { status: 400 });
        }
        if (singleSeat && seats !== 1) {
          return NextResponse.json({ error: "Şəxsi hesab planı yalnız 1 nəfərlikdir." }, { status: 400 });
        }
        if (price != null && (!Number.isFinite(price) || price <= 0 || price > 100000)) {
          return NextResponse.json(
            { error: `${durationMonths} ay${seats > 1 ? ` · ${seats} nəfər` : ""}: qiymət düzgün deyil.` },
            { status: 400 },
          );
        }
        const key = `${durationMonths}:${seats}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cells.push({ durationMonths, seats, price });
      }

      const existing = await prisma.serviceProduct.findMany({
        where: { type: "STREAMING" },
        select: { id: true, imageUrl: true, metadata: true, isActive: true, priceAznCents: true },
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      });
      const own = existing.filter((p) => {
        const m = productMeta(p.metadata);
        return m.service === service && m.variantSlug === variantSlug;
      });
      const derived = derivedFields(service, byCode);
      const defaultImage = serviceImageFromProducts(existing, service) ?? derived.groupImageUrl;

      const ops: Prisma.PrismaPromise<unknown>[] = [];
      let created = 0;
      let updated = 0;
      let disabled = 0;
      for (const cell of cells) {
        const matches = own.filter((p) => {
          const m = productMeta(p.metadata);
          return m.durationMonths === cell.durationMonths && m.seats === cell.seats;
        });
        if (cell.price == null) {
          for (const p of matches.filter((x) => x.isActive)) {
            ops.push(prisma.serviceProduct.update({ where: { id: p.id }, data: { isActive: false } }));
            disabled += 1;
          }
          continue;
        }
        const cents = Math.round(cell.price * 100);
        const target = matches[0];
        if (target) {
          const raw = applyDerived(metadataObject(target.metadata), derived);
          // Köhnə (üstündən xətlənmiş) qiymət yeni qiymətdən böyük deyilsə endirim mənasızdır.
          const opc = Number(raw.originalPriceAznCents);
          if (Number.isFinite(opc) && opc <= cents) delete raw.originalPriceAznCents;
          if (target.priceAznCents === cents && target.isActive) continue;
          ops.push(
            prisma.serviceProduct.update({
              where: { id: target.id },
              data: { priceAznCents: cents, isActive: true, metadata: raw as Prisma.InputJsonValue },
            }),
          );
          updated += 1;
          continue;
        }
        const metadata = buildProductMetadata({
          service,
          variantSlug,
          durationMonths: cell.durationMonths,
          seats: cell.seats,
          originalPriceAznCents: null,
          existing,
          byCode,
        });
        ops.push(
          prisma.serviceProduct.create({
            data: {
              type: "STREAMING",
              title: autoProductTitle({ service, variantSlug, durationMonths: cell.durationMonths, seats: cell.seats, byCode }),
              description: null,
              imageUrl: defaultImage,
              priceAznCents: cents,
              isActive: true,
              // Müddət sırası: vitrin `sortOrder` → qiymət sırası ilə düzür.
              sortOrder: cell.durationMonths + (cell.seats - 1) * 100,
              metadata: metadata as Prisma.InputJsonValue,
            },
          }),
        );
        created += 1;
      }

      if (ops.length) await prisma.$transaction(ops);
      await revalidateStreaming(service);
      return NextResponse.json({ ok: true, created, updated, disabled });
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

    /**
     * Xidmət şəkli. Üst xidmətə verilərsə BÜTÜN qrupa (özü + planları) tətbiq olunur və
     * `StreamingPlatform.heroImageUrl`-da saxlanılır ki, sonra yaranan paketlər də onu götürsün.
     */
    if (action === "SET_SERVICE_PLATFORM_IMAGE") {
      const service = String(body.service ?? "").trim().toUpperCase();
      const imageUrl =
        typeof body.imageUrl === "string" && body.imageUrl.trim()
          ? body.imageUrl.trim()
          : null;

      if (!service) {
        return NextResponse.json({ error: "Xidmət adı tələb olunur." }, { status: 400 });
      }

      const byCode = await loadPlatformMap();
      const row = byCode.get(service);
      const isTop = row ? !resolvePlatformGroup(row).parentCode : false;
      const codes = new Set(isTop ? groupCodesOf(service, byCode) : [service]);

      const products = await prisma.serviceProduct.findMany({
        where: { type: "STREAMING" },
        select: { id: true, metadata: true, imageUrl: true },
      });
      const targets = products.filter((p) => codes.has(productService(p.metadata)));

      if (targets.length === 0 && !row) {
        return NextResponse.json(
          { error: "Bu platforma üçün əvvəlcə paket yaradılmalıdır." },
          { status: 400 },
        );
      }

      const ops: Prisma.PrismaPromise<unknown>[] = targets.map((p) => {
        const meta: Record<string, unknown> = { ...productMeta(p.metadata).raw };
        if (imageUrl) meta.platformImageUrl = imageUrl;
        else delete meta.platformImageUrl;
        return prisma.serviceProduct.update({
          where: { id: p.id },
          data: {
            metadata: meta as Prisma.InputJsonValue,
            // Öz şəkli olmayan paketlər (kartda boş görünməsin) xidmət şəklini götürür.
            ...(imageUrl && !p.imageUrl ? { imageUrl } : {}),
          },
        });
      });
      if (row && isTop) {
        ops.push(prisma.streamingPlatform.update({ where: { code: row.code }, data: { heroImageUrl: imageUrl } }));
      }
      if (ops.length) await prisma.$transaction(ops);

      for (const code of codes) await revalidateStreaming(code);
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
      const platform = await prisma.streamingPlatform.findUnique({ where: { code: service } });

      if (targets.length === 0 && !platform) {
        return NextResponse.json(
          { error: "Bu platforma üçün əvvəlcə paket yaradılmalıdır." },
          { status: 400 },
        );
      }

      const ops: Prisma.PrismaPromise<unknown>[] = targets.map((p) => {
        const meta = productMeta(p.metadata).raw;
        return prisma.serviceProduct.update({
          where: { id: p.id },
          data: {
            metadata: {
              ...meta,
              service,
              devices,
              vpnRequired,
            } as Prisma.InputJsonValue,
          },
        });
      });
      // Plan səviyyəsində də saxlanılır — sonra yaranan paketlər eyni cihaz/VPN ilə başlasın.
      if (platform) {
        ops.push(prisma.streamingPlatform.update({ where: { code: service }, data: { devices, vpnRequired } }));
      }
      await prisma.$transaction(ops);

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
              } as Prisma.InputJsonValue,
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

    /**
     * Xidmət (üst platforma) və ya plan (parentCode + accessMode) yaradır / yeniləyir.
     * Plan yaradılanda kod və slug serverdə qurulur (childPlatformCode/Slug).
     */
    if (action === "UPSERT_PLATFORM") {
      const isCreate = body.mode === "create";
      const byCode = await loadPlatformMap();

      const parentCodeInput = String(body.parentCode ?? "").trim().toUpperCase() || null;
      const parent = parentCodeInput ? byCode.get(parentCodeInput) ?? null : null;
      if (parentCodeInput && !parent) {
        return NextResponse.json({ error: "Üst xidmət tapılmadı." }, { status: 400 });
      }
      if (parent && resolvePlatformGroup(parent).parentCode) {
        return NextResponse.json({ error: "Plan yalnız üst xidmətə əlavə oluna bilər." }, { status: 400 });
      }

      const tierName = String(body.tierName ?? "").trim().slice(0, 60);
      const accessModeInput = isStreamingAccessMode(body.accessMode) ? (body.accessMode as StreamingAccessMode) : null;

      let code = String(body.code ?? "").trim().toUpperCase();
      let slugInput = String(body.slug ?? "").trim();
      if (isCreate && parent) {
        if (isLockedStreamingGroup(parent.code)) {
          return NextResponse.json(
            { error: "Netflix planları CRM ilə bağlıdır — yeni plan koddan əlavə olunur." },
            { status: 400 },
          );
        }
        if (!accessModeInput) return NextResponse.json({ error: "Rejim seçilməlidir." }, { status: 400 });
        if (!tierName) return NextResponse.json({ error: "Plan adı tələb olunur." }, { status: 400 });
        code = childPlatformCode(parent.code, accessModeInput, tierName);
        slugInput = childPlatformSlug(parent.slug, accessModeInput, tierName);
      }

      if (!PLATFORM_CODE_PATTERN.test(code)) {
        return NextResponse.json(
          { error: "Platforma kodu yalnız böyük hərf, rəqəm və alt xətdən ibarət olmalıdır (məs: PRIME_VIDEO)." },
          { status: 400 },
        );
      }
      const existing = byCode.get(code) ?? null;
      if (isCreate && existing) {
        return NextResponse.json(
          { error: parent ? "Bu adda plan artıq var." : "Bu kodla xidmət artıq var." },
          { status: 409 },
        );
      }

      const label =
        String(body.label ?? "").trim() ||
        (parent && tierName ? `${parent.label} ${tierName}` : existing?.label ?? "");
      if (!label) return NextResponse.json({ error: "Ad tələb olunur." }, { status: 400 });

      const slug = streamingSlug(slugInput || existing?.slug || label);
      if (!slug) return NextResponse.json({ error: "Slug düzgün deyil." }, { status: 400 });

      // Plan kateqoriyası üst xidmətdən gəlir.
      const category = parent
        ? parent.category
        : String(body.category ?? existing?.category ?? "STREAMING").trim().toUpperCase();
      if (!VALID_PLATFORM_CATEGORIES.has(category)) {
        return NextResponse.json({ error: "Kateqoriya STREAMING və ya MUSIC olmalıdır." }, { status: 400 });
      }

      const tagline = String(body.tagline ?? existing?.tagline ?? "").trim();
      const description = String(body.description ?? existing?.description ?? "").trim();
      const sortRaw = Number(body.sortOrder ?? existing?.sortOrder ?? 0);
      const sortOrder = Number.isFinite(sortRaw) ? sortRaw : 0;
      const isActive = body.isActive !== false;

      // Slug başqa platformada istifadə olunmamalıdır.
      const slugOwner = await prisma.streamingPlatform.findUnique({ where: { slug } });
      if (slugOwner && slugOwner.code !== code) {
        return NextResponse.json({ error: "Bu slug başqa platformada istifadə olunur." }, { status: 409 });
      }

      // Qrup sahələri. Mövcud planın yeri/rejimi dəyişmir (paketlər, stok və CRM xəritəsi ona bağlıdır).
      const existingGroup = existing ? resolvePlatformGroup(existing) : null;
      const parentCode = existing ? existingGroup!.parentCode : parent?.code ?? null;
      const accessMode = existing ? existingGroup!.accessMode : parent ? accessModeInput : null;
      const locked = isLockedStreamingGroup(parentCode);
      const groupData = {
        parentCode,
        accessMode,
        tierName: parentCode ? tierName || existing?.tierName || "" : "",
        ...(parentCode && !locked && body.features !== undefined
          ? { features: parseStreamingFeatures(body.features) as Prisma.InputJsonValue }
          : {}),
        ...(body.devices !== undefined ? { devices: normalizeDevices(body.devices) } : {}),
        ...(body.vpnRequired !== undefined ? { vpnRequired: Boolean(body.vpnRequired) } : {}),
      };

      const platform = await prisma.streamingPlatform.upsert({
        where: { code },
        create: { code, slug, label, category, tagline, description, sortOrder, isActive, ...groupData },
        update: { slug, label, category, tagline, description, sortOrder, isActive, ...groupData },
      });

      byCode.set(code, platform);
      await syncProductsForCodes(parentCode ? [code] : groupCodesOf(code, byCode), byCode);
      await revalidateStreaming(code);
      return NextResponse.json(platform);
    }

    /** Üst xidmətin "Saytda satılır" açarı → bütün qrup paketlərinə `storeSellable` köçürülür. */
    if (action === "SET_SERVICE_SELLABLE") {
      const code = String(body.code ?? "").trim().toUpperCase();
      const storeSellable = Boolean(body.storeSellable);
      const byCode = await loadPlatformMap();
      const row = byCode.get(code);
      if (!row) return NextResponse.json({ error: "Xidmət tapılmadı." }, { status: 404 });
      if (resolvePlatformGroup(row).parentCode) {
        return NextResponse.json({ error: "Satış açarı üst xidmətdədir, plana yox." }, { status: 400 });
      }
      if (isLockedStreamingGroup(code)) {
        return NextResponse.json({ error: "Netflix həmişə satışdadır (CRM ilə bağlıdır)." }, { status: 400 });
      }

      const platform = await prisma.streamingPlatform.update({ where: { code }, data: { storeSellable } });
      byCode.set(code, platform);
      const codes = groupCodesOf(code, byCode);
      const updated = await syncProductsForCodes(codes, byCode);
      for (const c of codes) await revalidateStreaming(c);
      return NextResponse.json({ ok: true, storeSellable, updated });
    }

    if (action === "DELETE_PLATFORM") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!code) return NextResponse.json({ error: "Platforma kodu tələb olunur." }, { status: 400 });

      const byCode = await loadPlatformMap();
      const row = byCode.get(code);
      const group = row ? resolvePlatformGroup(row) : null;
      if (isLockedStreamingGroup(code) || (group && isLockedStreamingGroup(group.parentCode))) {
        return NextResponse.json({ error: "Netflix platformaları CRM ilə bağlıdır, silinə bilməz." }, { status: 400 });
      }
      const childCount = groupCodesOf(code, byCode).length - 1;
      if (childCount > 0) {
        return NextResponse.json(
          { error: `Bu xidmətin ${childCount} planı var. Əvvəlcə planları silin və ya xidməti gizlədin.` },
          { status: 400 },
        );
      }

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
      // Stokda hesab məlumatı qalıbsa silinməsin — kredensiallar itməsin.
      const stockCount = await prisma.streamingStock.count({ where: { platformCode: code } });
      if (stockCount > 0) {
        return NextResponse.json(
          { error: `Bu planın stokunda ${stockCount} hesab var. Əvvəlcə stoku silin.` },
          { status: 400 },
        );
      }

      await prisma.streamingPlatform.delete({ where: { code } }).catch(() => null);
      await revalidateStreaming(group?.parentCode ?? code);
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

    // ─── Stok (paylaşımlı plan üzrə hesab məlumatları) ──────────────────────
    if (action === "ADD_STOCK" || action === "ADD_STOCK_BULK") {
      const platformCode = String(body.platformCode ?? "").trim().toUpperCase();
      if (!platformCode) {
        return NextResponse.json({ error: "Platforma seçilməlidir." }, { status: 400 });
      }
      const platform = await prisma.streamingPlatform.findUnique({ where: { code: platformCode } });
      if (!platform) {
        return NextResponse.json({ error: "Platforma tapılmadı." }, { status: 400 });
      }

      const rowsRaw: unknown[] = action === "ADD_STOCK_BULK" ? (Array.isArray(body.rows) ? body.rows : []) : [body];
      if (rowsRaw.length === 0 || rowsRaw.length > 200) {
        return NextResponse.json({ error: "1–200 sətir göndərin." }, { status: 400 });
      }
      const rows = [];
      for (const [i, raw] of rowsRaw.entries()) {
        const r = metadataObject(raw);
        const mail = String(r.mail ?? "").trim();
        const password = String(r.password ?? "").trim();
        if (!mail || !password) {
          return NextResponse.json(
            { error: rowsRaw.length > 1 ? `${i + 1}-ci sətir: mail və şifrə tələb olunur.` : "Mail və şifrə tələb olunur." },
            { status: 400 },
          );
        }
        rows.push({
          platformCode,
          mail,
          password,
          cabinetName: String(r.cabinetName ?? "").trim(),
          pinCode: String(r.pinCode ?? "").trim(),
          note: String(r.note ?? "").trim() || null,
        });
      }

      await prisma.streamingStock.createMany({ data: rows });
      return NextResponse.json({ ok: true, added: rows.length });
    }

    if (action === "TOGGLE_STOCK_USED") {
      const id = String(body.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const existing = await prisma.streamingStock.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Stok tapılmadı." }, { status: 404 });
      const isUsed = body.isUsed === undefined ? !existing.isUsed : Boolean(body.isUsed);
      await prisma.streamingStock.update({
        where: { id },
        data: { isUsed, usedAt: isUsed ? new Date() : null },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "DELETE_STOCK") {
      const id = String(body.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.streamingStock.delete({ where: { id } }).catch(() => null);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
