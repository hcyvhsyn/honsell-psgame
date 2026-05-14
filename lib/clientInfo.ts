import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DEVICE_COOKIE_NAME = "honsell_did";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 il

/**
 * Vercel / standart reverse-proxy başlıqlarından client IP-ni çıxarır.
 * Birinci uyğun forwarded IP götürülür; tapılmasa "unknown" qaytarılır.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Mövcud cihaz ID cookie-sini qaytarır; yoxdursa yeni təsadüfi ID generasiya
 * edir. Yeni ID NextResponse-ə yazılır ki, brauzer onu növbəti istəklərdə
 * göndərsin (HttpOnly, SameSite=Lax).
 */
export async function ensureDeviceId(
  res: NextResponse
): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE_NAME)?.value;
  if (existing && /^[a-z0-9]{16,}$/i.test(existing)) return existing;

  const fresh = randomBytes(16).toString("hex");
  res.cookies.set(DEVICE_COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
  return fresh;
}

/**
 * Cookie-dən cihaz ID-ni oxuyur (yoxdursa "anon"). Yazma tələb olunmur —
 * sadəcə oxumaq üçün; əgər ID yoxdursa, istifadəçi yeni gələndir və IP-yə
 * əsaslanan limit bu cəhdi tutacaq.
 */
export async function readDeviceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE_NAME)?.value;
  return existing && /^[a-z0-9]{16,}$/i.test(existing) ? existing : "anon";
}
