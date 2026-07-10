import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkGiveawayEligibility, displayParticipantCount } from "@/lib/giveaways";

/**
 * Çəkilişə qoşulma. Auth tələb olunur. Yoxlanışlar:
 *  - çəkiliş ACTIVE olmalı və bitiş tarixi keçməməli;
 *  - istifadəçi qoşulma şərtini ödəməli (eligibility);
 *  - unique(giveawayId, userId) → təkrar qoşulma bloklanır.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Qoşulmaq üçün daxil ol." }, { status: 401 });
  }

  const giveaway = await prisma.giveaway.findUnique({ where: { id: params.id } });
  if (!giveaway) {
    return NextResponse.json({ error: "Çəkiliş tapılmadı." }, { status: 404 });
  }
  if (giveaway.status !== "ACTIVE") {
    return NextResponse.json({ error: "Bu çəkiliş aktiv deyil." }, { status: 400 });
  }
  if (giveaway.endAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Çəkilişin qoşulma vaxtı bitib." }, { status: 400 });
  }

  const existing = await prisma.giveawayEntry.findUnique({
    where: { giveawayId_userId: { giveawayId: giveaway.id, userId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Artıq bu çəkilişə qoşulmusan.", joined: true }, { status: 409 });
  }

  const check = await checkGiveawayEligibility(user.id, giveaway);
  if (!check.eligible) {
    return NextResponse.json({ error: check.reason || "Qoşulma şərti ödənmir." }, { status: 403 });
  }

  await prisma.giveawayEntry.create({
    data: { giveawayId: giveaway.id, userId: user.id },
  });

  const realCount = await prisma.giveawayEntry.count({ where: { giveawayId: giveaway.id } });

  return NextResponse.json({
    joined: true,
    participantCount: displayParticipantCount(realCount, giveaway.participantBoost),
  });
}
