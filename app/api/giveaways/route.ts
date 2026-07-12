import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkGiveawayEligibility,
  displayParticipantCount,
  maskWinnerName,
} from "@/lib/giveaways";

/**
 * Ana səhifə çəkiliş bölməsi üçün ictimai siyahı.
 *
 * Client-də (`HomeGiveaways`) çağırılır — ana səhifə HTML-i statik/ISR qalsın,
 * user-vəziyyəti (qoşulub? eligible?) burada dinamik gəlsin.
 *
 * Qaytarır: ACTIVE (endAt keçməmiş) + son bitmiş (COMPLETED) çəkilişlər.
 * COMPLETED-lər üçün maskalanmış qalib adları (etibar / sosial sübut).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();

  // `?scope=all` → arxiv səhifəsi üçün bütün keçmiş çəkilişlər (limit yüksək).
  // Default (ana səhifə) → yalnız son 12.
  const scope = new URL(req.url).searchParams.get("scope");
  const take = scope === "all" ? 100 : 12;

  const giveaways = await prisma.giveaway.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: [{ status: "asc" }, { endAt: "desc" }],
    take,
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

  // Login olmuş istifadəçinin qoşulduğu çəkiliş id-ləri.
  const joinedIds = new Set<string>();
  if (user) {
    const myEntries = await prisma.giveawayEntry.findMany({
      where: { userId: user.id, giveawayId: { in: giveaways.map((g) => g.id) } },
      select: { giveawayId: true },
    });
    for (const e of myEntries) joinedIds.add(e.giveawayId);
  }

  const items = await Promise.all(
    giveaways.map(async (g) => {
      const joined = joinedIds.has(g.id);
      let eligible = true;
      if (user && !joined && g.status === "ACTIVE") {
        const check = await checkGiveawayEligibility(user.id, g);
        eligible = check.eligible;
      }
      return {
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
          g.status === "COMPLETED"
            ? g.entries.map((e) => maskWinnerName(e.user.name))
            : [],
      };
    })
  );

  return NextResponse.json({ giveaways: items, authed: Boolean(user) });
}
