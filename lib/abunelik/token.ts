import crypto from "node:crypto";

/**
 * /abunelik təsdiqlənmiş telefon tokeni (HMAC-SHA256, base64url) — saf, DB/Next-siz (test: npm run test:crmrenewal).
 * Prod-da ABUNELIK_COOKIE_SECRET məcburidir; lokal dev-də DATABASE_URL-dən törədilir.
 */
export const ABUNELIK_TTL_SECONDS = 2 * 60 * 60;

type Payload = { p9: string; e164: string; uid: string | null; exp: number; v: 1 };

function secret(): string | null {
  const s = process.env.ABUNELIK_COOKIE_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") return null;
  // Lokal dev: env-siz işləsin (prod-da açar MƏCBURİDİR)
  return crypto.createHash("sha256").update(`abunelik-dev|${process.env.DATABASE_URL ?? ""}`).digest("hex");
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

export function verifyPhoneToken(token: string | null | undefined): Payload | null {
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

