import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeDisplayPrice, getSettings, tryCentsToCostAzn } from "@/lib/pricing";
import {
  GAME_ORDER_STAGES,
  mergeGameOrderStageMetadata,
  type GameOrderStage,
} from "@/lib/gameOrderFulfillment";
import { issueReviewInvite } from "@/lib/reviewInvite";
import {
  recordPurchaseSpend,
  recordSuccessfulInvite,
} from "@/lib/referralCycle";
import { awardReviewAffiliateCommission } from "@/lib/reviewAffiliate";
import { resolveReferralRatePct, type ReferralRateDb } from "@/lib/referralRates";
import { resolveEffectiveTierId } from "@/lib/customerTier";
import { sendOrderApprovedWhatsApp } from "@/lib/orderNotifications";
import { sellBackAmountCents } from "@/lib/lootBoxShared";

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
      user: { select: { id: true, email: true, name: true, phone: true, referredById: true } },
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

    // Qutu açılışından (loot box) çıxan hədiyyə sifarişi. Bunun məbləği 0-dır:
    // müştəri qutunun qiymətini ödəyib, oyunun kataloq qiymətini yox. Ona görə
    // referal komissiyası / cycle xalları / rəy affiliate kataloq qiymətindən
    // hesablanmamalıdır — əks halda 5 AZN-lik qutuya 10 AZN-lik satış kimi
    // komissiya ödəyərdik və qutunun marjası yeyilərdi.
    const isLootBoxPrize = (() => {
      if (!row.metadata) return false;
      try {
        return (JSON.parse(row.metadata) as { paymentSource?: string }).paymentSource === "LOOT_BOX";
      } catch {
        return false;
      }
    })();

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

      // Referans verənin EFFEKTİV tier-inə (manual override ya da xərcə görə AUTO)
      // görə oyun faizi resolve olunur.
      const referrerTierId = referredById ? await resolveEffectiveTierId(referredById) : null;
      const referralRatePct = referredById
        ? await resolveReferralRatePct({
            tierId: referrerTierId,
            target: { type: "PS_GAMES" },
            db: ptx as unknown as ReferralRateDb,
          })
        : 0;

      const price = computeDisplayPrice(gameRow, settings);
      const unitListCents = Math.round(price.finalAzn * 100);
      const tryForCost =
        gameRow.discountTryCents != null && gameRow.discountTryCents < gameRow.priceTryCents
          ? gameRow.discountTryCents
          : gameRow.priceTryCents;
      const unitCostCents = Math.round(tryCentsToCostAzn(tryForCost, settings) * 100);

      if (
        referredById &&
        referralRatePct > 0 &&
        !existingCommission &&
        !isLootBoxPrize
      ) {
        const profitCents = Math.max(0, unitListCents - unitCostCents);
        const commissionCents = Math.round((unitListCents * referralRatePct) / 100);
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
                kind: "GAME",
                lineCents: unitListCents,
                profitCents,
                shareRate: referralRatePct,
                tierId: referrerTierId,
              }),
            },
          });
        }
      }

      // Cycle bookkeeping (idempotent via the COMMISSION-existence guard
      // and the marker transaction inside `recordSuccessfulInvite`):
      //   • buyer earns 1 pt / AZN they themselves spent
      //   • inviter (if any) earns +10 pts on the referee's first success
      if (!existingCommission && !isLootBoxPrize) {
        try {
          await recordPurchaseSpend(ptx, row.userId, unitListCents);
          if (referredById) {
            await recordSuccessfulInvite(ptx, referredById, row.userId);
          }
        } catch (err) {
          console.error("referral cycle bookkeeping failed", err);
        }
      }

      // Rəy affiliate komissiyası — alışın metadata-sında reviewAffiliateId varsa
      // və rəy APPROVED + alıcı != müəllif şərtləri ödənirsə, müəllifə yazılır.
      // Klassik referrer komissiyasından ayrı və əlavə olaraq işləyir.
      try {
        if (row.metadata && !isLootBoxPrize) {
          const meta = JSON.parse(row.metadata) as {
            reviewAffiliateId?: string;
            reviewAffiliateLineCents?: number;
          };
          if (meta.reviewAffiliateId) {
            await awardReviewAffiliateCommission(ptx, {
              reviewId: meta.reviewAffiliateId,
              sourcePurchaseId: row.id,
              buyerUserId: row.userId,
              gameId: gameRow.id,
              lineCents: Math.max(
                0,
                Number(meta.reviewAffiliateLineCents) || unitListCents
              ),
              reviewAffiliateRatePct: settings.reviewAffiliateRatePct,
            });
          }
        }
      } catch (err) {
        console.error("review affiliate commission failed", err);
      }
    });

    if (row.user?.email) {
      await issueReviewInvite({
        transactionId: row.id,
        userId: row.userId,
        userEmail: row.user.email,
        userName: row.user.name,
        productTitle: gameRow.title,
        productType: gameRow.store === "EPIC" ? "EPIC_GAMES" : "GAME",
      });
    }

    if (row.user?.phone) {
      await sendOrderApprovedWhatsApp({
        phone: row.user.phone,
        userName: row.user.name,
        productTitle: gameRow.title,
        kind: "GAME",
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "FAILED") {
    if (row.status === "FAILED") {
      return NextResponse.json({ error: "Sifariş artıq ləğv olunub." }, { status: 400 });
    }
    if (row.status !== "PENDING" && row.status !== "SUCCESS") {
      return NextResponse.json(
        { error: "Bu statusda olan sifariş ləğv oluna bilməz." },
        { status: 400 }
      );
    }

    const reasonRaw = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reasonRaw) {
      return NextResponse.json(
        { error: "Ləğv etmə səbəbi tələb olunur." },
        { status: 400 }
      );
    }
    const cancelReason = reasonRaw.slice(0, 1000);
    const wasSuccess = row.status === "SUCCESS";

    await prisma.$transaction(async (ptx) => {
      const refundCents = Math.abs(row.amountAznCents);
      let toReferral = false;
      let existingMeta: Record<string, unknown> = {};
      try {
        if (row.metadata) {
          existingMeta = JSON.parse(row.metadata) as Record<string, unknown>;
          if ((existingMeta as { paymentSource?: string }).paymentSource === "REFERRAL") {
            toReferral = true;
          }
        }
      } catch {
        /* köhnə məlumat */
      }

      // If this purchase was already approved, undo the side effects that
      // happened on SUCCESS: referral commissions paid to the inviter, and
      // (best-effort) the cycle-spend bookkeeping for the buyer.
      if (wasSuccess) {
        const needle = `"sourcePurchaseId":"${row.id}"`;
        const commissions = await ptx.transaction.findMany({
          where: {
            type: "COMMISSION",
            status: "SUCCESS",
            metadata: { contains: needle },
          },
          select: { id: true, userId: true, amountAznCents: true, metadata: true },
        });
        for (const c of commissions) {
          const dec = Math.max(0, c.amountAznCents);
          if (dec > 0) {
            await ptx.user.update({
              where: { id: c.userId },
              data: { referralBalanceCents: { decrement: dec } },
            });
          }
          await ptx.transaction.update({
            where: { id: c.id },
            data: {
              status: "FAILED",
              metadata: JSON.stringify({
                kind: "COMMISSION_REVERSED",
                reason: "PURCHASE_CANCELLED",
                originalAmountCents: c.amountAznCents,
                cancelledPurchaseId: row.id,
                previousMetadata: c.metadata ?? null,
              }),
            },
          });
        }
      }

      const nextMeta = {
        ...existingMeta,
        cancelReason,
        cancelledAt: new Date().toISOString(),
        cancelledFromStatus: row.status,
      };

      await ptx.user.update({
        where: { id: row.userId },
        data: toReferral
          ? { referralBalanceCents: { increment: refundCents } }
          : { walletBalance: { increment: refundCents } },
      });
      await ptx.transaction.update({
        where: { id: row.id },
        data: { status: "FAILED", metadata: JSON.stringify(nextMeta) },
      });

      // Qutu hədiyyəsi çatdırıla bilmirsə müştəri əliboş qalmamalıdır: sifariş
      // ləğv olunanda hədiyyə avtomatik geri satılır və kredit cüzdana yazılır.
      // (Sifarişin öz məbləği 0-dır, ona görə yuxarıdakı refund heç nə vermir.)
      const lootBoxOpeningId =
        (existingMeta as { paymentSource?: string; lootBoxOpeningId?: string }).paymentSource === "LOOT_BOX"
          ? (existingMeta as { lootBoxOpeningId?: string }).lootBoxOpeningId
          : undefined;

      if (lootBoxOpeningId) {
        const opening = await ptx.lootBoxOpening.findUnique({
          where: { id: lootBoxOpeningId },
          include: { lootBox: { select: { sellBackPct: true, slug: true } } },
        });

        // Yalnız hələ oyun kimi götürülmüş açılışı geri satırıq (idempotent).
        if (opening && opening.outcome === "CLAIMED_GAME") {
          const credit = sellBackAmountCents(opening.valueAznCents, opening.lootBox.sellBackPct);
          const creditTx = await ptx.transaction.create({
            data: {
              userId: opening.userId,
              type: "DEPOSIT",
              status: "SUCCESS",
              amountAznCents: credit,
              metadata: JSON.stringify({
                kind: "LOOT_BOX_SELL_BACK",
                reason: "PRIZE_ORDER_CANCELLED",
                orderCode: opening.orderCode,
                lootBoxOpeningId: opening.id,
                lootBoxSlug: opening.lootBox.slug,
                prizeGameId: opening.gameId,
                prizeTitle: opening.titleSnap,
                prizeValueCents: opening.valueAznCents,
                sellBackPct: opening.lootBox.sellBackPct,
                cancelledPurchaseId: row.id,
              }),
            },
          });
          if (credit > 0) {
            await ptx.user.update({
              where: { id: opening.userId },
              data: { walletBalance: { increment: credit } },
            });
          }
          await ptx.lootBoxOpening.update({
            where: { id: opening.id },
            data: {
              outcome: "SOLD_BACK",
              sellBackCents: credit,
              sellBackTransactionId: creditTx.id,
              chosenAt: new Date(),
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tanınmayan əməl." }, { status: 400 });
}
