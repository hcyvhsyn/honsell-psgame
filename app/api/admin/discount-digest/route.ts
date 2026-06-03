import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  currentWeekStart,
  getActiveMarketingRecipients,
  getNewDiscountedGames,
  runWeeklyDiscountDigest,
} from "@/lib/marketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Admin: endirim bülleteni paneli.
 *  • GET  → önizləmə: bu həftənin yeni endirimləri, aktiv alıcı sayı, artıq
 *           bu həftə neçə nəfərə göndərilib (dedup), opt-out sayı.
 *  • POST → bülleteni indi göndərir (cron-la eyni məntiq, dedup qorunur).
 */
export async function GET() {
  await requireAdmin();
  const now = new Date();
  const weekStart = currentWeekStart(now);

  const [games, recipients, alreadySent, unsubscribed] = await Promise.all([
    getNewDiscountedGames(now),
    getActiveMarketingRecipients(now),
    prisma.discountDigestNotification.count({ where: { weekStart } }),
    prisma.user.count({ where: { marketingUnsubscribedAt: { not: null } } }),
  ]);

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    newGames: games.length,
    games: games.slice(0, 12),
    activeRecipients: recipients.length,
    alreadySentThisWeek: alreadySent,
    pendingThisWeek: Math.max(0, recipients.length - alreadySent),
    unsubscribed,
  });
}

export async function POST() {
  await requireAdmin();
  const now = new Date();
  try {
    const stats = await runWeeklyDiscountDigest({ now, dryRun: false });
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "digest failed" },
      { status: 500 }
    );
  }
}
