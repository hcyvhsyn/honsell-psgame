import { NextResponse } from "next/server";
import { runAnalyticsPrune } from "@/lib/analyticsPrune";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Həftəlik cron — analitika saxlama müddəti.
 *
 * `AnalyticsEvent` 180 gündən, `AnalyticsSession` 400 gündən köhnə sətirləri
 * silir. `OrderAttribution` toxunulmur — o, sifariş tarixçəsidir.
 *
 * Auth: digərləri ilə eyni — `Authorization: Bearer <CRON_SECRET>`.
 *
 * ⚠️ `vercel.json`-a sətir əlavə etmək BU MÜHİTDƏ KİFAYƏT DEYİL: layihə öz
 * serverində `next start` ilə işləyir, Vercel cron planlaşdırıcısı yoxdur.
 * Serverin öz crontab-ına yazılmalıdır:
 *
 *   0 4 * * 0 curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     https://honsell.store/api/cron/analytics-prune
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const stats = await runAnalyticsPrune(now);
    return NextResponse.json({ ok: true, runAt: now.toISOString(), stats });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "analytics-prune failed",
      },
      { status: 500 },
    );
  }
}
