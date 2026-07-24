import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { serviceProductLabel } from "@/lib/serviceProductLabel";
import { REVIEW_SERVICE_TYPES } from "@/lib/whatsappReviewProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ServiceProduct.type / Game.store → picker-də göstərilən qrup başlığı. */
function groupLabel(kind: "GAME" | "SERVICE", type: string, store?: string): string {
  if (kind === "GAME") return store === "EPIC" ? "Epic Games" : "PlayStation oyunları";
  switch (type) {
    case "STREAMING":
      return "Streaming";
    case "PLATFORM":
      return "Musiqi / Platforma";
    case "PS_PLUS":
      return "PS Plus";
    case "EA_PLAY":
      return "EA Play";
    case "ACCOUNT_CREATION":
    case "EPIC_ACCOUNT_CREATION":
      return "Hesab açma";
    default:
      return "Digər";
  }
}

/**
 * WhatsApp rəy dəvəti üçün vahid məhsul axtarışı — həm oyunları (`Game`), həm də
 * rəy yazıla bilən xidmətləri (streaming, musiqi/platforma, PS Plus, EA Play,
 * hesab açma) başlığa görə axtarır. Nəticə: `{ kind, id, type, title, priceAzn,
 * store, group }`.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [games, services, settings] = await Promise.all([
    prisma.game.findMany({
      where: { isActive: true, title: { contains: q, mode: "insensitive" } },
      orderBy: { title: "asc" },
      take: 10,
      select: {
        id: true,
        title: true,
        store: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        priceUsdCents: true,
        discountUsdCents: true,
      },
    }),
    prisma.serviceProduct.findMany({
      where: {
        isActive: true,
        type: { in: [...REVIEW_SERVICE_TYPES] },
        title: { contains: q, mode: "insensitive" },
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      take: 10,
      select: { id: true, title: true, type: true, priceAznCents: true, metadata: true },
    }),
    getSettings(),
  ]);

  const gameResults = games.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      kind: "GAME" as const,
      id: g.id,
      type: "GAME",
      store: g.store,
      title: g.title,
      priceAzn: price.finalAzn,
      group: groupLabel("GAME", "GAME", g.store),
    };
  });

  const serviceResults = services.map((s) => ({
    kind: "SERVICE" as const,
    id: s.id,
    type: s.type,
    store: null,
    title: serviceProductLabel(s.title, s.metadata),
    priceAzn: s.priceAznCents / 100,
    group: groupLabel("SERVICE", s.type),
  }));

  return NextResponse.json({ results: [...serviceResults, ...gameResults] });
}
