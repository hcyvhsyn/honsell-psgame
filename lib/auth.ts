import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_MAX_AGE_SECONDS, readSessionUserId, signSessionValue } from "@/lib/sessionToken";

const SESSION_COOKIE = "honsell_session";

// Sayt sessiyası İMZALIDIR — bax lib/sessionToken.ts. Cookie-ni YALNIZ `setSessionCookie` ilə yaz.
export { signSessionValue, readSessionUserId } from "@/lib/sessionToken";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/** Sayt sessiyasını cavaba yazır (login, qeydiyyat təsdiqi, telefonla giriş, /rey). */
export function setSessionCookie(res: { cookies: { set: (name: string, value: string, opts: typeof sessionCookieOptions) => unknown } }, userId: string) {
  res.cookies.set(SESSION_COOKIE, signSessionValue(userId), sessionCookieOptions);
}

/** Cari sorğunun imzalı sessiyasındakı User.id (DB-yə getmir). */
export function readSessionUserIdFromCookies(): string | null {
  return readSessionUserId(cookies().get(SESSION_COOKIE)?.value);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  return (
    candidate.length === original.length &&
    timingSafeEqual(candidate, original)
  );
}

export function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

/**
 * Minimal session helper. Replace with NextAuth.js session retrieval once
 * NextAuth is wired up — the API surface (`getCurrentUser`) stays the same.
 */
/**
 * `cache()` ilə bürünüb: eyni request ərzində neçə komponent çağırsa da
 * cookie + DB lookup yalnız bir dəfə icra olunur (header + səhifə daxilində
 * təkrar çağırışlar üçün Mumbai-yə təkrar gediş olmur).
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const userId = readSessionUserIdFromCookies();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
});

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return user;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
