import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { verifyLinkToken } from "@/lib/abunelik/token";
import { isAbunelikConfigured, isAbunelikEnabled } from "@/lib/abunelik/session";
import { loginByPhone } from "@/lib/abunelik/login";
import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

const PROFILE_PATH = "/profile/abunelikler";
/**
 * `?to=` — girişdən sonra hara (imzasız, ona görə yalnız bu siyahıdan; naməlum dəyər → profil).
 * `home`: abunəliyi olmayan müştəri (CRM `portal_link_general`) — ana səhifədə Netflix / Spotify / PS oyunları.
 */
const LANDING_PATHS: Record<string, string> = { home: "/" };
export const dynamic = "force-dynamic";

/** WhatsApp / Facebook link önizləmə botları — linki "açır", amma girişə sayılmamalıdır. */
const PREVIEW_BOT_RE = /whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|slackbot|discordbot|bot\b|crawler|preview/i;

function redirect(path: string) {
  const res = NextResponse.redirect(new URL(path, SITE_URL), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

/**
 * GET /abunelik/giris?t=<token> — CRM-in WhatsApp-a göndərdiyi birbaşa giriş linki (24 saat).
 * Token həmin nömrənin WhatsApp-ına getdiyi üçün WhatsApp kodu qədər sübutdur: müştəri nömrəyə bağlı sayt
 * hesabına daxil edilir (yoxdursa telefon hesabı açılır — lib/abunelik/login.ts) və tokensiz profilin
 * abunəliklər bölməsinə (`to=home` → ana səhifəyə) yönləndirilir. Bir neçə hesab → e-poçt + şifrə ilə giriş.
 */
export async function GET(req: Request) {
  if (!isAbunelikEnabled() || !isAbunelikConfigured()) return redirect("/abunelik");
  if (PREVIEW_BOT_RE.test(req.headers.get("user-agent") || "")) return redirect("/abunelik");

  const params = new URL(req.url).searchParams;
  const payload = verifyLinkToken(params.get("t"));
  if (!payload) return redirect("/abunelik?link=kohne");

  const phone = { e164: payload.e164, phone9: payload.p9 };
  const login = await loginByPhone(req, phone);
  if (login.account === "ambiguous") return redirect("/abunelik?giris=coxlu");
  const res = redirect(LANDING_PATHS[params.get("to") ?? ""] ?? PROFILE_PATH);
  if (login.newSession && login.userId) setSessionCookie(res, login.userId);
  return res;
}
