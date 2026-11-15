import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { ABUNELIK_COOKIE } from "@/lib/abunelik/session";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  // /abunelik telefon təsdiqi də bitsin (paylaşılan cihaz)
  res.cookies.delete(ABUNELIK_COOKIE);
  return res;
}
