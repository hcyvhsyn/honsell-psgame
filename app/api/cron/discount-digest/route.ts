import { NextResponse } from "next/server";
import { runWeeklyDiscountDigest } from "@/lib/marketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Toplu e-poçt göndərişi vaxt apara bilər.
export const maxDuration = 300;

/**
 * Həftəlik cron — "yeni endirimlər" bülletenini bütün aktiv müştərilərə yollayır.
 *
 * Strategiya:
 *  • Son 7 gündə endirimə düşən aktiv oyunları toplayır (Game.discountStartedAt).
 *  • Aktiv müştəriləri seçir (login/tranzaksiya pəncərəsi, opt-out istisna).
 *  • (userId, weekStart) dedup ilə həftədə bir dəfə göndərir.
 *
 * Anlıq favorit-endirim bildirişləri buradan AYRI — onlar scrape axınında
 * (app/api/scrape-ps-store) WhatsApp/e-poçt ilə dərhal göndərilir.
 *
 * Auth: subscriptions cron ilə eyni — Authorization: Bearer <CRON_SECRET>.
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
    const stats = await runWeeklyDiscountDigest({ now, dryRun: false });
    return NextResponse.json({ ok: true, runAt: now.toISOString(), stats });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "digest failed" },
      { status: 500 }
    );
  }
}
