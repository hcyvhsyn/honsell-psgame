import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { SITE_NAME } from "@/lib/site";
import { getReferralLeaderboard } from "@/lib/referralLeaderboard";
import type { ReviewItem } from "./StreamingReviewsClient";
import IcmaClient, { type CommunityPostItem } from "./IcmaClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Honsell İcması — Fikirlər, icmallar və referal",
  description:
    "Honsell İcması: üzvlər fikirlərini paylaşır, film və seriallara icmal yazır, referal kodunu bir yerdən idarə edir. Söz sənindir.",
  alternates: { canonical: "/icma" },
  openGraph: {
    title: `Honsell İcması | ${SITE_NAME}`,
    description:
      "Fikirlərini paylaş, icmalları oxu və yaz, referal kodunu götür — hamısı bir yerdə.",
    url: "/icma",
  },
};

const POSTS_PAGE_SIZE = 20;

const reviewUserSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  streamingReviewTrusted: true,
} as const;

export default async function IcmaPage() {
  const user = await getCurrentUser().catch(() => null);
  const meId = user?.id ?? null;

  const [
    approvedPosts,
    myPosts,
    approvedReviews,
    myReviews,
    favIds,
    referralCount,
    commissionAgg,
    leaderboard,
  ] = await Promise.all([
    prisma.communityPost.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: POSTS_PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { comments: { where: { isHidden: false } } } },
      },
    }),
    // Öz postları (PENDING-lər daxil) — üzv statusunu görsün.
    meId
      ? prisma.communityPost.findMany({
          where: { userId: meId },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { comments: { where: { isHidden: false } } } },
          },
        })
      : Promise.resolve([]),
    // Streaming icmalları (film + serial) — köhnə /streaming/icmallar buradan idarə olunur.
    prisma.streamingReview.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: reviewUserSelect },
        reactions: { select: { kind: true, userId: true } },
      },
    }),
    meId
      ? prisma.streamingReview.findMany({
          where: { userId: meId },
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: reviewUserSelect },
            reactions: { select: { kind: true, userId: true } },
          },
        })
      : Promise.resolve([]),
    meId
      ? prisma.streamingTitleFavorite
          .findMany({ where: { userId: meId }, select: { tmdbId: true, kind: true } })
          .then((rows) => new Set(rows.map((r) => `${r.tmdbId}:${r.kind}`)))
      : Promise.resolve(new Set<string>()),
    meId ? prisma.user.count({ where: { referredById: meId } }) : Promise.resolve(0),
    meId
      ? prisma.transaction.aggregate({
          where: { beneficiaryId: meId, type: "COMMISSION" },
          _sum: { amountAznCents: true },
        })
      : Promise.resolve({ _sum: { amountAznCents: 0 } }),
    getReferralLeaderboard(8).catch(() => []),
  ]);

  // ─── Community reaction sayları ──────────────────────────────────────────────
  const allPostIds = Array.from(
    new Set([...approvedPosts, ...myPosts].map((p) => p.id)),
  );
  const [reactionGroups, myReactionRows] = await Promise.all([
    allPostIds.length === 0
      ? []
      : prisma.communityPostReaction.groupBy({
          by: ["postId", "value"],
          where: { postId: { in: allPostIds } },
          _count: { _all: true },
        }),
    allPostIds.length === 0 || !meId
      ? []
      : prisma.communityPostReaction.findMany({
          where: { postId: { in: allPostIds }, userId: meId },
          select: { postId: true, value: true },
        }),
  ]);

  const counts = new Map<string, { likes: number; dislikes: number }>();
  for (const id of allPostIds) counts.set(id, { likes: 0, dislikes: 0 });
  for (const g of reactionGroups) {
    const slot = counts.get(g.postId)!;
    if (g.value > 0) slot.likes = g._count._all;
    else slot.dislikes = g._count._all;
  }
  const myMap = new Map(myReactionRows.map((r) => [r.postId, r.value]));

  type RawPost = (typeof approvedPosts)[number];
  function toPost(p: RawPost): CommunityPostItem {
    return {
      id: p.id,
      category: p.category,
      title: p.title,
      body: p.body,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      author: {
        id: p.user.id,
        name: p.user.name ?? p.user.email.split("@")[0],
        avatarUrl: p.user.avatarUrl,
      },
      likes: counts.get(p.id)?.likes ?? 0,
      dislikes: counts.get(p.id)?.dislikes ?? 0,
      myReaction: myMap.get(p.id) ?? 0,
      commentCount: p._count.comments,
      isMine: meId === p.userId,
    };
  }

  const myPostItems = myPosts.map(toPost);
  const feedPostItems = approvedPosts.map(toPost);

  // ─── Streaming icmalları → ReviewItem ────────────────────────────────────────
  type RawReview = (typeof approvedReviews)[number];
  function toReview(r: RawReview): ReviewItem {
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

  const myReviewIds = new Set(myReviews.map((r) => r.id));
  const myReviewItems = myReviews.map(toReview);
  const feedReviewItems = approvedReviews.filter((r) => !myReviewIds.has(r.id)).map(toReview);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7f8fc_0%,#eef8fb_32%,#f7f2fb_68%,#f7f8fc_100%)] text-zinc-900 dark:bg-[linear-gradient(180deg,#05070c_0%,#071019_35%,#0e0a14_68%,#05070c_100%)] dark:text-zinc-100">
      <SiteHeaderServer />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-44 h-[720px] overflow-hidden">
        <div className="absolute -left-48 top-16 h-96 w-96 rounded-full bg-cyan-300/10 blur-[110px] dark:bg-cyan-400/10" />
        <div className="absolute -right-48 top-72 h-96 w-96 rounded-full bg-violet-400/10 blur-[110px] dark:bg-violet-500/10" />
      </div>
      <IcmaClient
        viewer={
          user
            ? {
                id: user.id,
                name: user.name ?? user.email.split("@")[0],
                avatarUrl: user.avatarUrl,
                referralCode: user.referralCode,
                referralBalanceCents: user.referralBalanceCents ?? 0,
                referralCount,
                commissionEarnedCents: commissionAgg._sum.amountAznCents ?? 0,
              }
            : null
        }
        initialFeed={feedPostItems}
        myPosts={myPostItems}
        streaming={{
          isLoggedIn: Boolean(user),
          isTrusted: user?.streamingReviewTrusted ?? false,
          myUser: user
            ? { id: user.id, name: user.name ?? user.email, avatarUrl: user.avatarUrl }
            : null,
          mine: myReviewItems,
          feed: feedReviewItems,
        }}
        leaderboard={leaderboard}
        pageSize={POSTS_PAGE_SIZE}
      />
    </main>
  );
}
