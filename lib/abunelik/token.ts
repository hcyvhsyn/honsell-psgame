import crypto from "node:crypto";

/**
 * /abunelik telefon / birbaşa giriş linki tokeni (HMAC-SHA256, base64url) — saf, DB/Next-siz (test: npm run test:crmrenewal).
 * Açar `ABUNELIK_COOKIE_SECRET`, yoxdursa `DATABASE_URL`-dən törədilir (sessiya açarı kimi — serverdə əlavə env
 * tələb etməsin; prod-da env yox idi və link tokeni heç yaranmırdı). Açar dəyişsə köhnə linklər (24 saat) keçmir.
 */
export const ABUNELIK_TTL_SECONDS = 2 * 60 * 60;

/** `k: "link"` — WhatsApp-a göndərilən birbaşa giriş linki; cookie tokenində `k` yoxdur (bir-birinin yerinə keçmir). */
type Payload = { p9: string; e164: string; uid: string | null; exp: number; v: 1; k?: "link" };

/** WhatsApp birbaşa giriş linkinin ömrü */
export const ABUNELIK_LINK_TTL_SECONDS = 24 * 60 * 60;

function secret(): string | null {
  const s = process.env.ABUNELIK_COOKIE_SECRET?.trim();
  if (s) return s;
  const db = process.env.DATABASE_URL?.trim();
  if (!db) return null;
  return crypto.createHash("sha256").update(`abunelik-token:v1|${db}`).digest("hex");
}

export function isAbunelikConfigured(): boolean {
  return secret() != null;
}

function sign(value: string, key: string): string {
  return crypto.createHmac("sha256", key).update(value).digest("base64url");
}

export function createPhoneToken(p: { e164: string; phone9: string; uid: string | null }): string {
  const key = secret();
  if (!key) throw new Error("ABUNELIK_COOKIE_SECRET təyin olunmayıb");
  const payload: Payload = { p9: p.phone9, e164: p.e164, uid: p.uid, exp: Date.now() + ABUNELIK_TTL_SECONDS * 1000, v: 1 };
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${b64}.${sign(b64, key)}`;
}

function decode(token: string | null | undefined): Payload | null {
  const key = secret();
  if (!key || !token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = sign(b64, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as Payload;
    if (p.v !== 1 || typeof p.p9 !== "string" || p.p9.length !== 9 || typeof p.e164 !== "string") return null;
    if (!Number.isFinite(p.exp) || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

/** Cookie tokeni (link tokeni burada keçmir). */
export function verifyPhoneToken(token: string | null | undefined): Payload | null {
  const p = decode(token);
  return p && !p.k ? p : null;
}

/**
 * WhatsApp-a göndərilən birbaşa giriş linki (CRM mağazadan istəyir — /api/partner/abunelik-link).
 * Link həmin nömrənin WhatsApp-ına getdiyi üçün OTP kodu qədər sübutdur; 24 saat etibarlıdır.
 */
export function createLinkToken(p: { e164: string; phone9: string }): string {
  const key = secret();
  if (!key) throw new Error("ABUNELIK_COOKIE_SECRET təyin olunmayıb");
  const payload: Payload = { p9: p.phone9, e164: p.e164, uid: null, exp: Date.now() + ABUNELIK_LINK_TTL_SECONDS * 1000, v: 1, k: "link" };
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${b64}.${sign(b64, key)}`;
}

export function verifyLinkToken(token: string | null | undefined): Payload | null {
  const p = decode(token);
  return p && p.k === "link" ? p : null;
}
