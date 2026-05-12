import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scrape/status — son streaming scrape run-ı və son 24 saatda
 * baş verən dəyişiklik sayını qaytarır.
 *
 * Auth: admin (cron-dan çağrılmır, dashboard üçündür).
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    // Cron secret-i də qəbul edirik ki, monitoring scriptləri istifadə edə bilsin.
    const cronSecret = process.env.CRON_SECRET;
    const header = req.headers.get("authorization") ?? "";
    if (!cronSecret || header !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [lastRun, lastSuccess, changes24h, changeBreakdown] = await Promise.all([
    prisma.scrapeRun.findFirst({
      where: { kind: "STREAMING" },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        status: true,
        scrapedCount: true,
        upsertedCount: true,
        summary: true,
        error: true,
      },
    }),
    prisma.scrapeRun.findFirst({
      where: { kind: "STREAMING", status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, finishedAt: true },
    }),
    prisma.scrapeChange.count({ where: { createdAt: { gte: since24h } } }),
    prisma.scrapeChange.groupBy({
      by: ["platform", "changeType"],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
  ]);

  const breakdown: Record<string, Record<string, number>> = {};
  for (const row of changeBreakdown) {
    breakdown[row.platform] ??= {};
    breakdown[row.platform][row.changeType] = row._count._all;
  }

  return NextResponse.json({
    lastRun,
    lastSuccess,
    changes24h: { total: changes24h, breakdown },
  });
}
