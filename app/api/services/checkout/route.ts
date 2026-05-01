import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getLoyaltyTier } from "@/lib/loyalty";
import {
  applyCashbackToBalance,
  getLifetimeSpendAznForLoyalty,
} from "@/lib/loyaltyCashback";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { serviceProductId, psnAccountId, metadata } = body;

  const paymentSource: "wallet" | "referral" =
    body.paymentSource === "referral" ? "referral" : "wallet";
  const payTag = paymentSource === "referral" ? "REFERRAL" : "WALLET";

  if (!serviceProductId) return NextResponse.json({ error: "Xidmət seçilməyib." }, { status: 400 });

  const sp = await prisma.serviceProduct.findUnique({ where: { id: serviceProductId } });
  if (!sp || !sp.isActive) return NextResponse.json({ error: "Xidmət tapılmadı və ya aktiv deyil." }, { status: 404 });

  const price = sp.priceAznCents;
  if (paymentSource === "referral") {
    if (user.referralBalanceCents < price) {
      return NextResponse.json({ error: "Referal balansı kifayət etmir." }, { status: 400 });
    }
  } else if (user.walletBalance < price) {
    return NextResponse.json({ error: "Balans kifayət etmir." }, { status: 400 });
  }

  const debitPayload =
    paymentSource === "referral"
      ? { referralBalanceCents: { decrement: price } }
      : { walletBalance: { decrement: price } };

  const baseMeta =
    typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  const orderCode = `HON-${randomBytes(3).toString("hex").toUpperCase()}`;

  const spentAzn = await getLifetimeSpendAznForLoyalty(prisma, user.id);
  const loyalty = getLoyaltyTier(spentAzn);
  const loyaltyCashbackCents =
    loyalty.cashbackPct > 0 ? Math.round((price * loyalty.cashbackPct) / 100) : 0;
  const prevCashback = user.cashbackBalanceCents ?? 0;

  // TRY_BALANCE -> instant fulfilment və ya gözləmə
  if (sp.type === "TRY_BALANCE") {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const sc = await tx.serviceCode.findFirst({
          where: { serviceProductId: sp.id, isUsed: false },
          orderBy: { createdAt: "asc" },
        });

        await tx.user.update({
          where: { id: user.id },
          data: debitPayload,
        });

        if (!sc) {
          const svcRow = await tx.transaction.create({
            data: {
              userId: user.id,
              type: "SERVICE_PURCHASE",
              status: "PENDING",
              amountAznCents: -price,
              serviceProductId: sp.id,
              psnAccountId: psnAccountId || null,
              metadata: JSON.stringify({
                ...baseMeta,
                kind: "TRY_BALANCE",
                reason: "OUT_OF_STOCK",
                paymentSource: payTag,
                orderCode,
              }),
            },
          });
          if (loyaltyCashbackCents > 0) {
            await applyCashbackToBalance(tx, {
              userId: user.id,
              cashbackCents: loyaltyCashbackCents,
              tierLabel: loyalty.label,
              cashbackPct: loyalty.cashbackPct,
              sourcePurchaseIds: [],
              sourceServiceOrderIds: [svcRow.id],
              orderCode,
            });
          }
          return {
            pending: true as const,
            code: null as string | null,
            orderCode,
            cashbackCents: loyaltyCashbackCents,
          };
        }

        await tx.serviceCode.update({
          where: { id: sc.id },
          data: { isUsed: true },
        });

        const svcRow = await tx.transaction.create({
          data: {
            userId: user.id,
            type: "SERVICE_PURCHASE",
            status: "SUCCESS",
            amountAznCents: -price,
            serviceProductId: sp.id,
            serviceCodeId: sc.id,
            psnAccountId: psnAccountId || null,
            metadata: JSON.stringify({
              ...baseMeta,
              tryAmount: (sp.metadata as Record<string, unknown>)?.tryAmount,
              kind: "TRY_BALANCE",
              paymentSource: payTag,
              orderCode,
            }),
          },
        });

        if (loyaltyCashbackCents > 0) {
          await applyCashbackToBalance(tx, {
            userId: user.id,
            cashbackCents: loyaltyCashbackCents,
            tierLabel: loyalty.label,
            cashbackPct: loyalty.cashbackPct,
            sourcePurchaseIds: [],
            sourceServiceOrderIds: [svcRow.id],
            orderCode,
          });
        }

        return {
          pending: false as const,
          code: sc.code,
          orderCode,
          cashbackCents: loyaltyCashbackCents,
        };
      });

      return NextResponse.json({
        ok: true,
        ...result,
        paymentSourceUsed: paymentSource,
        cashbackPct: loyalty.cashbackPct,
        cashbackAzn: result.cashbackCents / 100,
        newCashbackBalanceAzn: (prevCashback + result.cashbackCents) / 100,
      });
    } catch {
      return NextResponse.json({ error: "Gözlənilməz xəta baş verdi." }, { status: 500 });
    }
  }

  try {
    let earnedCashback = 0;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: debitPayload,
      });

      const svcRow = await tx.transaction.create({
        data: {
          userId: user.id,
          type: "SERVICE_PURCHASE",
          status: "PENDING",
          amountAznCents: -price,
          serviceProductId: sp.id,
          psnAccountId: psnAccountId || null,
          metadata: JSON.stringify({
            ...baseMeta,
            paymentSource: payTag,
            orderCode,
          }),
        },
      });
      earnedCashback = loyaltyCashbackCents;
      if (loyaltyCashbackCents > 0) {
        await applyCashbackToBalance(tx, {
          userId: user.id,
          cashbackCents: loyaltyCashbackCents,
          tierLabel: loyalty.label,
          cashbackPct: loyalty.cashbackPct,
          sourcePurchaseIds: [],
          sourceServiceOrderIds: [svcRow.id],
          orderCode,
        });
      }
    });

    return NextResponse.json({
      ok: true,
      orderCode,
      paymentSourceUsed: paymentSource,
      cashbackPct: loyalty.cashbackPct,
      cashbackAzn: earnedCashback / 100,
      newCashbackBalanceAzn: (prevCashback + earnedCashback) / 100,
    });
  } catch {
    return NextResponse.json({ error: "Sifariş yaradıla bilmədi." }, { status: 500 });
  }
}
