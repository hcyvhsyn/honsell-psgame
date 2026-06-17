import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  PRODUCT_CATEGORY_DEFINITIONS,
  isValidProductCategoryKey,
  productCategoryDefaultsByKey,
} from "@/lib/categoryAssets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CUSTOM_CATEGORY_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

async function guardAdmin() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

async function ensureDefaultCategoryAssets() {
  await prisma.categoryAsset.createMany({
    data: PRODUCT_CATEGORY_DEFINITIONS.map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      href: item.href,
      sortOrder: item.sortOrder,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

function revalidateCategorySurfaces() {
  revalidatePath("/");
  revalidatePath("/oyunlar");
  revalidatePath("/ps-plus");
  revalidatePath("/hediyye-kartlari");
  revalidatePath("/hesab-acma");
}

export async function GET() {
  const admin = await guardAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureDefaultCategoryAssets();
  const assets = await prisma.categoryAsset.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return NextResponse.json(assets);
}

export async function POST(req: Request) {
  const admin = await guardAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  try {
    if (action === "CREATE") {
      const key = String(body.key ?? "").trim().toUpperCase();
      if (!CUSTOM_CATEGORY_KEY_PATTERN.test(key)) {
        return NextResponse.json(
          { error: "Açar yalnız böyük hərf, rəqəm və alt xətdən ibarət olmalıdır (məs: PRIME_VIDEO)." },
          { status: 400 },
        );
      }

      const existing = await prisma.categoryAsset.findUnique({ where: { key } });
      if (existing) {
        return NextResponse.json({ error: "Bu açarla kateqoriya artıq mövcuddur." }, { status: 409 });
      }

      const label = String(body.label ?? "").trim();
      const href = String(body.href ?? "").trim();
      const imageUrl = String(body.imageUrl ?? "").trim();
      const description = String(body.description ?? "").trim();

      if (!label) return NextResponse.json({ error: "Başlıq tələb olunur." }, { status: 400 });
      if (!href.startsWith("/")) {
        return NextResponse.json({ error: "Link / ilə başlamalıdır." }, { status: 400 });
      }

      const asset = await prisma.categoryAsset.create({
        data: {
          key,
          label,
          description: description || null,
          href,
          imageUrl: imageUrl || null,
          isActive: Boolean(body.isActive ?? true),
          sortOrder: Number(body.sortOrder ?? 0),
        },
      });

      revalidateCategorySurfaces();
      return NextResponse.json(asset);
    }

    if (action === "UPSERT") {
      const key = String(body.key ?? "");
      if (!CUSTOM_CATEGORY_KEY_PATTERN.test(key)) {
        return NextResponse.json({ error: "Kateqoriya açarı düzgün deyil." }, { status: 400 });
      }

      const defaults = productCategoryDefaultsByKey().get(key);

      const label = String(body.label ?? "").trim();
      const href = String(body.href ?? "").trim();
      const imageUrl = String(body.imageUrl ?? "").trim();
      const description = String(body.description ?? "").trim();

      if (!label) return NextResponse.json({ error: "Başlıq tələb olunur." }, { status: 400 });
      if (!href.startsWith("/")) {
        return NextResponse.json({ error: "Link / ilə başlamalıdır." }, { status: 400 });
      }

      const asset = await prisma.categoryAsset.upsert({
        where: { key },
        create: {
          key,
          label,
          description: description || null,
          href,
          imageUrl: imageUrl || null,
          isActive: Boolean(body.isActive ?? true),
          sortOrder: Number(body.sortOrder ?? defaults?.sortOrder ?? 0),
        },
        update: {
          label,
          description: description || null,
          href,
          imageUrl: imageUrl || null,
          isActive: Boolean(body.isActive ?? true),
          sortOrder: Number(body.sortOrder ?? defaults?.sortOrder ?? 0),
        },
      });

      revalidateCategorySurfaces();
      return NextResponse.json(asset);
    }

    if (action === "DELETE") {
      const key = String(body.key ?? "");
      if (isValidProductCategoryKey(key)) {
        return NextResponse.json(
          { error: "Daxili kateqoriyanı silmək olmaz. Onu gizli edə bilərsiniz." },
          { status: 400 },
        );
      }

      await prisma.categoryAsset.delete({ where: { key } }).catch(() => null);
      revalidateCategorySurfaces();
      return NextResponse.json({ ok: true });
    }

    if (action === "RESET_DEFAULTS") {
      await ensureDefaultCategoryAssets();
      const defaults = productCategoryDefaultsByKey();
      await prisma.$transaction(
        PRODUCT_CATEGORY_DEFINITIONS.map((item) =>
          prisma.categoryAsset.update({
            where: { key: item.key },
            data: {
              label: defaults.get(item.key)?.label ?? item.label,
              description: defaults.get(item.key)?.description ?? item.description,
              href: defaults.get(item.key)?.href ?? item.href,
              sortOrder: defaults.get(item.key)?.sortOrder ?? item.sortOrder,
              isActive: true,
            },
          }),
        ),
      );
      revalidateCategorySurfaces();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
