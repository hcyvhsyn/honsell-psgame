import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maskWinnerName } from "@/lib/giveaways";
import { reviewProvenanceLabel } from "@/lib/giveawayWinnersShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Qazananlar zalı" (/qazananlar) — bütün tamamlanmış çəkilişlərin real ictimai
 * qalibləri + ictimai rəyləri (foto/video ilə). Etimad / sosial sübut üçün.
 * Həssas sahələr (telefon/email) HEÇ VAXT qaytarılmır; ad maskalanır.
 */
export async function GET() {
  const giveaways = await prisma.giveaway.findMany({
    where: { status: "COMPLETED", winners: { some: { isPublic: true } } },
    orderBy: { drawnAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      prizeLabel: true,
      prizeImageUrl: true,
      drawnAt: true,
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

  const items = giveaways.map((g) => ({
    id: g.id,
    title: g.title,
    prizeLabel: g.prizeLabel,
    prizeImageUrl: g.prizeImageUrl,
    drawnAt: g.drawnAt ? g.drawnAt.toISOString() : null,
    winners: g.winners.map((w) => ({
      name: maskWinnerName(w.name),
      avatarUrl: w.avatarUrl,
      instagramUsername: w.instagramUsername,
      delivered: w.deliveredAt != null,
      reviews: w.reviews
        .filter((r) => r.entryMethod !== "ADMIN_STORE_NOTE")
        .map((r) => ({
          text: r.text,
          rating: r.rating ?? null,
          imageUrl: r.imageUrl,
          videoUrl: r.videoUrl,
          provenanceLabel: reviewProvenanceLabel(r.entryMethod, r.source),
          createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        })),
    })),
  }));

  // Ən azı bir sübutu (rəy/foto) olan qalibi olanları önə çıxar.
  return NextResponse.json({ giveaways: items });
}
