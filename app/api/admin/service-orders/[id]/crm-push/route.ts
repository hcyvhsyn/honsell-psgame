import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { pushSpotifyOrderToCrm } from "@/lib/crmSpotify";

export const runtime = "nodejs";

/**
 * Admin: Spotify sifarişini CRM-ə (yenidən) göndər — avtomatik göndəriş uğursuz olubsa.
 * İdempotentdir: CRM eyni sifarişi ikinci dəfə yaratmır.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r = await pushSpotifyOrderToCrm(params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, crmSubscriptionId: r.crmSubscriptionId, alreadyExists: r.alreadyExists });
}
