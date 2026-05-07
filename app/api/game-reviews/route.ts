import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
} from "@/lib/reviewAffiliate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST: yeni rəy yarat (status = PENDING). Hər istifadəçi bir oyun üçün bir rəy.
 * Body: { gameId: string, rating: 1..5, body: 200..5000 simvol }
 *
 * GET ?gameId=X[&limit=20&offset=0]: yalnız APPROVED rəyləri qaytarır.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "";
  const rating = Math.floor(Number(body.rating));
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!gameId) {
    return NextResponse.json({ error: "Oyun seçilməyib." }, { status: 400 });
  }
  if (
    !Number.isFinite(rating) ||
    rating < REVIEW_RATING_MIN ||
    rating > REVIEW_RATING_MAX
  ) {
    return NextResponse.json(
      { error: `Reytinq ${REVIEW_RATING_MIN}-${REVIEW_RATING_MAX} aralığında olmalıdır.` },
      { status: 400 }
    );
  }
  if (text.length < REVIEW_BODY_MIN) {
    return NextResponse.json(
      { error: `Rəy ən azı ${REVIEW_BODY_MIN} simvol olmalıdır.` },
      { status: 400 }
    );
  }
  if (text.length > REVIEW_BODY_MAX) {
    return NextResponse.json(
      { error: `Rəy maksimum ${REVIEW_BODY_MAX} simvol ola bilər.` },
      { status: 400 }
    );
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    return NextResponse.json({ error: "Oyun tapılmadı." }, { status: 404 });
  }

  const existing = await prisma.gameReview.findUnique({
    where: { userId_gameId: { userId: user.id, gameId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Siz bu oyun üçün artıq rəy yazmısınız." },
      { status: 409 }
    );
  }

  const review = await prisma.gameReview.create({
    data: {
      gameId,
      userId: user.id,
      rating,
      body: text,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ok: true,
    review: {
      id: review.id,
      status: review.status,
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId")?.trim();
  if (!gameId) {
    return NextResponse.json({ error: "gameId tələb olunur." }, { status: 400 });
  }
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const me = await getCurrentUser();

  const [reviews, total] = await Promise.all([
    prisma.gameReview.findMany({
      where: { gameId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: { where: { isHidden: false } } } },
      },
    }),
    prisma.gameReview.count({ where: { gameId, status: "APPROVED" } }),
  ]);

  // Reaction aggregation və mənim reaksiyam.
  const reviewIds = reviews.map((r) => r.id);
  const [reactions, myReactions] = await Promise.all([
    reviewIds.length === 0
      ? []
      : prisma.reviewReaction.groupBy({
          by: ["reviewId", "value"],
          where: { reviewId: { in: reviewIds } },
          _count: { _all: true },
        }),
    reviewIds.length === 0 || !me
      ? []
      : prisma.reviewReaction.findMany({
          where: { reviewId: { in: reviewIds }, userId: me.id },
          select: { reviewId: true, value: true },
        }),
  ]);

  const counts = new Map<string, { likes: number; dislikes: number }>();
  for (const id of reviewIds) counts.set(id, { likes: 0, dislikes: 0 });
  for (const r of reactions) {
    const slot = counts.get(r.reviewId)!;
    if (r.value > 0) slot.likes = r._count._all;
    else slot.dislikes = r._count._all;
  }
  const myMap = new Map(myReactions.map((r) => [r.reviewId, r.value]));

  // Cari istifadəçinin bu oyun üçün öz rəyi var mı (status fərqi olsa belə) —
  // composer-i göstərib-göstərməmək üçün UI tərəfdə istifadə olunur.
  const myReview =
    !me
      ? null
      : await prisma.gameReview.findUnique({
          where: { userId_gameId: { userId: me.id, gameId } },
          select: { id: true, status: true, rating: true },
        });

  return NextResponse.json({
    total,
    viewer: {
      isAuthenticated: !!me,
      userId: me?.id ?? null,
      myReview: myReview
        ? { id: myReview.id, status: myReview.status, rating: myReview.rating }
        : null,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      author: {
        id: r.user.id,
        name: r.user.name ?? r.user.email.split("@")[0],
        avatarUrl: null,
      },
      likes: counts.get(r.id)?.likes ?? 0,
      dislikes: counts.get(r.id)?.dislikes ?? 0,
      myReaction: myMap.get(r.id) ?? 0,
      commentCount: r._count.comments,
    })),
  });
}
