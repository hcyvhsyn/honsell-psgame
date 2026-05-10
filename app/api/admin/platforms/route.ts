import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  isValidPlatformCategory,
  type PlatformCategory,
} from "@/lib/platformSubscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function revalidatePlatform(category: PlatformCategory) {
  if (category === "MUSIC") revalidatePath("/music");
  if (category === "AI") revalidatePath("/ai");
  if (category === "WORK") revalidatePath("/work");
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  if (!category || !isValidPlatformCategory(category)) {
    return NextResponse.json(
      { error: "Düzgün kateqoriya seçin" },
      { status: 400 }
    );
  }

  const products = await prisma.serviceProduct.findMany({
    where: { type: "PLATFORM" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  // Filter by category in metadata.
  const filtered = products.filter((p) => {
    const m = (p.metadata as Record<string, unknown> | null) ?? {};
    return String(m.category ?? "") === category;
  });

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const { id, title, description, imageUrl, isActive, sortOrder, terms } = body;
      const category = String(body.category ?? "");
      const priceAzn = Number(body.priceAzn);
      const originalPriceAznRaw = body.originalPriceAzn;
      const originalPriceAzn =
        originalPriceAznRaw === "" || originalPriceAznRaw == null
          ? null
          : Number(originalPriceAznRaw);

      if (!isValidPlatformCategory(category)) {
        return NextResponse.json({ error: "Kateqoriya düzgün deyil." }, { status: 400 });
      }
      if (!title || typeof title !== "string" || !title.trim()) {
        return NextResponse.json({ error: "Başlıq tələb olunur." }, { status: 400 });
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

      const payload = {
        type: "PLATFORM",
        title: String(title).trim(),
        description: typeof description === "string" ? description : null,
        imageUrl: typeof imageUrl === "string" ? imageUrl : null,
        priceAznCents: Math.round(priceAzn * 100),
        isActive: Boolean(isActive ?? true),
        metadata: {
          category,
          ...(typeof terms === "string" && terms.trim()
            ? { terms: terms.trim() }
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
      revalidatePlatform(category as PlatformCategory);
      return NextResponse.json(p);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const existing = await prisma.serviceProduct.findUnique({ where: { id } });
      const cat = ((existing?.metadata as Record<string, unknown> | null) ?? {})
        .category as string | undefined;
      await prisma.$transaction([
        prisma.serviceCode.deleteMany({ where: { serviceProductId: id } }),
        prisma.serviceProduct.delete({ where: { id } }),
      ]);
      if (cat && isValidPlatformCategory(cat)) revalidatePlatform(cat);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
