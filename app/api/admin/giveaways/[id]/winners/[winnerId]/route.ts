import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logGiveawayAudit, isWinnerSource } from "@/lib/giveawayWinners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Winner-in bu çəkilişə aid olduğunu təsdiqlə (cross-giveaway qorunma). */
async function loadOwnedWinner(giveawayId: string, winnerId: string) {
  const winner = await prisma.giveawayWinner.findUnique({ where: { id: winnerId } });
  if (!winner || winner.giveawayId !== giveawayId) return null;
  return winner;
}

/** PATCH → qalib məlumatını redaktə et (ad, əlaqə, mənbə, public, note, proof). */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; winnerId: string } }
) {
  const admin = await requireAdmin();
  const prev = await loadOwnedWinner(params.id, params.winnerId);
  if (!prev) return NextResponse.json({ error: "Qalib tapılmadı." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  const str = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);

  if (typeof body.name === "string") {
    if (!body.name.trim())
      return NextResponse.json({ error: "Ad boş ola bilməz." }, { status: 400 });
    data.name = body.name.trim();
  }
  if ("phone" in body) data.phone = str(body.phone);
  if ("email" in body) data.email = str(body.email);
  if ("instagramUsername" in body) data.instagramUsername = str(body.instagramUsername);
  if ("avatarUrl" in body) data.avatarUrl = str(body.avatarUrl);
  if ("prizeTitle" in body) data.prizeTitle = str(body.prizeTitle);
  if ("internalNote" in body) data.internalNote = str(body.internalNote);
  if ("proofUrl" in body) data.proofUrl = str(body.proofUrl);
  if (typeof body.proofIsPublic === "boolean") data.proofIsPublic = body.proofIsPublic;
  if (typeof body.isPublic === "boolean") data.isPublic = body.isPublic;
  if (body.source != null) {
    if (!isWinnerSource(body.source))
      return NextResponse.json({ error: "Keçərsiz mənbə." }, { status: 400 });
    data.source = body.source;
  }
  if (typeof body.selectedAt === "string" && body.selectedAt) {
    const d = new Date(body.selectedAt);
    if (Number.isNaN(d.getTime()))
      return NextResponse.json({ error: "Keçərsiz tarix." }, { status: 400 });
    data.selectedAt = d;
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Dəyişiklik yoxdur." }, { status: 400 });

  const winner = await prisma.giveawayWinner.update({ where: { id: params.winnerId }, data });

  await logGiveawayAudit({
    actorId: admin.id,
    giveawayId: params.id,
    entityType: "winner",
    entityId: winner.id,
    action: "winner.update",
    prev,
    next: winner,
  });

  return NextResponse.json({ winner });
}

/**
 * DELETE → qalibi sil (rəyləri cascade). Sayt iştirakçısı idisə entry.isWinner
 * sıfırlanır və göndərilmiş rəy linki təmizlənir.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; winnerId: string } }
) {
  const admin = await requireAdmin();
  const winner = await loadOwnedWinner(params.id, params.winnerId);
  if (!winner) return NextResponse.json({ error: "Qalib tapılmadı." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (winner.entryId) {
      await tx.giveawayEntry.update({
        where: { id: winner.entryId },
        data: {
          isWinner: false,
          notifiedAt: null,
          waStatus: "N_A",
          reviewToken: null,
          reviewStatus: "NONE",
          reviewText: null,
          reviewRating: null,
          reviewImageUrl: null,
          reviewSentAt: null,
          reviewSubmittedAt: null,
        },
      });
    }
    await tx.giveawayWinner.delete({ where: { id: winner.id } });
  });

  await logGiveawayAudit({
    actorId: admin.id,
    giveawayId: params.id,
    entityType: "winner",
    entityId: winner.id,
    action: "winner.delete",
    prev: winner,
  });

  return NextResponse.json({ ok: true });
}
