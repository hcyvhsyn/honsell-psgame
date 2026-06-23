import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/** Dəvət bonusları siyahısı (admin review növbəsi). HELD əvvəl gəlir. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.referralInviteBonus.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      amountCents: true,
      status: true,
      suspicious: true,
      flagReasons: true,
      createdAt: true,
      reviewedAt: true,
      referrer: { select: { id: true, name: true, email: true } },
      referee: { select: { id: true, name: true, email: true } },
    },
  });

  const bonuses = rows.map((r) => ({
    id: r.id,
    amountAzn: r.amountCents / 100,
    status: r.status,
    suspicious: r.suspicious,
    reasons: parseReasons(r.flagReasons),
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    referrer: r.referrer,
    referee: r.referee,
  }));

  return NextResponse.json({ bonuses });
}

function parseReasons(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
