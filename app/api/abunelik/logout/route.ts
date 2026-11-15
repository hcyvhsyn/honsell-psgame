import { NextResponse } from "next/server";
import { ABUNELIK_COOKIE } from "@/lib/abunelik/session";

export const runtime = "nodejs";

/** /abunelik-dən çıxış: yalnız təsdiqlənmiş telefon cookie-si silinir (sayt hesabına toxunulmur). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ABUNELIK_COOKIE);
  return res;
}
