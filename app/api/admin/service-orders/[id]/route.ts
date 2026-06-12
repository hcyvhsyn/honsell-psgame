import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendGiftCardCodeEmail, sendStreamingDeliveryEmail } from "@/lib/resend";
import { issueReviewInvite, type ReviewProductType } from "@/lib/reviewInvite";
import {
  createEaPlaySubscriptionFromTransaction,
  createPlatformSubscriptionFromTransaction,
  createSubscriptionFromTransaction,
} from "@/lib/subscriptions";
import {
  STREAMING_SERVICE_LABELS,
  addMonths,
} from "@/lib/streamingCart";
import { awardStreamingReferralCommission } from "@/lib/streamingReferral";
import {
  recordPurchaseSpend,
  recordSuccessfulInvite,
} from "@/lib/referralCycle";
import { sendOrderApprovedWhatsApp } from "@/lib/orderNotifications";

function reviewProductTypeFromService(type: string | undefined): ReviewProductType | null {
  switch (type) {
    case "PS_PLUS":
      return "PS_PLUS";
    case "EA_PLAY":
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

/** Sifariş təsdiqlənəndə müştəriyə WhatsApp təsdiq mesajı göndərir (telefon və WaSender konfiqurasiya olmayanda səssiz keçir). */
async function maybeNotifyApprovalWhatsApp(tx: {
  user?: { name: string | null; phone: string | null } | null;
  serviceProduct?: { title: string | null; type: string | null } | null;
}) {
  if (!tx.user?.phone) return;
  await sendOrderApprovedWhatsApp({
    phone: tx.user.phone,
    userName: tx.user.name,
    productTitle: tx.serviceProduct?.title ?? null,
    kind: tx.serviceProduct?.type ?? undefined,
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
  if (!tx || tx.type !== "SERVICE_PURCHASE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // SUCCESS-yi yalnız ləğv etmək üçün qəbul edirik. SUCCESS yenidən təsdiqlənə bilməz.
  if (action === "SUCCESS" && tx.status !== "PENDING") {
    return NextResponse.json({ error: "Not pending" }, { status: 400 });
  }
  if (action === "FAILED" && tx.status === "FAILED") {
    return NextResponse.json({ error: "Sifariş artıq ləğv olunub." }, { status: 400 });
  }
  if (action === "FAILED" && tx.status !== "PENDING" && tx.status !== "SUCCESS") {
    return NextResponse.json(
      { error: "Bu statusda olan sifariş ləğv oluna bilməz." },
      { status: 400 }
    );
  }

  if (action === "FAILED") {
    const reasonRaw = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reasonRaw) {
      return NextResponse.json(
        { error: "Ləğv etmə səbəbi tələb olunur." },
        { status: 400 }
      );
    }
    const cancelReason = reasonRaw.slice(0, 1000);
    const wasSuccess = tx.status === "SUCCESS";

    await prisma.$transaction(async (ptx) => {
      const refundCents = Math.abs(tx.amountAznCents);
      let refundToReferral = false;
      let existingMeta: Record<string, unknown> = {};
      try {
        if (tx.metadata) {
          existingMeta = JSON.parse(tx.metadata) as Record<string, unknown>;
          if ((existingMeta as { paymentSource?: string }).paymentSource === "REFERRAL") {
            refundToReferral = true;
          }
        }
      } catch {
        /* köhnə sifarişlər → cüzdan */
      }

      // Təsdiqlənmiş sifarişdə inviter-ə yazılmış komissiyaları geri al.
      if (wasSuccess) {
        const needle = `"sourcePurchaseId":"${tx.id}"`;
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
                reason: "SERVICE_ORDER_CANCELLED",
                originalAmountCents: c.amountAznCents,
                cancelledTransactionId: tx.id,
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
        cancelledFromStatus: tx.status,
      };

      await ptx.user.update({
        where: { id: tx.userId },
        data: refundToReferral
          ? { referralBalanceCents: { increment: refundCents } }
          : { walletBalance: { increment: refundCents } },
      });
      await ptx.transaction.update({
        where: { id: tx.id },
        data: { status: "FAILED", metadata: JSON.stringify(nextMeta) },
      });
    });
    return NextResponse.json({ ok: true });
  }

  // SUCCESS (approval) flow
  const productType = tx.serviceProduct?.type;
  if (productType === "TRY_BALANCE") {
    // Admin modal-dan birbaşa kod daxil edə bilər (stokda kod olmadıqda
    // və ya hər halda manual təslim etmək istədikdə). Boşluq/defislər silinir,
    // boş string-dirsə stokdan götürmə axınına düşür.
    const manualCodeRaw = typeof body?.code === "string" ? body.code.trim() : "";
    const manualCode = manualCodeRaw.replace(/[\s-]+/g, "");

    // Allocate code on approval if not already allocated.
    const updated = await prisma.$transaction(async (ptx) => {
      let serviceCodeId = tx.serviceCodeId;
      let codeValue = tx.serviceCode?.code ?? null;

      if (!serviceCodeId) {
        if (manualCode) {
          const sc = await ptx.serviceCode.create({
            data: {
              serviceProductId: tx.serviceProductId ?? "",
              code: manualCode,
              isUsed: true,
            },
          });
          serviceCodeId = sc.id;
          codeValue = sc.code;
        } else {
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
      }

      await ptx.transaction.update({
        where: { id: tx.id },
        data: { status: "SUCCESS", serviceCodeId },
      });

      const cm = await awardStreamingReferralCommission(ptx, {
        sourceTransactionId: tx.id,
        buyerUserId: tx.userId,
        serviceProductId: tx.serviceProductId,
        lineCents: Math.abs(tx.amountAznCents),
        target: { type: "GIFT_CARDS" },
        kind: "TRY_BALANCE",
      });

      try {
        await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
        if (cm?.referredById) {
          await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
        }
      } catch (err) {
        console.error("referral cycle bookkeeping failed", err);
      }

      return { ok: true as const, code: codeValue };
    });

    if (!updated.ok) {
      return NextResponse.json(
        {
          error: "Hazırda stokda e-pin yoxdur. Zəhmət olmasa kod əlavə edib yenidən cəhd edin.",
          reason: "OUT_OF_STOCK",
        },
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
    await maybeNotifyApprovalWhatsApp(tx);
    return NextResponse.json({ ok: true });
  }

  if (productType === "STREAMING") {
    // STREAMING — admin sadəcə "Təsdiq" düyməsinə basır (modal yoxdur).
    // Hesab kreditiyaları sistemdə saxlanmır; müştəriyə kreditiyasız
    // "abunəlik aktivdir" emaili gedir, məlumat ayrıca çatdırılır.
    const productMeta = (tx.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};

    await prisma.$transaction(async (ptx) => {
      await ptx.transaction.update({
        where: { id: tx.id },
        data: { status: "SUCCESS" },
      });

      const cm = await awardStreamingReferralCommission(ptx, {
        sourceTransactionId: tx.id,
        buyerUserId: tx.userId,
        serviceProductId: tx.serviceProductId,
        lineCents: Math.abs(tx.amountAznCents),
        target: { type: "SERVICE_PRODUCT", serviceProductId: tx.serviceProductId ?? "" },
        kind: "STREAMING",
      });

      try {
        await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
        if (cm?.referredById) {
          await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
        }
      } catch (err) {
        console.error("referral cycle bookkeeping failed", err);
      }
    });

    if (tx.user?.email) {
      const months = Number(productMeta.durationMonths ?? 0);
      const serviceKey = String(productMeta.service ?? "");
      const startDate = tx.createdAt;
      const endDate = addMonths(startDate, months);
      const fmt = (dt: Date) =>
        dt.toLocaleDateString("az-AZ", { day: "2-digit", month: "2-digit", year: "numeric" });
      try {
        await sendStreamingDeliveryEmail({
          email: tx.user.email,
          userName: tx.user.name ?? "dost",
          providerLabel: STREAMING_SERVICE_LABELS[serviceKey] ?? tx.serviceProduct?.title ?? "Streaming",
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

    await maybeSendReviewInvite(tx);
    await maybeNotifyApprovalWhatsApp(tx);
    return NextResponse.json({ ok: true });
  }

  if (productType === "PLATFORM") {
    // PLATFORM (AI, Musiqi, İş) — admin əl ilə kreditiya daxil etmir.
    // Məhsul hazır olanda sadəcə "Təsdiq" düyməsinə basır, abunə yaradılır.
    await prisma.$transaction(async (ptx) => {
      await ptx.transaction.update({
        where: { id: tx.id },
        data: { status: "SUCCESS" },
      });

      if (tx.serviceProductId) {
        await createPlatformSubscriptionFromTransaction(ptx, {
          transactionId: tx.id,
          userId: tx.userId,
          serviceProductId: tx.serviceProductId,
          priceAznCents: tx.amountAznCents,
          serviceProductMetadata: tx.serviceProduct?.metadata,
        });
      }

      const cm = await awardStreamingReferralCommission(ptx, {
        sourceTransactionId: tx.id,
        buyerUserId: tx.userId,
        serviceProductId: tx.serviceProductId,
        lineCents: Math.abs(tx.amountAznCents),
        target: { type: "SERVICE_PRODUCT", serviceProductId: tx.serviceProductId ?? "" },
        kind: "PLATFORM",
      });

      try {
        await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
        if (cm?.referredById) {
          await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
        }
      } catch (err) {
        console.error("referral cycle bookkeeping failed", err);
      }
    });

    await maybeSendReviewInvite(tx);
    await maybeNotifyApprovalWhatsApp(tx);
    return NextResponse.json({ ok: true });
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

      const cm = await awardStreamingReferralCommission(ptx, {
        sourceTransactionId: tx.id,
        buyerUserId: tx.userId,
        serviceProductId: tx.serviceProductId,
        lineCents: Math.abs(tx.amountAznCents),
        target: { type: "ACCOUNT_CREATION" },
        kind: "ACCOUNT_CREATION",
      });

      try {
        await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
        if (cm?.referredById) {
          await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
        }
      } catch (err) {
        console.error("referral cycle bookkeeping failed", err);
      }
    });

    await maybeSendReviewInvite(tx);
    await maybeNotifyApprovalWhatsApp(tx);
    return NextResponse.json({ ok: true });
  }

  if (productType === "EPIC_ACCOUNT_CREATION") {
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
    const firstName = typeof meta.firstName === "string" ? meta.firstName.trim() : "";
    const lastName = typeof meta.lastName === "string" ? meta.lastName.trim() : "";
    const birthDate = typeof meta.birthDate === "string" ? meta.birthDate.trim() : "";
    const displayName = typeof meta.displayName === "string" ? meta.displayName.trim() : "";
    if (!email || !password) {
      return NextResponse.json(
        { error: "Sifarişdə müştəri e-poçtu və ya şifrəsi yoxdur." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (ptx) => {
      let epicAccountId: string | null = null;

      const existingAcc = await ptx.epicAccount.findFirst({
        where: { userId: tx.userId, epicEmail: email },
      });

      if (existingAcc) {
        epicAccountId = existingAcc.id;
      } else {
        const label =
          (displayName || `${firstName} ${lastName}`.trim()).slice(0, 60) ||
          "Türkiyə Epic";
        const count = await ptx.epicAccount.count({ where: { userId: tx.userId } });
        const created = await ptx.epicAccount.create({
          data: {
            userId: tx.userId,
            label,
            firstName,
            lastName,
            birthDate,
            epicEmail: email,
            epicPassword: password,
            displayName: displayName || label,
            isDefault: count === 0,
          },
        });
        epicAccountId = created.id;
      }

      await ptx.transaction.update({
        where: { id: tx.id },
        data: {
          status: "SUCCESS",
          ...(epicAccountId ? { epicAccountId } : {}),
        },
      });

      // Any Epic game purchases in the same order that don't yet have a delivery
      // account (bought together with this creation) get linked to it now.
      if (epicAccountId) {
        const orderCode = typeof meta.orderCode === "string" ? meta.orderCode : null;
        if (orderCode) {
          await ptx.transaction.updateMany({
            where: {
              userId: tx.userId,
              type: "PURCHASE",
              epicAccountId: null,
              metadata: { contains: `"orderCode":"${orderCode}"` },
            },
            data: { epicAccountId },
          });
        }
      }

      const cm = await awardStreamingReferralCommission(ptx, {
        sourceTransactionId: tx.id,
        buyerUserId: tx.userId,
        serviceProductId: tx.serviceProductId,
        lineCents: Math.abs(tx.amountAznCents),
        target: { type: "ACCOUNT_CREATION" },
        kind: "ACCOUNT_CREATION",
      });

      try {
        await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
        if (cm?.referredById) {
          await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
        }
      } catch (err) {
        console.error("referral cycle bookkeeping failed", err);
      }
    });

    await maybeSendReviewInvite(tx);
    await maybeNotifyApprovalWhatsApp(tx);
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

      const cm = await awardStreamingReferralCommission(ptx, {
        sourceTransactionId: tx.id,
        buyerUserId: tx.userId,
        serviceProductId: tx.serviceProductId,
        lineCents: Math.abs(tx.amountAznCents),
        target: { type: "PS_PLUS" },
        kind: "PS_PLUS",
      });

      try {
        await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
        if (cm?.referredById) {
          await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
        }
      } catch (err) {
        console.error("referral cycle bookkeeping failed", err);
      }
    }

    if (productType === "EA_PLAY" && tx.serviceProductId) {
      await createEaPlaySubscriptionFromTransaction(ptx, {
        transactionId: tx.id,
        userId: tx.userId,
        serviceProductId: tx.serviceProductId,
        psnAccountId: tx.psnAccountId,
        priceAznCents: tx.amountAznCents,
        serviceProductMetadata: tx.serviceProduct?.metadata,
      });

      const cm = await awardStreamingReferralCommission(ptx, {
        sourceTransactionId: tx.id,
        buyerUserId: tx.userId,
        serviceProductId: tx.serviceProductId,
        lineCents: Math.abs(tx.amountAznCents),
        target: { type: "PS_PLUS" },
        kind: "EA_PLAY",
      });

      try {
        await recordPurchaseSpend(ptx, tx.userId, Math.abs(tx.amountAznCents));
        if (cm?.referredById) {
          await recordSuccessfulInvite(ptx, cm.referredById, tx.userId);
        }
      } catch (err) {
        console.error("referral cycle bookkeeping failed", err);
      }
    }
  });

  await maybeSendReviewInvite(tx);
  await maybeNotifyApprovalWhatsApp(tx);
  return NextResponse.json({ ok: true });
}
