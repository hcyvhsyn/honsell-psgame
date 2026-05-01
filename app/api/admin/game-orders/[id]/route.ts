import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeDisplayPrice, getSettings, tryCentsToCostAzn } from "@/lib/pricing";
import {
  GAME_ORDER_STAGES,
  mergeGameOrderStageMetadata,
  type GameOrderStage,
} from "@/lib/gameOrderFulfillment";

export const runtime = "nodejs";

async function denyUnlessAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return false;
  } catch {
    return true;
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const denied = await denyUnlessAdmin();
  if (denied) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body as { action?: string; stage?: string };

  const row = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      game: true,
      user: { select: { id: true, email: true, name: true, referredById: true } },
    },
  });

  if (!row || row.type !== "PURCHASE" || !row.gameId || !row.game) {
    return NextResponse.json({ error: "Oyun sifarişi tapılmadı." }, { status: 404 });
  }

  if (action === "SET_STAGE") {
    if (row.status !== "PENDING") {
      return NextResponse.json({ error: "Yalnız gözləmədə olan sifariş üçün." }, { status: 400 });
    }
    const stage = body.stage as GameOrderStage | undefined;
    if (!stage || !GAME_ORDER_STAGES.includes(stage)) {
      return NextResponse.json({ error: "Etibarlı mərhələ seçin." }, { status: 400 });
    }
    const metadata = mergeGameOrderStageMetadata(row.metadata, stage);
    await prisma.transaction.update({ where: { id: row.id }, data: { metadata } });
    return NextResponse.json({ ok: true });
  }

  if (action === "SUCCESS") {
    if (row.status !== "PENDING") {
      return NextResponse.json({ error: "Artıq bağlanmış sifariş." }, { status: 400 });
    }

    const settings = await getSettings();

    const gameRow = row.game;
    if (!gameRow) {
      return NextResponse.json({ error: "Oyun qeydi silinib." }, { status: 400 });
    }

    await prisma.$transaction(async (ptx) => {
      const needle = `"sourcePurchaseId":"${row.id}"`;
      const existingCommission = await ptx.transaction.findFirst({
        where: { type: "COMMISSION", metadata: { contains: needle } },
        select: { id: true },
      });

      await ptx.transaction.update({
        where: { id: row.id },
        data: { status: "SUCCESS" },
      });

      const buyer = row.user ?? (await ptx.user.findUnique({ where: { id: row.userId } }));
      const referredById = buyer?.referredById ?? null;

      const price = computeDisplayPrice(gameRow, settings);
      const unitListCents = Math.round(price.finalAzn * 100);
      const tryForCost =
        gameRow.discountTryCents != null && gameRow.discountTryCents < gameRow.priceTryCents
          ? gameRow.discountTryCents
          : gameRow.priceTryCents;
      const unitCostCents = Math.round(tryCentsToCostAzn(tryForCost, settings) * 100);

      if (
        referredById &&
        settings.referralProfitSharePct > 0 &&
        !existingCommission
      ) {
        const profitCents = Math.max(0, unitListCents - unitCostCents);
        const commissionCents = Math.round((profitCents * settings.referralProfitSharePct) / 100);
        if (commissionCents > 0) {
          await ptx.user.update({
            where: { id: referredById },
            data: { referralBalanceCents: { increment: commissionCents } },
          });
          await ptx.transaction.create({
            data: {
              userId: referredById,
              beneficiaryId: referredById,
              type: "COMMISSION",
              status: "SUCCESS",
              amountAznCents: commissionCents,
              gameId: gameRow.id,
              metadata: JSON.stringify({
                sourcePurchaseId: row.id,
                profitCents,
                shareRate: settings.referralProfitSharePct,
              }),
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "FAILED") {
    if (row.status !== "PENDING") {
      return NextResponse.json({ error: "Artıq bağlanmış sifariş." }, { status: 400 });
    }

    await prisma.$transaction(async (ptx) => {
      const refundCents = Math.abs(row.amountAznCents);
      let toReferral = false;
      try {
        if (row.metadata) {
          const meta = JSON.parse(row.metadata) as { paymentSource?: string };
          if (meta.paymentSource === "REFERRAL") toReferral = true;
        }
      } catch {
        /* köhnə məlumat */
      }

      await ptx.user.update({
        where: { id: row.userId },
        data: toReferral
          ? { referralBalanceCents: { increment: refundCents } }
          : { walletBalance: { increment: refundCents } },
      });
      await ptx.transaction.update({ where: { id: row.id }, data: { status: "FAILED" } });
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tanınmayan əməl." }, { status: 400 });
}
