import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  createWinner,
  logGiveawayAudit,
  WinnerLimitError,
  isWinnerSource,
} from "@/lib/giveawayWinners";
import { WINNER_LIMIT_MESSAGE } from "@/lib/giveawayWinnersShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → bu çəkilişin bütün qalibləri + rəyləri (admin Qaliblər/Rəylər tabları). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const winners = await prisma.giveawayWinner.findMany({
    where: { giveawayId: params.id },
    orderBy: { selectedAt: "asc" },
    include: {
      reviews: { orderBy: { createdAt: "desc" } },
    },
  });
  return NextResponse.json({ winners });
}

/**
 * POST → qalib əlavə et.
 *  • body.entryId varsa → sayt iştirakçısı MANUAL qalib edilir (snapshot entry-dən).
 *  • yoxdursa → XARİCİ qalib (name məcburi, digər əlaqə sahələri optional).
 * Limit yoxlaması `createWinner` daxilində transaction ilə.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const entryId = typeof body.entryId === "string" && body.entryId ? body.entryId : null;
  const external = !entryId;

  if (external && !(typeof body.name === "string" && body.name.trim())) {
    return NextResponse.json({ error: "Qalibin adı tələb olunur." }, { status: 400 });
  }
  if (external && body.source != null && !isWinnerSource(body.source)) {
    return NextResponse.json({ error: "Keçərsiz mənbə (source)." }, { status: 400 });
  }

  let selectedAt: Date | undefined;
  if (typeof body.selectedAt === "string" && body.selectedAt) {
    const d = new Date(body.selectedAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Keçərsiz seçilmə tarixi." }, { status: 400 });
    }
    selectedAt = d;
  }

  try {
    const winner = await createWinner({
      giveawayId: params.id,
      actorId: admin.id,
      entryId,
      name: typeof body.name === "string" ? body.name : undefined,
      phone: body.phone ?? null,
      email: body.email ?? null,
      instagramUsername: body.instagramUsername ?? null,
      avatarUrl: body.avatarUrl ?? null,
      prizeTitle: body.prizeTitle ?? null,
      source: external ? (typeof body.source === "string" ? body.source : "MANUAL_OTHER") : "WEBSITE_ENTRY",
      selectionMethod: external ? "EXTERNAL" : "MANUAL",
      selectedAt,
      proofUrl: body.proofUrl ?? null,
      proofIsPublic: Boolean(body.proofIsPublic),
      internalNote: body.internalNote ?? null,
      isPublic: body.isPublic === undefined ? true : Boolean(body.isPublic),
    });

    await logGiveawayAudit({
      actorId: admin.id,
      giveawayId: params.id,
      entityType: "winner",
      entityId: winner.id,
      action: external ? "winner.create.external" : "winner.create.manual",
      next: winner,
    });

    return NextResponse.json({ winner });
  } catch (err) {
    if (err instanceof WinnerLimitError) {
      return NextResponse.json({ error: WINNER_LIMIT_MESSAGE, code: "WINNER_LIMIT" }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : "Xəta";
    if (msg === "NAME_REQUIRED")
      return NextResponse.json({ error: "Qalibin adı tələb olunur." }, { status: 400 });
    if (msg === "ENTRY_MISMATCH")
      return NextResponse.json({ error: "İştirakçı bu çəkilişə aid deyil." }, { status: 404 });
    if (msg === "ENTRY_ALREADY_WINNER")
      return NextResponse.json({ error: "Bu iştirakçı artıq qalibdir." }, { status: 409 });
    if (msg === "GIVEAWAY_NOT_FOUND")
      return NextResponse.json({ error: "Çəkiliş tapılmadı." }, { status: 404 });
    console.error("winner create failed", err);
    return NextResponse.json({ error: "Qalib əlavə olunmadı." }, { status: 500 });
  }
}
