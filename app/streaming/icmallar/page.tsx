import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { getCurrentUser } from "@/lib/auth";
import StreamingReviewsClient, { type ReviewItem } from "./StreamingReviewsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Streaming İcmalları — Müştəri rəyləri",
  description:
    "Netflix, HBO Max, Gain və YouTube Premium kataloqundakı film və serialları müştəri rəyləri ilə kəşf et.",
  alternates: { canonical: "/streaming/icmallar" },
};

export default async function StreamingReviewsPage() {
  const user = await getCurrentUser();

  const [approved, mine, favIds] = await Promise.all([
    prisma.streamingReview.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, streamingReviewTrusted: true } },
        reactions: { select: { kind: true, userId: true } },
      },
    }),
    user
      ? prisma.streamingReview.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, streamingReviewTrusted: true } },
            reactions: { select: { kind: true, userId: true } },
          },
        })
      : Promise.resolve([]),
    user
      ? prisma.streamingTitleFavorite
          .findMany({ where: { userId: user.id }, select: { tmdbId: true, kind: true } })
          .then((rows) => new Set(rows.map((r) => `${r.tmdbId}:${r.kind}`)))
      : Promise.resolve(new Set<string>()),
  ]);

  const myIds = new Set(mine.map((m) => m.id));
  const meId = user?.id ?? null;

  function toItem(r: typeof approved[number]): ReviewItem {
    const likes = r.reactions.filter((x) => x.kind === "LIKE").length;
    const dislikes = r.reactions.filter((x) => x.kind === "DISLIKE").length;
    const myReaction = meId ? r.reactions.find((x) => x.userId === meId)?.kind ?? null : null;
    return {
      id: r.id,
      tmdbId: r.tmdbId,
      kind: r.kind === "SERIES" ? "SERIES" : "MOVIE",
      service: r.service,
      rating: r.rating,
      body: r.body,
      status: r.status,
      watchLanguage: r.watchLanguage,
      spoiler: r.spoiler,
      titleSnap: r.titleSnap,
      posterUrlSnap: r.posterUrlSnap,
      backdropUrlSnap: r.backdropUrlSnap,
      yearSnap: r.yearSnap,
      genresSnap: Array.isArray(r.genresSnap) ? (r.genresSnap as string[]) : [],
      createdAt: r.createdAt.toISOString(),
      author: {
        id: r.user.id,
        name: r.user.name ?? r.user.email,
        avatarUrl: r.user.avatarUrl,
        trusted: r.user.streamingReviewTrusted,
      },
      likes,
      dislikes,
      myReaction: myReaction === "LIKE" || myReaction === "DISLIKE" ? myReaction : null,
      isMine: meId === r.userId,
      favorited: favIds.has(`${r.tmdbId}:${r.kind}`),
    };
  }

  // Sıralama: əvvəl öz icmalları (PENDING-lər də daxil olmaqla) — istifadəçi öz
  // post-larının statusunu aydın görsün — sonra approved feed.
  const myItems = mine.map(toItem);
  const approvedItems = approved.filter((r) => !myIds.has(r.id)).map(toItem);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Streaming İcmalları
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Müştərilərimizin Netflix, HBO Max, Gain və YouTube Premium-da izlədikləri film və serial rəyləri.
            Sən də fikrini paylaş — başqaları like, dislike edə və ya favoritlərinə əlavə edə bilər.
          </p>
        </header>

        <StreamingReviewsClient
          isLoggedIn={Boolean(user)}
          isTrusted={user?.streamingReviewTrusted ?? false}
          myUser={user ? { id: user.id, name: user.name ?? user.email, avatarUrl: user.avatarUrl } : null}
          mine={myItems}
          feed={approvedItems}
        />
      </section>
    </main>
  );
}
