import { NextResponse } from "next/server";
import { runAbandonedCartReminder } from "@/lib/abandoned-cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Toplu e-poçt göndərişi vaxt apara bilər.
export const maxDuration = 300;

/**
 * Günlük cron — tərk edilmiş səbət (abandoned cart) xatırlatması.
 *
 * Strategiya:
 *  • Login olmuş istifadəçinin səbəti /api/cart/sync ilə serverə (CartSnapshot)
 *    sinxronlaşır. Dolu, ən az 3 saatdır toxunulmayan və hələ xatırladılmayan
 *    səbətlərə bir dəfə e-poçt gedir.
 *  • Alış / təmizləmə səbəti boşaldır → snapshot silinir → mail getmir.
 *
 * Auth: digest/subscriptions cron ilə eyni — Authorization: Bearer <CRON_SECRET>.
 * Vercel Cron header-i avtomatik əlavə edir.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const stats = await runAbandonedCartReminder({ now, dryRun: false });
    return NextResponse.json({ ok: true, runAt: now.toISOString(), stats });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "abandoned-cart failed" },
      { status: 500 },
    );
  }
}
