import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkGiveawayEligibility,
  displayParticipantCount,
  maskWinnerName,
  getUserSuccessfulSpendCents,
  computeTickets,
} from "@/lib/giveaways";
import { reviewProvenanceLabel } from "@/lib/giveawayWinnersShared";

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
      conditionUrl: true,
      isVip: true,
      participantBoost: true,
      minSpendAznCents: true,
      ticketUnitAznCents: true,
      endAt: true,
      drawnAt: true,
      _count: { select: { entries: true } },
      // Legacy fallback (miqrasiyadan əvvəlki tamamlanmış çəkilişlər üçün).
      entries: {
        where: { isWinner: true },
        orderBy: { createdAt: "asc" },
        select: { user: { select: { name: true } } },
      },
      // Vahid qalib sistemi — yalnız ictimai qaliblər + ictimai görünən rəylər.
      // Həssas sahələr (telefon/email) HEÇ VAXT seçilmir.
      winners: {
        where: { isPublic: true },
        orderBy: { selectedAt: "asc" },
        select: {
          name: true,
          avatarUrl: true,
          instagramUsername: true,
          deliveredAt: true,
          reviews: {
            where: { status: "APPROVED", isPublic: true, hasPublishingConsent: true },
            orderBy: { createdAt: "desc" },
            select: {
              text: true,
              rating: true,
              imageUrl: true,
              videoUrl: true,
              source: true,
              entryMethod: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!g) return NextResponse.json({ error: "Çəkiliş tapılmadı." }, { status: 404 });

  let joined = false;
  let eligible = true;
  // Xərc əsaslı şərt/bilet üçün istifadəçinin cari xərci (bir dəfə hesablanır).
  let spendProgress: { current: number; required: number } | null = null;
  let myTickets: number | null = null;
  if (user) {
    const mine = await prisma.giveawayEntry.findUnique({
      where: { giveawayId_userId: { giveawayId: g.id, userId: user.id } },
      select: { id: true },
    });
    joined = Boolean(mine);

    const needsSpend =
      g.status === "ACTIVE" &&
      (g.entryCondition === "PURCHASE_MIN_AMOUNT" || (g.ticketUnitAznCents ?? 0) > 0);
    const spendCents = needsSpend ? await getUserSuccessfulSpendCents(user.id) : 0;

    if (!joined && g.status === "ACTIVE") {
      const check = await checkGiveawayEligibility(user.id, g);
      eligible = check.eligible;
    }
    if (g.status === "ACTIVE" && g.entryCondition === "PURCHASE_MIN_AMOUNT" && g.minSpendAznCents) {
      spendProgress = { current: spendCents, required: g.minSpendAznCents };
    }
    if (g.status === "ACTIVE" && (g.ticketUnitAznCents ?? 0) > 0) {
      myTickets = computeTickets(spendCents, g.ticketUnitAznCents);
    }
  }

  const completed = g.status === "COMPLETED";

  // Qalib adları + çatdırılma statusu. Vahid sistem əsas mənbə; boşdursa köhnə
  // entry-əsaslı qaliblərə düş. Ad maskalanır.
  const winnerList = completed
    ? g.winners.length > 0
      ? g.winners.map((w) => ({ name: maskWinnerName(w.name), delivered: w.deliveredAt != null }))
      : g.entries.map((e) => ({ name: maskWinnerName(e.user.name), delivered: false }))
    : [];

  // Qalib rəyləri (mağaza açıqlaması XARİC) — mənbə şəffaf göstərilir.
  // Telefon/email heç vaxt daxil edilmir.
  const reviews = completed
    ? g.winners.flatMap((w) =>
        w.reviews
          .filter((r) => r.entryMethod !== "ADMIN_STORE_NOTE")
          .map((r) => ({
            name: maskWinnerName(w.name),
            avatarUrl: w.avatarUrl,
            instagramUsername: w.instagramUsername,
            text: r.text,
            rating: r.rating ?? null,
            imageUrl: r.imageUrl,
            videoUrl: r.videoUrl,
            entryMethod: r.entryMethod,
            source: r.source,
            provenanceLabel: reviewProvenanceLabel(r.entryMethod, r.source),
            createdAt: r.createdAt ? r.createdAt.toISOString() : null,
          }))
      )
    : [];

  // Mağaza açıqlamaları — ayrıca blok (qalib testimonialı kimi göstərilmir,
  // ad altında testimonial deyil).
  const storeNotes = completed
    ? g.winners.flatMap((w) =>
        w.reviews
          .filter((r) => r.entryMethod === "ADMIN_STORE_NOTE")
          .map((r) => ({
            text: r.text,
            imageUrl: r.imageUrl,
            createdAt: r.createdAt ? r.createdAt.toISOString() : null,
          }))
      )
    : [];

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
      conditionUrl: g.conditionUrl,
      isVip: g.isVip,
      participantCount: displayParticipantCount(g._count.entries, g.participantBoost),
      minSpendAznCents: g.minSpendAznCents,
      ticketUnitAznCents: g.ticketUnitAznCents,
      endAt: g.endAt.toISOString(),
      drawnAt: g.drawnAt ? g.drawnAt.toISOString() : null,
      joined,
      eligible,
      spendProgress,
      myTickets,
      winners: winnerList,
      reviews,
      storeNotes,
    },
    authed: Boolean(user),
  });
}
