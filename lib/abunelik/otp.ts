import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isWasenderConfigured, sendWasenderText } from "@/lib/wasender";

/**
 * /abunelik WhatsApp giriş kodu. Kod `crypto.randomInt` ilə, DB-də yalnız HMAC hash (açıq kod yoxdur),
 * müqayisə sabit vaxtlı. 10 dəqiqə, 5 cəhd. Lokal dev: ABUNELIK_OTP_DEV_ECHO=1 → kod log-a yazılır.
 */
export const OTP_PURPOSE = "ABUNELIK";
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

function otpSecret(): string {
  return (
    process.env.ABUNELIK_COOKIE_SECRET?.trim() ||
    crypto.createHash("sha256").update(`abunelik-otp|${process.env.DATABASE_URL ?? ""}`).digest("hex")
  );
}

export function hashOtp(phoneE164: string, code: string): string {
  return crypto.createHmac("sha256", otpSecret()).update(`${phoneE164}|${code}`).digest("hex");
}

export function otpMatches(phoneE164: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(phoneE164, code));
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function devEcho(): boolean {
  return process.env.ABUNELIK_OTP_DEV_ECHO === "1" && process.env.NODE_ENV !== "production";
}

export function canDeliverOtp(): boolean {
  if (devEcho()) return true;
  return process.env.WHATSAPP_PROVIDER?.trim().toLowerCase() === "wasender" && isWasenderConfigured();
}

export async function issueOtp(phoneE164: string, ip: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const code = generateCode();
  await prisma.phoneOtp.create({
    data: {
      phoneE164,
      purpose: OTP_PURPOSE,
      codeHash: hashOtp(phoneE164, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      ip,
    },
  });
  const text = [
    `Honsell abunəliklər giriş kodunuz: *${code}*`,
    ``,
    `Kod ${OTP_TTL_MINUTES} dəqiqə etibarlıdır. Bu kodu heç kimlə paylaşmayın.`,
  ].join("\n");
  if (devEcho()) {
    console.log(`[abunelik:otp] ${phoneE164} → ${code}`);
    return { ok: true };
  }
  const res = await sendWasenderText({ to: phoneE164, text });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
