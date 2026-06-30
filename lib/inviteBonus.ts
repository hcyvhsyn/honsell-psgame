import { prisma } from "@/lib/prisma";
import { assessInviteFraud } from "@/lib/inviteFraud";
import { getEffectiveTier } from "@/lib/customerTier";

/**
 * Sabit dəvət bonusu (signup bonus).
 *
 * Dəvət olunan istifadəçi nömrəsini/OTP-ni təsdiqlədikdə (emailVerified = true)
 * dəvət edənə Settings-dəki sabit məbləğ yazılır. Faiz komissiyasından (alışa
 * görə) tamamilə ayrıdır.
 *
 * Məbləğ dəvət EDƏNin müştəri tipinə görə seçilir:
 *   - "sponsorlu" seqment (və ya köhnə isSponsored) → sponsoredReferralInviteBonusCents
 *   - əks halda → referralInviteBonusCents (default 30 qəpik = 0.30 AZN)
 *
 * Anti-spam: şübhə yaranarsa bonus dərhal ödənmir — `status = HELD` saxlanır,
 * balans artmır, admin paneldə yoxlanır. Şübhə yoxdursa dərhal balansa keçir.
 *
 * Hər dəvət olunan üçün ən çoxu bir qeyd (refereeId @unique) — idempotentdir.
 */
export type InviteBonusOutcome =
  | { status: "PAID"; amountCents: number }
  | { status: "HELD"; amountCents: number; reasons: string[] }
  | null;

export async function awardInviteBonus(params: {
  refereeId: string;
  requestIp?: string | null;
}): Promise<InviteBonusOutcome> {
  const referee = await prisma.user.findUnique({
    where: { id: params.refereeId },
    select: { id: true, name: true, referredById: true },
  });
  if (!referee?.referredById) return null; // dəvət edən yoxdur

  const referrerId = referee.referredById;

  // İdempotentlik: bu dəvətli üçün artıq bonus qeydi varsa təkrarlama.
  const existing = await prisma.referralInviteBonus.findUnique({
    where: { refereeId: referee.id },
    select: { id: true },
  });
  if (existing) return null;

  const referrer = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { id: true, lastLoginIp: true },
  });
  if (!referrer) return null;

  // Dəvət bonusu məbləği dəvət EDƏNin EFFEKTİV tier-indən (manual override ya da
  // xərcə görə AUTO) gəlir.
  const effectiveTier = await getEffectiveTier(referrerId);
  const amountCents = effectiveTier?.inviteBonusCents ?? 0;
  if (!amountCents || amountCents <= 0) return null; // bu müştəri tipində bonus bağlıdır

  // Anti-spam qiymətləndirməsi.
  const fraud = await assessInviteFraud({
    refereeName: referee.name,
    refereeId: referee.id,
    referrerId,
    referrerLastIp: referrer.lastLoginIp,
    requestIp: params.requestIp ?? null,
  });

  // Şübhəli — saxla, balans artmır.
  if (fraud.suspicious) {
    try {
      await prisma.referralInviteBonus.create({
        data: {
          referrerId,
          refereeId: referee.id,
          amountCents,
          status: "HELD",
          suspicious: true,
          flagReasons: JSON.stringify(fraud.reasons),
        },
      });
    } catch {
      // Unique (refereeId) yarışı — başqa proses artıq yaradıb; sakitcə keç.
    }
    return { status: "HELD", amountCents, reasons: fraud.reasons };
  }

  // Təmiz — dərhal balansa yaz.
  try {
    await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          userId: referrerId,
          beneficiaryId: referrerId,
          type: "COMMISSION",
          status: "SUCCESS",
          amountAznCents: amountCents,
          metadata: JSON.stringify({ kind: "INVITE_BONUS", refereeId: referee.id }),
        },
      });
      await tx.user.update({
        where: { id: referrerId },
        data: { referralBalanceCents: { increment: amountCents } },
      });
      await tx.referralInviteBonus.create({
        data: {
          referrerId,
          refereeId: referee.id,
          amountCents,
          status: "PAID",
          suspicious: false,
          transactionId: txn.id,
        },
      });
    });
  } catch {
    // Unique (refereeId) yarışı — sakitcə keç.
    return null;
  }

  return { status: "PAID", amountCents };
}

/**
 * Gözləmədə (HELD) saxlanmış bonusu admin təsdiq edir → balansa keçir.
 * İdempotentdir: yalnız HELD statusunda və transactionId boş olduqda ödəyir.
 * Qaytarır: yenilənmiş status, yoxsa null (artıq emal olunub / tapılmadı).
 */
export async function approveHeldInviteBonus(
  bonusId: string,
  adminId: string
): Promise<{ amountCents: number } | null> {
  return prisma.$transaction(async (tx) => {
    const bonus = await tx.referralInviteBonus.findUnique({
      where: { id: bonusId },
      select: { id: true, referrerId: true, refereeId: true, amountCents: true, status: true },
    });
    if (!bonus || bonus.status !== "HELD") return null;

    const txn = await tx.transaction.create({
      data: {
        userId: bonus.referrerId,
        beneficiaryId: bonus.referrerId,
        type: "COMMISSION",
        status: "SUCCESS",
        amountAznCents: bonus.amountCents,
        metadata: JSON.stringify({
          kind: "INVITE_BONUS",
          refereeId: bonus.refereeId,
          adminApproved: true,
        }),
      },
    });
    await tx.user.update({
      where: { id: bonus.referrerId },
      data: { referralBalanceCents: { increment: bonus.amountCents } },
    });
    await tx.referralInviteBonus.update({
      where: { id: bonus.id },
      data: {
        status: "PAID",
        transactionId: txn.id,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });
    return { amountCents: bonus.amountCents };
  });
}

/** Gözləmədə (HELD) saxlanmış bonusu admin rədd edir → REJECTED, balans dəyişmir. */
export async function rejectHeldInviteBonus(
  bonusId: string,
  adminId: string
): Promise<boolean> {
  const res = await prisma.referralInviteBonus.updateMany({
    where: { id: bonusId, status: "HELD" },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: adminId },
  });
  return res.count > 0;
}
