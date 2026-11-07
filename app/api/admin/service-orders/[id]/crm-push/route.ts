import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushSpotifyOrderToCrm } from "@/lib/crmSpotify";
import { isNetflixOrderRow, pushNetflixOrderToCrm } from "@/lib/crmNetflix";

export const runtime = "nodejs";

/**
 * Admin: Spotify və ya Netflix sifarişini CRM-ə (yenidən) göndər — avtomatik göndəriş uğursuz olubsa.
 * İdempotentdir: CRM eyni sifarişi ikinci dəfə yaratmır.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.transaction.findUnique({
    where: { id: params.id },
    select: { serviceProduct: { select: { type: true, metadata: true } } },
  });
  const r = row && isNetflixOrderRow(row)
    ? await pushNetflixOrderToCrm(params.id)
    : await pushSpotifyOrderToCrm(params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, crmSubscriptionId: r.crmSubscriptionId, alreadyExists: r.alreadyExists });
}
