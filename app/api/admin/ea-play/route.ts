import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateServices } from "@/lib/revalidate";

export const runtime = "nodejs";

const ALLOWED_DURATIONS = [1, 12] as const;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  if (mode === "orders") {
    const orders = await prisma.transaction.findMany({
      where: { type: "SERVICE_PURCHASE", status: "PENDING", serviceProduct: { type: "EA_PLAY" } },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        serviceProduct: { select: { id: true, title: true, metadata: true } },
        psnAccount: { select: { id: true, label: true, psnEmail: true } },
      },
    });
    return NextResponse.json(orders);
  }

  const products = await prisma.serviceProduct.findMany({
    where: { type: "EA_PLAY" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT_PRODUCT") {
      const { id, durationMonths, tryPrice, aznPrice, isActive, sortOrder } = body;

      const dur = Number(durationMonths);
      const tryPriceNum = Number(tryPrice);
      const aznPriceNum = Number(aznPrice);

      if (!ALLOWED_DURATIONS.includes(dur as 1 | 12)) {
        return NextResponse.json({ error: "Müddət 1 və ya 12 ay olmalıdır" }, { status: 400 });
      }
      if (!Number.isFinite(tryPriceNum) || tryPriceNum <= 0) {
        return NextResponse.json({ error: "TRY (maya) qiyməti düzgün deyil" }, { status: 400 });
      }
      if (!Number.isFinite(aznPriceNum) || aznPriceNum <= 0) {
        return NextResponse.json({ error: "AZN satış qiyməti düzgün deyil" }, { status: 400 });
      }

      const tryCents = Math.round(tryPriceNum * 100);
      const priceAznCents = Math.round(aznPriceNum * 100);
      const title = `EA Play — ${dur} ay`;

      const payload = {
        type: "EA_PLAY" as const,
        title,
        priceAznCents,
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
        metadata: {
          durationMonths: dur,
          tryPriceCents: tryCents,
        },
      };

      const p = id
        ? await prisma.serviceProduct.update({ where: { id }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });
      revalidateServices();
      return NextResponse.json(p);
    }

    if (action === "SET_ASSETS") {
      const imageUrl =
        typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : "";

      if (!imageUrl) {
        return NextResponse.json({ error: "Şəkil URL tələb olunur" }, { status: 400 });
      }

      const all = await prisma.serviceProduct.findMany({
        where: { type: "EA_PLAY" },
        select: { id: true },
      });

      if (all.length === 0) {
        return NextResponse.json(
          { error: "Hələ EA Play məhsulu yoxdur. Əvvəlcə qiymət əlavə edin." },
          { status: 400 }
        );
      }

      await prisma.serviceProduct.updateMany({
        where: { id: { in: all.map((p) => p.id) } },
        data: { imageUrl, description: description || null },
      });

      revalidateServices();
      return NextResponse.json({ ok: true, updated: all.length });
    }

    if (action === "DELETE_PRODUCT") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.serviceProduct.delete({ where: { id } });
      revalidateServices();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
