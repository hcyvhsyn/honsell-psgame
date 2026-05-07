import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  computeDisplayPrice,
  getSettings,
  tryCentsToCostAzn,
} from "@/lib/pricing";
import { getLoyaltyTier } from "@/lib/loyalty";
import {
  applyCashbackToBalance,
  getLifetimeSpendAznForLoyalty,
} from "@/lib/loyaltyCashback";
import { sendAdminOrderNotification, sendStreamingDeliveryEmail } from "@/lib/resend";
import {
  STREAMING_SERVICE_LABELS,
  addMonths,
  parseStreamingStock,
} from "@/lib/streamingCart";
import { awardStreamingReferralCommission } from "@/lib/streamingReferral";
import { evaluateReferralTiers } from "@/lib/referralTiers";

export const runtime = "nodejs";

type AccountCreationBody = {
  fullName: string;
  birthDate: string;
  email: string;
  password: string;
};

type StreamingBody = {
  gmail: string;
};

type CartLinePayload = {
  id: string;
  qty: number;
  accountCreation?: unknown;
  streaming?: unknown;
};

function splitFullName(full: string): { firstName: string; lastName: string } {
  const t = full.trim().replace(/\s+/g, " ");
  if (!t) return { firstName: "?", lastName: "-" };
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "-" };
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() || "-" };
}

function parseStreamingBody(raw: unknown):
  | { ok: true; value: StreamingBody }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Streaming xidməti üçün Gmail ünvanı tələb olunur." };
  }
  const o = raw as Record<string, unknown>;
  const gmail = typeof o.gmail === "string" ? o.gmail.trim().toLowerCase() : "";
  if (!gmail || !/^[^\s@]+@gmail\.com$/.test(gmail)) {
    return { ok: false, error: "Etibarlı Gmail ünvanı (@gmail.com) tələb olunur." };
  }
  return { ok: true, value: { gmail } };
}

function parseAccountCreationBody(raw: unknown):
  | { ok: true; value: AccountCreationBody }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Hesab açılışı üçün məlumatlar çatışmır." };
  }
  const o = raw as Record<string, unknown>;
  const fullName = typeof o.fullName === "string" ? o.fullName.trim() : "";
  const birthDate = typeof o.birthDate === "string" ? o.birthDate.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (!fullName) return { ok: false, error: "Ad və soyad tələb olunur." };
  if (!birthDate) return { ok: false, error: "Doğum tarixi tələb olunur." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Etibarlı e-poçt ünvanı tələb olunur." };
  }
  if (password.length < 8) return { ok: false, error: "Şifrə ən azı 8 simvol olmalıdır." };
  return { ok: true, value: { fullName, birthDate, email, password } };
}

/**
 * Atomic multi-item checkout. Body: { items [...], psnAccountId?, paymentSource?: "wallet" | "referral" }.
 *
 * PSN hesabı yalnız oyun / PS Plus / TRY (hədiyyə kartı) sətirləri varsa lazımdır.
 * Yalnız ACCOUNT_CREATION səbəti üçün psnAccountId göndərilməyə bilər.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawItems = Array.isArray(body.items) ? body.items : [];

  const payloads: CartLinePayload[] = rawItems
    .map((i: CartLinePayload) => ({
      id: typeof i?.id === "string" ? i.id : "",
      qty: Math.max(1, Math.min(20, Math.floor(Number(i?.qty) || 1))),
      accountCreation: i?.accountCreation,
      streaming: i?.streaming,
    }))
    .filter((i: CartLinePayload) => i.id);

  if (payloads.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const paymentSource: "wallet" | "referral" =
    body.paymentSource === "referral" ? "referral" : "wallet";

  const settings = await getSettings();
  const ids = payloads.map((i) => i.id);

  const [games, services] = await Promise.all([
    prisma.game.findMany({
      where: { id: { in: ids }, isActive: true },
    }),
    prisma.serviceProduct.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        type: { in: ["PS_PLUS", "TRY_BALANCE", "ACCOUNT_CREATION", "STREAMING"] },
      },
    }),
  ]);

  type GameModel = (typeof games)[number];
  type ServiceModel = (typeof services)[number];

  type LineUnion =
    | {
        kind: "GAME";
        game: GameModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      }
    | {
        kind: "TRY_BALANCE";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      }
    | {
        kind: "PS_PLUS";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      }
    | {
        kind: "ACCOUNT_CREATION";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
        detail: AccountCreationBody;
      }
    | {
        kind: "STREAMING";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
        deliveryMode: "CODE" | "GMAIL";
        gmail?: string;
      };

  if (games.length + services.length !== payloads.length) {
    return NextResponse.json(
      { error: "Some items are no longer available" },
      { status: 409 }
    );
  }

  const lines: LineUnion[] = [];

  for (const p of payloads) {
    const game = games.find((g) => g.id === p.id);
    if (game) {
      const price = computeDisplayPrice(game, settings);
      const unitListCents = Math.round(price.finalAzn * 100);
      const tryForCost =
        game.discountTryCents != null && game.discountTryCents < game.priceTryCents
          ? game.discountTryCents
          : game.priceTryCents;
      const unitCostCents = Math.round(tryCentsToCostAzn(tryForCost, settings) * 100);
      lines.push({
        kind: "GAME",
        game,
        qty: p.qty,
        unitListCents,
        unitCostCents,
        lineCents: unitListCents * p.qty,
      });
      continue;
    }

    const service = services.find((s) => s.id === p.id)!;

    if (service.type === "TRY_BALANCE") {
      lines.push({
        kind: "TRY_BALANCE",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
      });
      continue;
    }

    if (service.type === "PS_PLUS") {
      lines.push({
        kind: "PS_PLUS",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
      });
      continue;
    }

    if (service.type === "ACCOUNT_CREATION") {
      const parsed = parseAccountCreationBody(p.accountCreation);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      lines.push({
        kind: "ACCOUNT_CREATION",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
        detail: parsed.value,
      });
      continue;
    }

    if (service.type === "STREAMING") {
      const meta = (service.metadata as Record<string, unknown> | null) ?? {};
      const deliveryMode = String(meta.deliveryMode ?? "CODE") === "GMAIL" ? "GMAIL" : "CODE";
      let gmail: string | undefined;
      if (deliveryMode === "GMAIL") {
        const parsed = parseStreamingBody(p.streaming);
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        gmail = parsed.value.gmail;
      }
      lines.push({
        kind: "STREAMING",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
        deliveryMode,
        gmail,
      });
      continue;
    }
  }

  const needsPsn = lines.some(
    (l) => l.kind === "GAME" || l.kind === "PS_PLUS" || l.kind === "TRY_BALANCE"
  );

  const requestedAccountId =
    typeof body.psnAccountId === "string" ? body.psnAccountId : null;

  let psnAccount = null;

  if (needsPsn) {
    if (requestedAccountId) {
      psnAccount = await prisma.psnAccount.findUnique({
        where: { id: requestedAccountId },
      });
      if (!psnAccount || psnAccount.userId !== user.id) {
        return NextResponse.json({ error: "Invalid PSN account" }, { status: 400 });
      }
    } else {
      psnAccount = await prisma.psnAccount.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
    }

    if (!psnAccount) {
      return NextResponse.json(
        {
          error:
            "Alış üçün PlayStation hesabı əlavə edin və ya seçin ki, çatdırılma üçün istifadə olunsun.",
          code: "NO_PSN_ACCOUNT",
        },
        { status: 400 }
      );
    }
  }

  const totalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);

  const spentAzn = await getLifetimeSpendAznForLoyalty(prisma, user.id);
  const loyalty = getLoyaltyTier(spentAzn);

  if (paymentSource === "referral") {
    if (user.referralBalanceCents < totalCents) {
      return NextResponse.json(
        {
          error: "Referal balansı kifayət etmir.",
          requiredAzn: totalCents / 100,
          referralBalanceAzn: user.referralBalanceCents / 100,
        },
        { status: 402 }
      );
    }
  } else if (user.walletBalance < totalCents) {
    return NextResponse.json(
      {
        error: "Cüzdan balansı kifayət etmir.",
        requiredAzn: totalCents / 100,
        balanceAzn: user.walletBalance / 100,
      },
      { status: 402 }
    );
  }

  const payTag = paymentSource === "referral" ? ("REFERRAL" as const) : ("WALLET" as const);

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const orderCode = `HON-${randomBytes(3).toString("hex").toUpperCase()}`;

      await tx.user.update({
        where: { id: user.id },
        data:
          paymentSource === "referral"
            ? { referralBalanceCents: { decrement: totalCents } }
            : { walletBalance: { decrement: totalCents } },
      });

      const purchaseIds: string[] = [];
      const serviceOrderIds: string[] = [];
      const referredByForTierCheck = new Set<string>();
      const streamingDeliveries: Array<{
        codeRaw: string;
        productTitle: string;
        service: string;
        durationMonths: number;
        priceAznCents: number;
        startsAt: Date;
      }> = [];
      const totalCommissionCents = 0;
      let cashbackCents = 0;
      let tryBalancePendingCount = 0;
      let tryBalanceDeliveredCount = 0;

      const attachPsn = psnAccount?.id ?? null;

      for (const line of lines) {
        for (let n = 0; n < line.qty; n++) {
          if (line.kind === "GAME") {
            const purchase = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                gameId: line.game.id,
                psnAccountId: psnAccount!.id,
                metadata: JSON.stringify({
                  paymentSource: payTag,
                  fromCart: true,
                  manualDelivery: true,
                  fulfillmentStage: "NEW",
                  orderCode,
                }),
              },
            });
            purchaseIds.push(purchase.id);
          } else if (line.kind === "TRY_BALANCE") {
            const sc = await tx.serviceCode.findFirst({
              where: { serviceProductId: line.service.id, isUsed: false },
              orderBy: { createdAt: "asc" },
            });
            if (!sc) {
              const serviceOrder = await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: "SERVICE_PURCHASE",
                  status: "PENDING",
                  amountAznCents: -line.unitListCents,
                  serviceProductId: line.service.id,
                  psnAccountId: psnAccount!.id,
                  metadata: JSON.stringify({
                    fromCart: true,
                    kind: "TRY_BALANCE",
                    reason: "OUT_OF_STOCK",
                    paymentSource: payTag,
                    orderCode,
                  }),
                },
              });
              serviceOrderIds.push(serviceOrder.id);
              tryBalancePendingCount += 1;
            } else {
              await tx.serviceCode.update({
                where: { id: sc.id },
                data: { isUsed: true },
              });

              const serviceOrder = await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: "SERVICE_PURCHASE",
                  status: "SUCCESS",
                  amountAznCents: -line.unitListCents,
                  serviceProductId: line.service.id,
                  serviceCodeId: sc.id,
                  psnAccountId: psnAccount!.id,
                  metadata: JSON.stringify({
                    fromCart: true,
                    kind: "TRY_BALANCE",
                    paymentSource: payTag,
                    orderCode,
                  }),
                },
              });
              serviceOrderIds.push(serviceOrder.id);
              tryBalanceDeliveredCount += 1;
            }
          } else if (line.kind === "PS_PLUS") {
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                psnAccountId: attachPsn,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "PS_PLUS",
                  paymentSource: payTag,
                  orderCode,
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
          } else if (line.kind === "ACCOUNT_CREATION") {
            const names = splitFullName(line.detail.fullName);
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                psnAccountId: attachPsn,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "ACCOUNT_CREATION",
                  paymentSource: payTag,
                  orderCode,
                  firstName: names.firstName,
                  lastName: names.lastName,
                  birthDate: line.detail.birthDate,
                  email: line.detail.email,
                  password: line.detail.password,
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
          } else {
            // STREAMING
            if (line.deliveryMode === "CODE") {
              const sc = await tx.serviceCode.findFirst({
                where: { serviceProductId: line.service.id, isUsed: false },
                orderBy: { createdAt: "asc" },
              });
              if (!sc) {
                const serviceOrder = await tx.transaction.create({
                  data: {
                    userId: user.id,
                    type: "SERVICE_PURCHASE",
                    status: "PENDING",
                    amountAznCents: -line.unitListCents,
                    serviceProductId: line.service.id,
                    metadata: JSON.stringify({
                      fromCart: true,
                      kind: "STREAMING",
                      deliveryMode: "CODE",
                      reason: "OUT_OF_STOCK",
                      paymentSource: payTag,
                      orderCode,
                    }),
                  },
                });
                serviceOrderIds.push(serviceOrder.id);
              } else {
                await tx.serviceCode.update({
                  where: { id: sc.id },
                  data: { isUsed: true },
                });
                const serviceOrder = await tx.transaction.create({
                  data: {
                    userId: user.id,
                    type: "SERVICE_PURCHASE",
                    status: "SUCCESS",
                    amountAznCents: -line.unitListCents,
                    serviceProductId: line.service.id,
                    serviceCodeId: sc.id,
                    metadata: JSON.stringify({
                      fromCart: true,
                      kind: "STREAMING",
                      deliveryMode: "CODE",
                      paymentSource: payTag,
                      orderCode,
                    }),
                  },
                });
                serviceOrderIds.push(serviceOrder.id);
                const meta = (line.service.metadata as Record<string, unknown> | null) ?? {};
                streamingDeliveries.push({
                  codeRaw: sc.code,
                  productTitle: line.service.title,
                  service: String(meta.service ?? ""),
                  durationMonths: Number(meta.durationMonths ?? 0),
                  priceAznCents: line.unitListCents,
                  startsAt: serviceOrder.createdAt,
                });
                // Streaming üçün referal komissiyası
                const cm = await awardStreamingReferralCommission(tx, {
                  sourceTransactionId: serviceOrder.id,
                  buyerUserId: user.id,
                  serviceProductId: line.service.id,
                  lineCents: line.unitListCents,
                  streamingProfitSharePct: settings.referralStreamingProfitSharePct,
                });
                if (cm) referredByForTierCheck.add(cm.referredById);
              }
            } else {
              // GMAIL — manual delivery
              const serviceOrder = await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: "SERVICE_PURCHASE",
                  status: "PENDING",
                  amountAznCents: -line.unitListCents,
                  serviceProductId: line.service.id,
                  metadata: JSON.stringify({
                    fromCart: true,
                    kind: "STREAMING",
                    deliveryMode: "GMAIL",
                    paymentSource: payTag,
                    orderCode,
                    gmail: line.gmail,
                  }),
                },
              });
              serviceOrderIds.push(serviceOrder.id);
            }
          }
        }
      }

      if (loyalty.cashbackPct > 0) {
        cashbackCents = Math.round((totalCents * loyalty.cashbackPct) / 100);
        if (cashbackCents > 0) {
          await applyCashbackToBalance(tx, {
            userId: user.id,
            cashbackCents,
            tierLabel: loyalty.label,
            cashbackPct: loyalty.cashbackPct,
            sourcePurchaseIds: purchaseIds,
            sourceServiceOrderIds: serviceOrderIds,
            orderCode,
          });
        }
      }

      return {
        purchaseIds,
        serviceOrderIds,
        totalCommissionCents,
        cashbackCents,
        tryBalancePendingCount,
        tryBalanceDeliveredCount,
        orderCode,
        streamingDeliveries,
        referredByForTierCheck: Array.from(referredByForTierCheck),
      };
    });
  } catch (e: unknown) {
    throw e;
  }

  const cashbackCentsApplied = Number(result.cashbackCents ?? 0);

  let newWalletCents = user.walletBalance;
  let newReferralCents = user.referralBalanceCents;
  if (paymentSource === "wallet") {
    newWalletCents = user.walletBalance - totalCents;
    newReferralCents = user.referralBalanceCents;
  } else {
    newWalletCents = user.walletBalance;
    newReferralCents = user.referralBalanceCents - totalCents;
  }
  const prevCashbackCents = user.cashbackBalanceCents ?? 0;
  const newCashbackBalanceAzn = (prevCashbackCents + cashbackCentsApplied) / 100;

  const hasTryBalance = lines.some((l) => l.kind === "TRY_BALANCE");
  const tryBalancePendingCount = Number(result.tryBalancePendingCount ?? 0);
  const hasStreaming = lines.some((l) => l.kind === "STREAMING");

  // Tier mükafatı yoxlaması — komissiya yarananda referrer üçün cəhd et.
  for (const referrerId of result.referredByForTierCheck ?? []) {
    try {
      await evaluateReferralTiers(prisma, referrerId);
    } catch (err) {
      console.error("evaluateReferralTiers failed", err);
    }
  }

  if (Array.isArray(result.streamingDeliveries) && result.streamingDeliveries.length > 0) {
    for (const d of result.streamingDeliveries) {
      const entry = parseStreamingStock(d.codeRaw);
      if (!entry) continue;
      const startDate = d.startsAt;
      const endDate = addMonths(startDate, d.durationMonths);
      const fmt = (dt: Date) =>
        dt.toLocaleDateString("az-AZ", { day: "2-digit", month: "2-digit", year: "numeric" });
      try {
        await sendStreamingDeliveryEmail({
          email: user.email,
          userName: user.name ?? "dost",
          providerLabel: STREAMING_SERVICE_LABELS[d.service] ?? d.productTitle,
          accountEmail: entry.accountEmail,
          accountPassword: entry.accountPassword,
          slotName: entry.slotName,
          pinCode: entry.pinCode,
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          months: d.durationMonths,
          paymentAznFormatted: (d.priceAznCents / 100).toFixed(2),
          referralCode: user.referralCode,
        });
      } catch (err) {
        console.error("streaming delivery email failed", err);
      }
    }
  }

  try {
    await sendAdminOrderNotification({
      orderCode: result.orderCode,
      userEmail: user.email,
      userName: user.name,
      totalAzn: totalCents / 100,
      paymentSource,
      items: lines.map((l) => ({
        kind: l.kind,
        title: l.kind === "GAME" ? l.game.title : l.service.title,
        qty: l.qty,
        lineAzn: l.lineCents / 100,
      })),
    });
  } catch (notifyErr) {
    console.error("admin order notify failed", notifyErr);
  }

  return NextResponse.json({
    ok: true,
    orderCode: result.orderCode as string,
    hasTryBalance,
    tryBalancePendingCount,
    paymentSourceUsed: paymentSource,
    purchaseCount: result.purchaseIds.length + result.serviceOrderIds.length,
    paidAzn: totalCents / 100,
    cashbackAzn: cashbackCentsApplied / 100,
    cashbackPct: loyalty.cashbackPct,
    newCashbackBalanceAzn,
    commissionPaidAzn: result.totalCommissionCents / 100,
    newWalletBalanceAzn: newWalletCents / 100,
    newReferralBalanceAzn: newReferralCents / 100,
    newBalanceAzn: newWalletCents / 100,
    hasAccountCreation: lines.some((l) => l.kind === "ACCOUNT_CREATION"),
    hasStreaming,
    pendingGameFulfillmentQty: lines.reduce(
      (n, l) => n + (l.kind === "GAME" ? l.qty : 0),
      0
    ),
    deliveredTo: psnAccount
      ? {
          id: psnAccount.id,
          label: psnAccount.label,
          psnEmail: psnAccount.psnEmail,
        }
      : null,
  });
}
