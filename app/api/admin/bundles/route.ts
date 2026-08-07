import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateBundles } from "@/lib/revalidate";
import { loadAdminBundles } from "@/lib/gameBundles";
import { clampDiscountPct, normalizePricingMode } from "@/lib/gameBundleShared";

export const runtime = "nodejs";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Qiymət cədvəli və maya dəyəri də daxil — admin paket zərərlə satılırsa görsün.
  const bundles = await loadAdminBundles();
  return NextResponse.json(bundles);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const {
        id,
        slug,
        title,
        subtitle,
        description,
        imageUrl,
        badgeText,
        pricingMode,
        discountPct,
        isActive,
        isFeatured,
        sortOrder,
        startsAt,
        endsAt,
      } = body;
      if (!title) return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
      const finalSlug = slug ? slugify(String(slug)) : slugify(String(title));
      if (!finalSlug) return NextResponse.json({ error: "Slug yaradıla bilmədi" }, { status: 400 });

      const payload = {
        slug: finalSlug,
        title: String(title),
        subtitle: subtitle || null,
        description: description || null,
        imageUrl: imageUrl || null,
        badgeText: badgeText || null,
        pricingMode: normalizePricingMode(pricingMode),
        discountPct: clampDiscountPct(discountPct),
        isActive: Boolean(isActive ?? true),
        isFeatured: Boolean(isFeatured ?? false),
        sortOrder: Number(sortOrder || 0),
        startsAt: parseDate(startsAt),
        endsAt: parseDate(endsAt),
      };

      const b = id
        ? await prisma.gameBundle.update({ where: { id }, data: payload })
        : await prisma.gameBundle.create({ data: payload });
      revalidateBundles();
      return NextResponse.json(b);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.gameBundle.delete({ where: { id } });
      revalidateBundles();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER") {
      const { ids } = body;
      if (!Array.isArray(ids)) return NextResponse.json({ error: "ids massiv olmalıdır" }, { status: 400 });
      await prisma.$transaction(
        ids.map((id: string, index: number) =>
          prisma.gameBundle.update({ where: { id: String(id) }, data: { sortOrder: index } })
        )
      );
      revalidateBundles();
      return NextResponse.json({ ok: true });
    }

    if (action === "ADD_GAME") {
      const { bundleId, gameId } = body;
      if (!bundleId || !gameId)
        return NextResponse.json({ error: "bundleId və gameId tələb olunur" }, { status: 400 });
      const max = await prisma.gameBundleItem.aggregate({
        where: { bundleId: String(bundleId) },
        _max: { position: true },
      });
      const nextPos = (max._max.position ?? -1) + 1;
      await prisma.gameBundleItem.upsert({
        where: { bundleId_gameId: { bundleId: String(bundleId), gameId: String(gameId) } },
        create: { bundleId: String(bundleId), gameId: String(gameId), position: nextPos },
        update: {},
      });
      revalidateBundles();
      return NextResponse.json({ ok: true });
    }

    if (action === "REMOVE_GAME") {
      const { bundleId, gameId } = body;
      if (!bundleId || !gameId)
        return NextResponse.json({ error: "bundleId və gameId tələb olunur" }, { status: 400 });
      await prisma.gameBundleItem.delete({
        where: { bundleId_gameId: { bundleId: String(bundleId), gameId: String(gameId) } },
      });
      revalidateBundles();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER_GAMES") {
      const { bundleId, gameIds } = body;
      if (!bundleId || !Array.isArray(gameIds))
        return NextResponse.json({ error: "bundleId və gameIds tələb olunur" }, { status: 400 });
      await prisma.$transaction(
        gameIds.map((gameId: string, index: number) =>
          prisma.gameBundleItem.update({
            where: { bundleId_gameId: { bundleId: String(bundleId), gameId: String(gameId) } },
            data: { position: index },
          })
        )
      );
      revalidateBundles();
      return NextResponse.json({ ok: true });
    }

    // CUSTOM rejimdə bir oyunun paket daxilindəki qiyməti. `null` → oyunun adi
    // vitrin qiyməti götürülür. Serverdə hər halda list qiymətlə kəsilir
    // (`computeBundlePricing`), yəni admin səhvən baha rəqəm yazsa müştəri
    // paketdə daha baha ödəmir.
    if (action === "SET_ITEM_PRICE") {
      const { bundleId, gameId, priceAznCents } = body;
      if (!bundleId || !gameId)
        return NextResponse.json({ error: "bundleId və gameId tələb olunur" }, { status: 400 });
      const raw = priceAznCents;
      const value =
        raw === null || raw === undefined || raw === ""
          ? null
          : Math.max(0, Math.round(Number(raw) || 0));
      await prisma.gameBundleItem.update({
        where: { bundleId_gameId: { bundleId: String(bundleId), gameId: String(gameId) } },
        data: { priceAznCents: value },
      });
      revalidateBundles();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
