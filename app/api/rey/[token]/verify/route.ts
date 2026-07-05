import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, generateReferralCode } from "@/lib/auth";
import { SET_PASSWORD_TTL_HOURS } from "@/lib/resend";
import { rateLimitMessage } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MINUTES = 15;

async function uniqueReferralCode(): Promise<string> {
  let code = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!clash) break;
    code = generateReferralCode();
  }
  return code;
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "6 rəqəmli kod tələb olunur." }, { status: 400 });
  }

  const invite = await prisma.whatsappReviewInvite.findUnique({
    where: { token: params.token },
  });
  if (!invite) {
    return NextResponse.json({ error: "Link tapılmadı." }, { status: 404 });
  }
  if (invite.usedAt) {
    return NextResponse.json({ error: "Bu link üçün artıq rəy yazılıb." }, { status: 409 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Link köhnəldi." }, { status: 410 });
  }
  if (!invite.otpCode || !invite.otpExpiresAt || !invite.email || !invite.name || !invite.reviewText) {
    return NextResponse.json(
      { error: "Aktiv təsdiq prosesi yoxdur. Kodu yenidən tələb et." },
      { status: 404 }
    );
  }

  // ── Lockout ──
  if (invite.otpLockedUntil && invite.otpLockedUntil.getTime() > Date.now()) {
    const retryAfterSeconds = Math.ceil((invite.otpLockedUntil.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      { error: rateLimitMessage(Math.ceil(retryAfterSeconds / 60), retryAfterSeconds) },
      { status: 429 }
    );
  }

  if (invite.otpExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Kodun müddəti bitib. Yeni kod tələb et." }, { status: 410 });
  }

  if (invite.otpCode !== code) {
    const nextAttempts = (invite.otpAttempts ?? 0) + 1;
    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      await prisma.whatsappReviewInvite.update({
        where: { id: invite.id },
        data: {
          otpAttempts: nextAttempts,
          otpLockedUntil: new Date(Date.now() + OTP_LOCK_MINUTES * 60_000),
          otpCode: null,
          otpExpiresAt: null,
        },
      });
      return NextResponse.json(
        { error: rateLimitMessage(OTP_LOCK_MINUTES, OTP_LOCK_MINUTES * 60) },
        { status: 429 }
      );
    }
    await prisma.whatsappReviewInvite.update({
      where: { id: invite.id },
      data: { otpAttempts: nextAttempts },
    });
    return NextResponse.json(
      { error: `Kod səhvdir. ${MAX_OTP_ATTEMPTS - nextAttempts} cəhd qaldı.` },
      { status: 401 }
    );
  }

  // ── Kod doğrudur — hesab + testimonial yarat ──
  const setPasswordToken = crypto.randomBytes(24).toString("base64url");
  const setPasswordExpires = new Date(Date.now() + SET_PASSWORD_TTL_HOURS * 60 * 60 * 1000);

  let userId: string;
  let referralCode: string;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Mövcud müştəri (admin telefonla tanıyıb) → birbaşa onu götür. Yoxdursa
      // telefon/email üzrə axtar (dublikat yaratma).
      const existing = invite.userId
        ? await tx.user.findUnique({ where: { id: invite.userId } })
        : await tx.user.findFirst({
            where: { OR: [{ phone: invite.phone }, { email: invite.email! }] },
          });

      // Həqiqi şifrəsi olmayan hesab (yeni və ya placeholder) şifrə təyin edə bilər.
      const hasRealPassword = Boolean(
        existing?.passwordHash && !existing.passwordHash.startsWith("pending:")
      );
      const canSetPassword = !hasRealPassword;

      let user;
      if (existing) {
        user = await tx.user.update({
          where: { id: existing.id },
          data: {
            emailVerified: true,
            name: existing.name ?? invite.name,
            phone: existing.phone ?? invite.phone,
            ...(canSetPassword
              ? { setPasswordToken, setPasswordTokenExpiresAt: setPasswordExpires }
              : {}),
          },
        });
      } else {
        const refCode = await uniqueReferralCode();
        // `passwordHash` schema-da tələb olunur — /set-password tamamlananda
        // üzərinə yazılan, giriş üçün yararsız sentinel saxlanılır.
        const placeholderHash = `pending:${crypto.randomBytes(16).toString("hex")}`;
        user = await tx.user.create({
          data: {
            email: invite.email!,
            name: invite.name,
            phone: invite.phone,
            passwordHash: placeholderHash,
            emailVerified: true,
            referralCode: refCode,
            setPasswordToken,
            setPasswordTokenExpiresAt: setPasswordExpires,
          },
        });
      }

      const testimonial = await tx.testimonial.create({
        data: {
          name: invite.name!,
          text: invite.reviewText!,
          rating: invite.rating ?? 5,
          platform: invite.platform,
          productTitle: invite.productTitle,
          isActive: true,
          sortOrder: 0,
        },
      });

      // Satış hələ qeydə alınmayıbsa (yeni müştəri — yazılışda hesab yox idi),
      // indi real SERVICE_PURCHASE yarat ki, homepage sifariş sayı + bestsellers artsın.
      // Mövcud müştəri üçün satış admin yazılışında yaradılıb (transactionId dolu).
      let saleTxnId = invite.transactionId;
      if (!saleTxnId && invite.serviceProductId && invite.priceAznCents != null) {
        const txn = await tx.transaction.create({
          data: {
            userId: user.id,
            type: "SERVICE_PURCHASE",
            status: "SUCCESS",
            serviceProductId: invite.serviceProductId,
            amountAznCents: -invite.priceAznCents,
            metadata: "whatsapp-review-invite",
          },
          select: { id: true },
        });
        saleTxnId = txn.id;
      }

      await tx.whatsappReviewInvite.update({
        where: { id: invite.id },
        data: {
          status: "SUBMITTED",
          usedAt: new Date(),
          createdUserId: user.id,
          testimonialId: testimonial.id,
          transactionId: saleTxnId,
          otpCode: null,
          otpExpiresAt: null,
          otpAttempts: 0,
          otpLockedUntil: null,
        },
      });

      return {
        userId: user.id,
        referralCode: user.referralCode,
        canSetPassword,
        saleCreated: saleTxnId !== invite.transactionId,
      };
    });
    userId = result.userId;
    referralCode = result.referralCode;

    // Yeni satış və ya yeni rəy — anasayfa sayğaclarını/rəyləri təzələ.
    if (result.saleCreated) revalidateTag("home");

    const res = NextResponse.json({
      ok: true,
      referralCode,
      setPasswordToken: result.canSetPassword ? setPasswordToken : null,
    });
    res.cookies.set(SESSION_COOKIE_NAME, userId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    console.error("[wa-review] verify/create failed", err);
    return NextResponse.json({ error: "Rəy göndərmək alınmadı." }, { status: 500 });
  }
}
