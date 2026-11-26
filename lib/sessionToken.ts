// Saf (react / next / DB-siz) — test: npm run test:crmrenewal
import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Sayt sessiyası (`honsell_session`): cookie dəyəri `<User.id>.<HMAC>` — İMZALIDIR.
 *
 * ⚠️ Əvvəllər cookie xam `User.id` idi; id-lər açıq API-lərdə görünür (məs. icma postlarının müəllifi),
 * yəni istənilən istifadəçinin (admin daxil) adından daxil olmaq mümkün idi. İmzasız köhnə cookie artıq
 * qəbul olunmur (hamı bir dəfə yenidən daxil olur).
 *
 * Açar: `SESSION_SECRET`, yoxdursa `DATABASE_URL`-dən törədilir (serverdə əlavə env tələb etməsin).
 * Açar (və ya DATABASE_URL) dəyişsə bütün sessiyalar bitir.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sessionSecret(): string {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const db = process.env.DATABASE_URL?.trim();
  return db ? createHash("sha256").update(`honsell:site-session:v1|${db}`).digest("hex") : "";
}

function sessionSignature(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`session:${userId}`).digest("base64url");
}

export function signSessionValue(userId: string): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET / DATABASE_URL yoxdur — sessiya imzalana bilmir");
  return `${userId}.${sessionSignature(userId, secret)}`;
}

/** İmza düzgündürsə User.id, əks halda null (imzasız köhnə cookie də null). */
export function readSessionUserId(value: string | null | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = value.slice(0, dot);
  const secret = sessionSecret();
  if (!secret) return null;
  const a = Buffer.from(value.slice(dot + 1));
  const b = Buffer.from(sessionSignature(userId, secret));
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}
