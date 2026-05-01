import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getSettings, tryCentsToAznWithMargin } from "@/lib/pricing";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  // Return pending PS Plus orders
  if (mode === "orders") {
    const orders = await prisma.transaction.findMany({
      where: { type: "SERVICE_PURCHASE", status: "PENDING", serviceProduct: { type: "PS_PLUS" } },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        serviceProduct: { select: { id: true, title: true, metadata: true } },
        psnAccount: { select: { id: true, label: true, psnEmail: true } },
      },
    });
    return NextResponse.json(orders);
  }

  // Return PS Plus products
  const products = await prisma.serviceProduct.findMany({
    where: { type: "PS_PLUS" },
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
      const {
        id,
        tier,
        durationMonths,
        tryPrice,
        isActive,
        sortOrder,
      } = body;

      const tierStr = String(tier ?? "");
      const dur = Number(durationMonths);
      const tryPriceNum = Number(tryPrice);

      if (!["ESSENTIAL", "EXTRA", "DELUXE"].includes(tierStr)) {
        return NextResponse.json({ error: "Tier düzgün deyil" }, { status: 400 });
      }
      if (![1, 3, 12].includes(dur)) {
        return NextResponse.json({ error: "Müddət 1, 3 və ya 12 ay olmalıdır" }, { status: 400 });
      }
      if (!Number.isFinite(tryPriceNum) || tryPriceNum <= 0) {
        return NextResponse.json({ error: "TRY qiyməti düzgün deyil" }, { status: 400 });
      }

      const settings = await getSettings();
      const tryCents = Math.round(tryPriceNum * 100);
      const azn = tryCentsToAznWithMargin(
        tryCents,
        settings.tryToAznRate,
        settings.profitMarginPsPlusPct ?? settings.profitMarginPct
      );
      const priceAznCents = Math.round(azn * 100);

      const tierLabel: Record<string, string> = { ESSENTIAL: "Essential", EXTRA: "Extra", DELUXE: "Deluxe" };
      const title = `PS Plus ${tierLabel[tierStr]} — ${dur} ay`;

      const payload = {
        type: "PS_PLUS" as const,
        title,
        priceAznCents,
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
        metadata: {
          tier: tierStr,
          durationMonths: dur,
          tryPriceCents: tryCents,
        },
      };

      if (id) {
        const p = await prisma.serviceProduct.update({ where: { id }, data: payload });
        return NextResponse.json(p);
      } else {
        const p = await prisma.serviceProduct.create({ data: payload });
        return NextResponse.json(p);
      }
    }

    if (action === "SET_TIER_ASSETS") {
      const tierStr = String(body.tier ?? "");
      const imageUrl =
        typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : "";

      if (!["ESSENTIAL", "EXTRA", "DELUXE"].includes(tierStr)) {
        return NextResponse.json({ error: "Tier düzgün deyil" }, { status: 400 });
      }
      if (!imageUrl) {
        return NextResponse.json({ error: "Şəkil URL tələb olunur" }, { status: 400 });
      }

      const all = await prisma.serviceProduct.findMany({
        where: { type: "PS_PLUS" },
        select: { id: true, metadata: true },
      });
      const ids = all
        .filter((p) => {
          const m = p.metadata as { tier?: unknown } | null;
          return typeof m?.tier === "string" && m.tier === tierStr;
        })
        .map((p) => p.id);

      if (ids.length === 0) {
        return NextResponse.json(
          { error: "Bu tier üçün hələ məhsul yoxdur. Əvvəlcə qiymət əlavə edin." },
          { status: 400 }
        );
      }

      await prisma.serviceProduct.updateMany({
        where: { id: { in: ids } },
        data: { imageUrl, description: description || null },
      });

      return NextResponse.json({ ok: true, updated: ids.length });
    }

    if (action === "DELETE_PRODUCT") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.serviceProduct.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
