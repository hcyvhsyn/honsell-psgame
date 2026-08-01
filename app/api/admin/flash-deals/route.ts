import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateFlashDeals } from "@/lib/revalidate";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";

export const runtime = "nodejs";

/** "12.99" / "12,99" / "" → qəpik (Int) və ya null. */
function parseAznCents(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(String(value).replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function parseEndsAt(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [deals, settings] = await Promise.all([
      prisma.flashDeal.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          game: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              platform: true,
              store: true,
              priceTryCents: true,
              discountTryCents: true,
              discountEndAt: true,
              priceUsdCents: true,
              discountUsdCents: true,
            },
          },
        },
      }),
      getSettings(),
    ]);

    // Adminə həm override, həm də oyunun avtomatik qiymətini göstəririk ki,
    // "boş buraxsam nə olacaq" sualı formda dərhal görünsün.
    return NextResponse.json(
      deals.map((d) => {
        const auto = computeDisplayPrice(d.game, settings);
        return {
          id: d.id,
          gameId: d.gameId,
          gameTitle: d.game.title,
          gameImageUrl: d.game.imageUrl,
          gamePlatform: d.game.store === "EPIC" ? "PC" : d.game.platform,
          autoFinalAzn: auto.finalAzn,
          autoOriginalAzn: auto.originalAzn,
          priceAznCents: d.priceAznCents,
          originalAznCents: d.originalAznCents,
          endsAt: d.endsAt ? d.endsAt.toISOString() : null,
          isActive: d.isActive,
          sortOrder: d.sortOrder,
        };
      }),
    );
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const { id, gameId, priceAzn, originalAzn, endsAt, isActive, sortOrder } = body;
      if (!gameId) return NextResponse.json({ error: "Oyun seçilməlidir" }, { status: 400 });

      const game = await prisma.game.findUnique({
        where: { id: String(gameId) },
        select: {
          id: true,
          store: true,
          priceTryCents: true,
          discountTryCents: true,
          discountEndAt: true,
          priceUsdCents: true,
          discountUsdCents: true,
        },
      });
      if (!game) return NextResponse.json({ error: "Oyun tapılmadı" }, { status: 404 });

      // Eyni oyun iki dəfə əlavə edilə bilməz (gameId @unique) — daha aydın xəta.
      const existing = await prisma.flashDeal.findUnique({ where: { gameId: game.id }, select: { id: true } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Bu oyun artıq siyahıdadır" }, { status: 400 });
      }

      const priceAznCents = parseAznCents(priceAzn);
      const originalAznCents = parseAznCents(originalAzn);

      if (priceAznCents != null && originalAznCents != null && originalAznCents <= priceAznCents) {
        return NextResponse.json(
          { error: "Köhnə qiymət kampaniya qiymətindən böyük olmalıdır" },
          { status: 400 },
        );
      }

      // Override yalnız endirim üçündür — kataloq qiymətindən baha rəqəm
      // storefront-da onsuz da nəzərə alınmır (lib/flashDeals.ts), ona görə
      // admin bunu yazanda dərhal xəbərdar edirik.
      if (priceAznCents != null) {
        const settings = await getSettings();
        const auto = computeDisplayPrice(game, settings);
        if (priceAznCents / 100 >= auto.finalAzn) {
          return NextResponse.json(
            {
              error: `Kampaniya qiyməti oyunun mövcud qiymətindən (${auto.finalAzn.toFixed(2)}₼) aşağı olmalıdır`,
            },
            { status: 400 },
          );
        }
      }

      const payload = {
        gameId: game.id,
        priceAznCents,
        originalAznCents,
        endsAt: parseEndsAt(endsAt),
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
      };

      const deal = id
        ? await prisma.flashDeal.update({ where: { id: String(id) }, data: payload })
        : await prisma.flashDeal.create({ data: payload });
      revalidateFlashDeals();
      return NextResponse.json(deal);
    }

    if (action === "TOGGLE_ACTIVE") {
      const { id, isActive } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      const deal = await prisma.flashDeal.update({
        where: { id: String(id) },
        data: { isActive: Boolean(isActive) },
      });
      revalidateFlashDeals();
      return NextResponse.json(deal);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.flashDeal.delete({ where: { id: String(id) } });
      revalidateFlashDeals();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER") {
      const { ids } = body;
      if (!Array.isArray(ids)) return NextResponse.json({ error: "ids massiv olmalıdır" }, { status: 400 });
      await prisma.$transaction(
        ids.map((id: string, index: number) =>
          prisma.flashDeal.update({ where: { id: String(id) }, data: { sortOrder: index } }),
        ),
      );
      revalidateFlashDeals();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
