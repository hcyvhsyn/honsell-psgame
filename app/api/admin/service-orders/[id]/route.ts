import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendGiftCardCodeEmail, sendStreamingDeliveryEmail } from "@/lib/resend";
import { issueReviewInvite, type ReviewProductType } from "@/lib/reviewInvite";
import { createSubscriptionFromTransaction } from "@/lib/subscriptions";
import {
  STREAMING_SERVICE_LABELS,
  addMonths,
  parseStreamingStock,
} from "@/lib/streamingCart";
import { awardStreamingReferralCommission } from "@/lib/streamingReferral";
import {
  recordPurchaseSpend,
  recordSuccessfulInvite,
} from "@/lib/referralCycle";
import { getSettings } from "@/lib/pricing";

function reviewProductTypeFromService(type: string | undefined): ReviewProductType | null {
  switch (type) {
    case "PS_PLUS":
      return "PS_PLUS";
    case "TRY_BALANCE":
      return "GIFT_CARD";
    case "ACCOUNT_CREATION":
      return "ACCOUNT_CREATION";
    case "STREAMING":
      return "GIFT_CARD";
    default:
      return null;
  }
}

async function maybeSendReviewInvite(tx: {
  id: string;
  userId: string;
  user?: { email: string; name: string | null } | null;
  serviceProduct?: { title: string; type: string } | null;
}) {
  const productType = reviewProductTypeFromService(tx.serviceProduct?.type);
  if (!productType || !tx.user?.email || !tx.serviceProduct?.title) return;
  await issueReviewInvite({
    transactionId: tx.id,
    userId: tx.userId,
    userEmail: tx.user.email,
    userName: tx.user.name,
    productTitle: tx.serviceProduct.title,
    productType,
  });
}

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (action !== "SUCCESS" && action !== "FAILED") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      serviceProduct: true,
      serviceCode: true,
    },
  });
  if (!tx || tx.type !== "SERVICE_PURCHASE" || tx.status !== "PENDING") {
    return NextResponse.json({ error: "Not found or not pending" }, { status: 404 });
  }

  if (action === "FAILED") {
    await prisma.$transaction(async (ptx) => {
      const refundCents = Math.abs(tx.amountAznCents);
      let refundToReferral = false;
      try {
        if (tx.metadata) {
          const meta = JSON.parse(tx.metadata) as { paymentSource?: string };
          if (meta.paymentSource === "REFERRAL") refundToReferral = true;
        }
      } catch {
        /* köhnə sifarişlər → cüzdan */
      }
      await ptx.user.update({
        where: { id: tx.userId },
        data: refundToReferral
          ? { referralBalanceCents: { increment: refundCents } }
          : { walletBalance: { increment: refundCents } },
      });
      await ptx.transaction.update({
        where: { id: tx.id },
        data: { status: "FAILED" },
      });
    });
    return NextResponse.json({ ok: true });
  }

  // SUCCESS (approval) flow
  const productType = tx.serviceProduct?.type;
  if (productType === "TRY_BALANCE") {
    // Allocate code on approval if not already allocated.
    const updated = await prisma.$transaction(async (ptx) => {
      let serviceCodeId = tx.serviceCodeId;
      let codeValue = tx.serviceCode?.code ?? null;

      if (!serviceCodeId) {
        const sc = await ptx.serviceCode.findFirst({
          where: { serviceProductId: tx.serviceProductId ?? "", isUsed: false },
          orderBy: { createdAt: "asc" },
        });
        if (!sc) return { ok: false as const, reason: "OUT_OF_STOCK" as const };

        await ptx.serviceCode.update({
          where: { id: sc.id },
          data: { isUsed: true },
        });
        serviceCodeId = sc.id;
        codeValue = sc.code;
      }

      await ptx.transaction.update({
        where: { id: tx.id },
        data: { status: "SUCCESS", serviceCodeId },
      });

      return { ok: true as const, code: codeValue };
    });

    if (!updated.ok) {
      return NextResponse.json(
        { error: "Hazırda stokda e-pin yoxdur. Zəhmət olmasa kod əlavə edib yenidən cəhd edin." },
        { status: 409 }
      );
    }

    const email = tx.user?.email;
    if (email && updated.code) {
      const userName = tx.user?.name ?? "dost";
      const productTitle = tx.serviceProduct?.title ?? "Hədiyyə kartı";
      await sendGiftCardCodeEmail({
        email,
        userName,
        productTitle,
        code: updated.code,
        referralCode: tx.user?.referralCode ?? null,
      });
    }

    await maybeSendReviewInvite(tx);
    return NextResponse.json({ ok: true });
  }

  if (productType === "STREAMING") {
    let deliveryMode: "CODE" | "GMAIL" = "CODE";
    let metaObj: Record<string, unknown> = {};
    try {
      if (tx.metadata) {
        metaObj = JSON.parse(tx.metadata) as Record<string, unknown>;
        if (metaObj.deliveryMode === "GMAIL") deliveryMode = "GMAIL";
      }
    } catch {
      /* ignore */
    }

    let deliveredCodeRaw: string | null = null;
    const settings = await getSettings();

    const updated = await prisma.$transaction(async (ptx) => {
      let serviceCodeId = tx.serviceCodeId;
      let codeValue = tx.serviceCode?.code ?? null;

      if (deliveryMode === "CODE" && !serviceCodeId) {
        const sc = await ptx.serviceCode.findFirst({
          where: { serviceProductId: tx.serviceProductId ?? "", isUsed: false },
          orderBy: { createdAt: "asc" },
        });
        if (!sc) return { ok: false as const, reason: "OUT_OF_STOCK" as const };

        await ptx.serviceCode.update({ where: { id: sc.id }, data: { isUsed: true } });
        serviceCodeId = sc.id;
        codeValue = sc.code;
      }

      await ptx.transaction.update({
        where: { id: tx.id },
        data: {
          status: "SUCCESS",
          ...(serviceCodeId ? { serviceCodeId } : {}),
        },
      });

      // Streaming referral commission (mənbə Transaction-a görə təkrarlanmır).
      const cm = await awardStreamingReferralCommission(ptx, {
        sourceTransactionId: tx.id,
        buyerUserId: tx.userId,
        serviceProductId: tx.serviceProductId,
        lineCents: Math.abs(tx.amountAznCents),
        streamingProfitSharePct: settings.referralStreamingProfitSharePct,
      });

      // Cycle bookkeeping:
      //   • buyer earns own-spend points regardless of whether they were invited
      //   • inviter (if any) earns +10 pts on referee's first SUCCESS purchase
      try {
        await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
        if (cm?.referredById) {
          await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
        }
      } catch (err) {
        console.error("referral cycle bookkeeping failed", err);
      }

      return {
        ok: true as const,
        code: codeValue,
        commissionedReferrerId: cm?.referredById ?? null,
      };
    });

    if (!updated.ok) {
      return NextResponse.json(
        { error: "Stokda streaming məlumatı yoxdur. Stok əlavə edib yenidən cəhd edin." },
        { status: 409 }
      );
    }

    deliveredCodeRaw = updated.code;

    if (deliveryMode === "CODE" && deliveredCodeRaw && tx.user?.email) {
      const entry = parseStreamingStock(deliveredCodeRaw);
      const productMeta = (tx.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
      const months = Number(productMeta.durationMonths ?? 0);
      const serviceKey = String(productMeta.service ?? "");
      const startDate = tx.createdAt;
      const endDate = addMonths(startDate, months);
      const fmt = (dt: Date) =>
        dt.toLocaleDateString("az-AZ", { day: "2-digit", month: "2-digit", year: "numeric" });
      if (entry) {
        try {
          await sendStreamingDeliveryEmail({
            email: tx.user.email,
            userName: tx.user.name ?? "dost",
            providerLabel: STREAMING_SERVICE_LABELS[serviceKey] ?? tx.serviceProduct?.title ?? "Streaming",
            accountEmail: entry.accountEmail,
            accountPassword: entry.accountPassword,
            slotName: entry.slotName,
            pinCode: entry.pinCode,
            startDate: fmt(startDate),
            endDate: fmt(endDate),
            months,
            paymentAznFormatted: (Math.abs(tx.amountAznCents) / 100).toFixed(2),
            referralCode: tx.user.referralCode ?? null,
          });
        } catch (err) {
          console.error("streaming delivery email failed", err);
        }
      }
    }

    await maybeSendReviewInvite(tx);
    return NextResponse.json({ ok: true, deliveryMode });
  }

  if (productType === "ACCOUNT_CREATION") {
    let meta: Record<string, unknown> = {};
    try {
      if (tx.metadata) meta = JSON.parse(tx.metadata) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Sifariş məlumatları oxunmur (metadata)." },
        { status: 400 }
      );
    }

    const email = typeof meta.email === "string" ? meta.email.trim().toLowerCase() : "";
    const password = typeof meta.password === "string" ? meta.password : "";
    if (!email || !password) {
      return NextResponse.json(
        { error: "Sifarişdə müştəri e-poçtu və ya şifrəsi yoxdur." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (ptx) => {
      let psnAccountId: string | null = null;

      const existingAcc = await ptx.psnAccount.findFirst({
        where: { userId: tx.userId, psnEmail: email },
      });

      if (existingAcc) {
        psnAccountId = existingAcc.id;
      } else {
        const nickname =
          typeof meta.firstName === "string" || typeof meta.lastName === "string"
            ? `${String(meta.firstName ?? "").trim()} ${String(meta.lastName ?? "").trim()}`.trim().slice(
                0,
                120
              ) || "Türkiyə PSN"
            : "Türkiyə PSN";
        const count = await ptx.psnAccount.count({ where: { userId: tx.userId } });
        const created = await ptx.psnAccount.create({
          data: {
            userId: tx.userId,
            label: nickname.length > 0 ? nickname : "Türkiyə PSN",
            psnEmail: email,
            psnPassword: password,
            psModel: "PS5",
            isDefault: count === 0,
          },
        });
        psnAccountId = created.id;
      }

      await ptx.transaction.update({
        where: { id: tx.id },
        data: {
          status: "SUCCESS",
          ...(psnAccountId ? { psnAccountId } : {}),
        },
      });
    });

    await maybeSendReviewInvite(tx);
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(async (ptx) => {
    await ptx.transaction.update({
      where: { id: tx.id },
      data: { status: "SUCCESS" },
    });

    if (productType === "PS_PLUS" && tx.serviceProductId) {
      await createSubscriptionFromTransaction(ptx, {
        transactionId: tx.id,
        userId: tx.userId,
        serviceProductId: tx.serviceProductId,
        psnAccountId: tx.psnAccountId,
        priceAznCents: tx.amountAznCents,
        serviceProductMetadata: tx.serviceProduct?.metadata,
      });
    }
  });

  await maybeSendReviewInvite(tx);
  return NextResponse.json({ ok: true });
}
