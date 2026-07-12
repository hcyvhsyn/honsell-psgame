import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkGiveawayEligibility,
  displayParticipantCount,
  maskWinnerName,
} from "@/lib/giveaways";

/**
 * Tək çəkilişin ictimai məlumatı — `/cekilis/[id]` landing səhifəsi üçün.
 *
 * `HomeGiveaways`-dəki elementlə eyni formanı qaytarır (joined/eligible/winners),
 * beləcə paylaşılan link birbaşa qoşulma vəziyyətini göstərə bilir.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  const g = await prisma.giveaway.findFirst({
    where: { id: params.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: {
      id: true,
      title: true,
      description: true,
      prizeLabel: true,
      prizeImageUrl: true,
      status: true,
      winnersCount: true,
      entryCondition: true,
      conditionType: true,
      isVip: true,
      participantBoost: true,
      endAt: true,
      drawnAt: true,
      _count: { select: { entries: true } },
      entries: {
        where: { isWinner: true },
        select: { user: { select: { name: true } } },
      },
    },
  });

  if (!g) return NextResponse.json({ error: "Çəkiliş tapılmadı." }, { status: 404 });

  let joined = false;
  let eligible = true;
  if (user) {
    const mine = await prisma.giveawayEntry.findUnique({
      where: { giveawayId_userId: { giveawayId: g.id, userId: user.id } },
      select: { id: true },
    });
    joined = Boolean(mine);
    if (!joined && g.status === "ACTIVE") {
      const check = await checkGiveawayEligibility(user.id, g);
      eligible = check.eligible;
    }
  }

  return NextResponse.json({
    giveaway: {
      id: g.id,
      title: g.title,
      description: g.description,
      prizeLabel: g.prizeLabel,
      prizeImageUrl: g.prizeImageUrl,
      status: g.status,
      winnersCount: g.winnersCount,
      entryCondition: g.entryCondition,
      conditionType: g.conditionType,
      isVip: g.isVip,
      participantCount: displayParticipantCount(g._count.entries, g.participantBoost),
      endAt: g.endAt.toISOString(),
      drawnAt: g.drawnAt ? g.drawnAt.toISOString() : null,
      joined,
      eligible,
      winners:
        g.status === "COMPLETED" ? g.entries.map((e) => maskWinnerName(e.user.name)) : [],
    },
    authed: Boolean(user),
  });
}
