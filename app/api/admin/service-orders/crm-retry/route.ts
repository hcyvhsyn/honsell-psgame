import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSpotifyOrderRow, pushSpotifyOrderToCrm } from "@/lib/crmSpotify";
import { isNetflixOrderRow, pushNetflixOrderToCrm } from "@/lib/crmNetflix";
import { pushCrmRenewalToCrm } from "@/lib/crmRenewals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 30;
const MAX_ROWS = 100;

/**
 * Admin: CRM-ə göndərilə bilməmiş (crmSyncError) gözləyən Netflix / Spotify sifarişlərini toplu yenidən göndərir —
 * məs. CRM müvəqqəti əlçatmaz olubsa və ya endpoint hələ deploy olunmamışdısa. Hər göndəriş idempotentdir
 * (CRM eyni `externalRef`-i ikinci dəfə yaratmır), ona görə təkrar basmaq təhlükəsizdir.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.transaction.findMany({
    where: {
      type: "SERVICE_PURCHASE",
      status: "PENDING",
      createdAt: { gte: since },
      metadata: { contains: "crmSyncError" },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_ROWS,
    select: { id: true, metadata: true, serviceProduct: { select: { type: true, metadata: true } } },
  });

  const failed: { id: string; error: string }[] = [];
  let ok = 0;
  let total = 0;
  for (const row of rows) {
    const netflix = isNetflixOrderRow(row);
    if (!netflix && !isSpotifyOrderRow(row)) continue;
    total++;
    try {
      const r = netflix ? await pushNetflixOrderToCrm(row.id) : await pushSpotifyOrderToCrm(row.id);
      if (r.ok) ok++;
      else failed.push({ id: row.id, error: r.error });
    } catch (e) {
      failed.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // /abunelik CRM yeniləmələri (ayrıca cədvəl) — CRM-ə çatmayanlar da eyni düymə ilə
  const renewals = await prisma.crmRenewalOrder.findMany({
    where: { status: "PENDING", crmSyncedAt: null, crmSyncError: { not: null }, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: MAX_ROWS,
    select: { id: true },
  });
  for (const r of renewals) {
    total++;
    const res = await pushCrmRenewalToCrm(r.id);
    if (res.ok) ok++;
    else failed.push({ id: r.id, error: res.error });
  }

  return NextResponse.json({ total, ok, failed });
}
