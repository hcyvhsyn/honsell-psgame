import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Reels CTA-sı üçün məhsul axtarışı. `type=GAME` → Game (DB id qaytarır ki, cart
 * birbaşa əlavə edə bilsin), `type=SERVICE` → ServiceProduct.
 */
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const q = (url.searchParams.get("q") || "").trim();

  if (type === "SERVICE") {
    const items = await prisma.serviceProduct.findMany({
      where: q ? { title: { contains: q, mode: "insensitive" } } : {},
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      take: 20,
      select: { id: true, title: true, imageUrl: true, priceAznCents: true, type: true },
    });
    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        title: s.title,
        imageUrl: s.imageUrl,
        subtitle: `${s.type} · ${(s.priceAznCents / 100).toFixed(2)} ₼`,
      })),
    });
  }

  // Default: GAME
  const items = await prisma.game.findMany({
    where: {
      isActive: true,
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { title: "asc" }],
    take: 20,
    select: { id: true, title: true, imageUrl: true, store: true, platform: true },
  });
  return NextResponse.json({
    items: items.map((g) => ({
      id: g.id,
      title: g.title,
      imageUrl: g.imageUrl,
      subtitle: g.store === "EPIC" || g.platform === "PC" ? "Epic" : "PlayStation",
    })),
  });
}
