import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_STREAMING_PLATFORMS } from "@/lib/streamingPlatforms";
import { isValidSpotifyPlanTier } from "@/lib/platformSubscriptions";
import { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORM_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

async function guardAdmin() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function metadataObject(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function productBrand(metadata: unknown): string {
  return String(metadataObject(metadata).musicBrand ?? "").toUpperCase();
}

function isMusicProduct(metadata: unknown): boolean {
  return String(metadataObject(metadata).category ?? "").toUpperCase() === "MUSIC";
}

// Music platformaları StreamingPlatform-da (category=MUSIC) saxlanır; default
// siyahıdakı music platformalarını ilk açılışda seed edir (streaming GET ilə eyni).
async function ensureDefaultMusicPlatforms() {
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

async function revalidateMusic(code?: string) {
  revalidatePath("/");
  revalidatePath("/music");
  if (!code) return;
  const platform = await prisma.streamingPlatform
    .findUnique({ where: { code: code.toUpperCase() } })
    .catch(() => null);
  if (platform) revalidatePath(`/music/${platform.slug}`);
}

export async function GET() {
  const admin = await guardAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureDefaultMusicPlatforms();
  const [platforms, allPlatformProducts] = await Promise.all([
    prisma.streamingPlatform.findMany({
      where: { category: "MUSIC" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.serviceProduct.findMany({
      where: { type: "PLATFORM" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    }),
  ]);

  const products = allPlatformProducts.filter((p) => isMusicProduct(p.metadata));
  return NextResponse.json({ platforms, products });
}

export async function POST(req: Request) {
  const admin = await guardAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    if (action === "UPSERT_PLATFORM") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!PLATFORM_CODE_PATTERN.test(code)) {
        return NextResponse.json(
          { error: "Kod yalnız böyük hərf, rəqəm və alt xətdən ibarət olmalıdır (məs: SPOTIFY)." },
          { status: 400 },
        );
      }
      const label = String(body.label ?? "").trim();
      if (!label) return NextResponse.json({ error: "Ad tələb olunur." }, { status: 400 });

      const slug = slugify(String(body.slug ?? "").trim() || label);
      if (!slug) return NextResponse.json({ error: "Slug düzgün deyil." }, { status: 400 });

      const heroImageUrl =
        typeof body.heroImageUrl === "string" && body.heroImageUrl.trim()
          ? body.heroImageUrl.trim()
          : null;
      const tagline = String(body.tagline ?? "").trim();
      const description = String(body.description ?? "").trim();
      const sortRaw = Number(body.sortOrder);
      const sortOrder = Number.isFinite(sortRaw) ? sortRaw : 0;
      const isActive = body.isActive !== false;

      const slugOwner = await prisma.streamingPlatform.findUnique({ where: { slug } });
      if (slugOwner && slugOwner.code !== code) {
        return NextResponse.json({ error: "Bu slug başqa platformada istifadə olunur." }, { status: 409 });
      }

      const platform = await prisma.streamingPlatform.upsert({
        where: { code },
        create: { code, slug, label, category: "MUSIC", tagline, description, heroImageUrl, sortOrder, isActive },
        update: { slug, label, category: "MUSIC", tagline, description, heroImageUrl, sortOrder, isActive },
      });

      await revalidateMusic(code);
      return NextResponse.json(platform);
    }

    if (action === "DELETE_PLATFORM") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!code) return NextResponse.json({ error: "Platforma kodu tələb olunur." }, { status: 400 });

      const products = await prisma.serviceProduct.findMany({
        where: { type: "PLATFORM" },
        select: { metadata: true },
      });
      const count = products.filter((p) => isMusicProduct(p.metadata) && productBrand(p.metadata) === code).length;
      if (count > 0) {
        return NextResponse.json(
          { error: `Bu platformanın ${count} paketi var. Əvvəlcə paketləri silin və ya platformanı gizlədin.` },
          { status: 400 },
        );
      }

      await prisma.streamingPlatform.delete({ where: { code } }).catch(() => null);
      await revalidateMusic(code);
      return NextResponse.json({ ok: true });
    }

    if (action === "UPSERT_PRODUCT") {
      const { id, title, description, isActive, sortOrder } = body;
      const brand = String(body.service ?? "").trim().toUpperCase();
      if (!PLATFORM_CODE_PATTERN.test(brand)) {
        return NextResponse.json({ error: "Platforma seçilməlidir." }, { status: 400 });
      }

      const priceAzn = Number(body.priceAzn);
      if (!Number.isFinite(priceAzn) || priceAzn <= 0) {
        return NextResponse.json({ error: "Qiymət düzgün deyil." }, { status: 400 });
      }

      const originalPriceAznRaw = body.originalPriceAzn;
      const originalPriceAzn =
        originalPriceAznRaw === "" || originalPriceAznRaw == null ? null : Number(originalPriceAznRaw);
      if (originalPriceAzn != null) {
        if (!Number.isFinite(originalPriceAzn) || originalPriceAzn <= 0) {
          return NextResponse.json({ error: "Köhnə qiymət düzgün deyil." }, { status: 400 });
        }
        if (originalPriceAzn <= priceAzn) {
          return NextResponse.json(
            { error: "Köhnə qiymət hazırkı qiymətdən böyük olmalıdır." },
            { status: 400 },
          );
        }
      }

      const durationRaw = body.durationMonths;
      const durationMonths =
        durationRaw === "" || durationRaw == null ? null : Number(durationRaw);
      if (durationMonths != null && (!Number.isInteger(durationMonths) || durationMonths <= 0)) {
        return NextResponse.json({ error: "Müddət düzgün deyil." }, { status: 400 });
      }
      const terms = typeof body.terms === "string" ? body.terms.trim() : "";

      // Çoxhesablı planlar (məs. Spotify Individual/Duo/Family) üçün plan tipi və
      // tələb olunan hesab slotu sayı.
      const planTierRaw = String(body.planTier ?? "").toUpperCase();
      const planTier = isValidSpotifyPlanTier(planTierRaw) ? planTierRaw : null;
      const accountSlotsRaw = body.accountSlots;
      const accountSlots =
        accountSlotsRaw === "" || accountSlotsRaw == null ? null : Number(accountSlotsRaw);
      if (accountSlots != null && (!Number.isInteger(accountSlots) || accountSlots < 1)) {
        return NextResponse.json({ error: "Hesab sayı düzgün deyil (ən az 1)." }, { status: 400 });
      }

      const platform = await prisma.streamingPlatform.findUnique({ where: { code: brand } });
      const autoTitle =
        String(title ?? "").trim() ||
        `${platform?.label ?? brand}${durationMonths ? ` ${durationMonths} ay` : ""}`;

      const current =
        typeof id === "string"
          ? await prisma.serviceProduct.findUnique({ where: { id }, select: { imageUrl: true } })
          : null;

      const metadata: Record<string, unknown> = {
        category: "MUSIC",
        musicBrand: brand,
        ...(durationMonths != null ? { durationMonths } : {}),
        ...(terms ? { terms } : {}),
        ...(originalPriceAzn != null
          ? { originalPriceAznCents: Math.round(originalPriceAzn * 100) }
          : {}),
        ...(planTier ? { planTier } : {}),
        ...(accountSlots != null ? { accountSlots } : {}),
      };

      const payload = {
        type: "PLATFORM",
        title: autoTitle,
        description: typeof description === "string" ? description : null,
        imageUrl: current?.imageUrl ?? null,
        priceAznCents: Math.round(priceAzn * 100),
        isActive: Boolean(isActive),
        metadata: metadata as Prisma.InputJsonValue,
        sortOrder: Number(sortOrder || 0),
      };

      const product = id
        ? await prisma.serviceProduct.update({ where: { id }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });

      await revalidateMusic(brand);
      return NextResponse.json(product);
    }

    if (action === "SET_PRODUCT_IMAGE") {
      const { id } = body;
      const imageUrl =
        typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });

      const existing = await prisma.serviceProduct.findUnique({
        where: { id },
        select: { metadata: true },
      });
      if (!existing) return NextResponse.json({ error: "Paket tapılmadı." }, { status: 404 });

      await prisma.serviceProduct.update({ where: { id }, data: { imageUrl } });
      await revalidateMusic(productBrand(existing.metadata));
      return NextResponse.json({ ok: true, imageUrl });
    }

    if (action === "DELETE_PRODUCT") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const existing = await prisma.serviceProduct.findUnique({
        where: { id },
        select: { metadata: true },
      });
      await prisma.$transaction([
        prisma.serviceCode.deleteMany({ where: { serviceProductId: id } }),
        prisma.serviceProduct.delete({ where: { id } }),
      ]);
      await revalidateMusic(productBrand(existing?.metadata));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
