import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, OTP_TTL_MINUTES } from "@/lib/resend";
import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";
import { normalizeFullName, validateFullName } from "@/lib/nameFormat";
import { REVIEW_TEXT_MIN, REVIEW_TEXT_MAX } from "@/lib/reviewTextLimits";
import { consumeRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { cleanupCommunityText } from "@/lib/communityModeration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function whatsappEnabled(): boolean {
  return (
    process.env.WHATSAPP_PROVIDER?.trim().toLowerCase() === "wasender" &&
    isWasenderConfigured()
  );
}

function otpText(userName: string, code: string): string {
  return [
    `Salam ${userName},`,
    ``,
    `Honsell PS Store rəy təsdiq kodun: *${code}*`,
    ``,
    `Kodun müddəti ${OTP_TTL_MINUTES} dəqiqəyə bitir.`,
    `Bu kodu kimsə ilə paylaşma.`,
  ].join("\n");
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
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

  const body = await req.json().catch(() => ({}));
  const name = normalizeFullName(body.name != null ? String(body.name) : "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const reviewText = typeof body.reviewText === "string" ? body.reviewText.trim() : "";
  const rating = Math.round(Number(body.rating) || 0);

  const nameError = validateFullName(name);
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Düzgün email ünvanı yazın." }, { status: 400 });
  }
  if (reviewText.length < REVIEW_TEXT_MIN) {
    return NextResponse.json(
      { error: `Rəy ən azı ${REVIEW_TEXT_MIN} simvol olmalıdır.` },
      { status: 400 }
    );
  }
  if (reviewText.length > REVIEW_TEXT_MAX) {
    return NextResponse.json(
      { error: `Rəy çox uzundur (max ${REVIEW_TEXT_MAX} simvol).` },
      { status: 400 }
    );
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Ulduz dərəcəsi səhvdir." }, { status: 400 });
  }

  // AI orfoqrafiya düzəlişi + təhlükəsizlik yoxlaması — OTP göndərməzdən əvvəl
  // (yolverilməz məzmun aşkarlansa, müştəri geri qayıdıb düzəldə bilər).
  const cleaned = await cleanupCommunityText({
    text: reviewText,
    kind: "post",
    maxLength: REVIEW_TEXT_MAX,
  });
  if (!cleaned.safeToPublish) {
    return NextResponse.json(
      { error: "Rəydə yolverilməz məzmun aşkarlandı. Zəhmət olmasa yenidən yaz." },
      { status: 400 }
    );
  }
  const finalReviewText = cleaned.text.length >= REVIEW_TEXT_MIN ? cleaned.text : reviewText;

  if (!whatsappEnabled()) {
    return NextResponse.json(
      { error: "WhatsApp təsdiq xidməti hazırda əlçatan deyil. Bir az sonra cəhd et." },
      { status: 503 }
    );
  }

  const phoneE164 = normalizeToE164(invite.phone);
  if (!phoneE164) {
    return NextResponse.json(
      { error: "Telefon nömrəsi düzgün deyil. Dəstəklə əlaqə saxla." },
      { status: 400 }
    );
  }

  // Telefon başına 24 saatda max 3 OTP.
  const limit = await consumeRateLimit({
    key: `wa-review-otp:${phoneE164}`,
    scope: "wa-review-otp",
    windowSeconds: 86400,
    max: 3,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: rateLimitMessage(limit.retryAfterMinutes, limit.retryAfterSeconds) },
      { status: 429 }
    );
  }

  const otpCode = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.whatsappReviewInvite.update({
    where: { id: invite.id },
    data: {
      name,
      email,
      reviewText: finalReviewText,
      rating,
      otpCode,
      otpExpiresAt,
      otpAttempts: 0,
      otpLockedUntil: null,
    },
  });

  const result = await sendWasenderText({
    to: phoneE164,
    text: otpText(name.split(" ")[0] || "dost", otpCode),
  });
  if (!result.ok) {
    console.error("[wa-review] otp send failed:", result.error);
    return NextResponse.json(
      { error: "WhatsApp təsdiq kodu göndərilə bilmədi. Bir az sonra yenidən cəhd et." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
}
