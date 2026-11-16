import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { verifyLinkToken } from "@/lib/abunelik/token";
import { isAbunelikConfigured, isAbunelikEnabled } from "@/lib/abunelik/session";
import { applyPhoneLogin, resolvePhoneLogin } from "@/lib/abunelik/login";

export const runtime = "nodejs";
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
 * Token həmin nömrənin WhatsApp-ına getdiyi üçün OTP kodu qədər sübutdur: telefon cookie-si qoyulur,
 * sayt hesabı OTP girişi ilə EYNİ qaydada bağlanır, sonra token URL-də qalmasın deyə /abunelik-ə yönləndirilir.
 */
export async function GET(req: Request) {
  if (!isAbunelikEnabled() || !isAbunelikConfigured()) return redirect("/abunelik");
  if (PREVIEW_BOT_RE.test(req.headers.get("user-agent") || "")) return redirect("/abunelik");

  const token = new URL(req.url).searchParams.get("t");
  const payload = verifyLinkToken(token);
  if (!payload) return redirect("/abunelik?link=kohne");

  const phone = { e164: payload.e164, phone9: payload.p9 };
  const login = await resolvePhoneLogin(phone);
  const res = redirect(login.account === "ambiguous" ? "/abunelik?giris=coxlu" : "/abunelik");
  await applyPhoneLogin(res, req, phone, login);
  return res;
}
