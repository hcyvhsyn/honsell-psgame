import { NextResponse } from "next/server";
import { normalizeAzPhone } from "@/lib/abunelik/phone";
import { isAbunelikConfigured, isAbunelikEnabled } from "@/lib/abunelik/session";
import { canDeliverOtp, issueOtp, OTP_TTL_MINUTES } from "@/lib/abunelik/otp";
import { fetchCrmSubscriptions } from "@/lib/crmRenewals";
import { checkCooldown, consumeDistinctRateLimit, consumeRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getClientIp } from "@/lib/clientInfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_COOLDOWN_SECONDS = 45;

/**
 * POST /api/abunelik/otp/send  { phone, turnstileToken? }
 * Nömrə CRM-də abunəliyi olan müştəriyə aiddirsə WhatsApp-a 6 rəqəmli kod göndərir.
 * Cavab nömrənin sistemdə olub-olmamasından ASILI DEYİL (enumeration-a qarşı) — kod yalnız
 * CRM müştərisinə gedir ki, təsadüfi nömrələrə spam getməsin.
 */
export async function POST(req: Request) {
  if (!isAbunelikEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAbunelikConfigured() || !canDeliverOtp()) {
    return NextResponse.json({ error: "Giriş müvəqqəti əlçatmazdır." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { phone?: string; turnstileToken?: string } | null;
  const phone = normalizeAzPhone(body?.phone);
  if (!phone) return NextResponse.json({ error: "Nömrəni düzgün yazın (məs. 050 123 45 67)." }, { status: 400 });

  const ip = getClientIp(req);
  const captcha = await verifyTurnstileToken(body?.turnstileToken, ip);
  if (!captcha.ok) return NextResponse.json({ error: "Təhlükəsizlik yoxlaması alınmadı. Yenidən cəhd edin." }, { status: 400 });

  const generic = NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES, resendInSeconds: RESEND_COOLDOWN_SECONDS });

  const cooldown = await checkCooldown({ key: `abunelik-otp:${phone.e164}`, cooldownSeconds: RESEND_COOLDOWN_SECONDS });
  if (!cooldown.ok) {
    return NextResponse.json(
      { error: `Yeni kod üçün ${cooldown.retryAfterSeconds} saniyə gözləyin.`, retryAfterSeconds: cooldown.retryAfterSeconds },
      { status: 429 },
    );
  }
  const perIp = await consumeDistinctRateLimit({
    key: `abunelik-otp-ip:${ip}`,
    scope: "abunelik-otp-ip",
    identifier: phone.e164,
    windowSeconds: 60 * 60,
    maxDistinct: 3,
  });
  if (!perIp.ok) {
    return NextResponse.json({ error: rateLimitMessage(perIp.retryAfterMinutes, perIp.retryAfterSeconds) }, { status: 429 });
  }
  const perPhone = await consumeRateLimit({
    key: `abunelik-otp:${phone.e164}`,
    scope: "abunelik-otp",
    windowSeconds: 24 * 60 * 60,
    max: 5,
  });
  if (!perPhone.ok) {
    return NextResponse.json({ error: rateLimitMessage(perPhone.retryAfterMinutes, perPhone.retryAfterSeconds) }, { status: 429 });
  }

  try {
    const crm = await fetchCrmSubscriptions(phone.e164);
    if (crm.items.length === 0) return generic; // CRM müştərisi deyil — kod göndərilmir, cavab eynidir
  } catch (e) {
    console.error("[abunelik:otp] CRM", e);
    return NextResponse.json({ error: "Abunəlik sistemi müvəqqəti cavab vermir. Bir az sonra yenidən cəhd edin." }, { status: 503 });
  }

  const sent = await issueOtp(phone.e164, ip === "unknown" ? null : ip);
  if (!sent.ok) {
    console.error("[abunelik:otp] WhatsApp", sent.error);
    return NextResponse.json({ error: "Kod göndərilmədi. Bir az sonra yenidən cəhd edin." }, { status: 502 });
  }
  return generic;
}
