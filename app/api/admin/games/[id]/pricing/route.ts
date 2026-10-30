import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { MAX_GAME_MARGIN_PCT } from "@/lib/gameMargin";
import { revalidateGames, revalidateReels } from "@/lib/revalidate";

export const runtime = "nodejs";

/**
 * Oyuna xüsusi qiymət. `AUTO` → pillələr, `MARGIN` → oyunun öz faizi,
 * `FIXED` → sabit AZN qiyməti (PS endirimi nəzərə alınmır). Bax lib/gameMargin.ts.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? "");

  let data: { customMarginPct: number | null; customPriceAznCents: number | null };
  if (mode === "AUTO") {
    data = { customMarginPct: null, customPriceAznCents: null };
  } else if (mode === "MARGIN") {
    const pct = Number(body.marginPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > MAX_GAME_MARGIN_PCT) {
      return NextResponse.json({ error: "Faiz 0–500 arasında olmalıdır." }, { status: 400 });
    }
    data = { customMarginPct: pct, customPriceAznCents: null };
  } else if (mode === "FIXED") {
    const cents = Math.round(Number(body.priceAzn) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      return NextResponse.json({ error: "Qiymət müsbət olmalıdır." }, { status: 400 });
    }
    data = { customMarginPct: null, customPriceAznCents: cents };
  } else {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const game = await prisma.game.update({
    where: { id: params.id },
    data,
    select: { id: true, customMarginPct: true, customPriceAznCents: true },
  });

  revalidateGames();
  revalidateReels();
  return NextResponse.json(game);
}
