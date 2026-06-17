import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { findProfanity } from "@/lib/profanityFilter";
import { STREAMING_SERVICES } from "@/lib/streamingCart";
import {
  COMMUNITY_REVIEW_COOLDOWN_MS,
  cooldownRemainingMs,
  formatWait,
} from "@/lib/community";

export const runtime = "nodejs";

const VALID_SERVICES = new Set<string>(STREAMING_SERVICES);
const VALID_KIND = new Set(["MOVIE", "SERIES"]);
const VALID_WATCH_LANG = new Set(["tr", "ru", "en", "original"]);

/**
 * GET /api/streaming/reviews
 *   ?tmdbId=123&kind=MOVIE  — bir film/serialın bütün APPROVED icmalları
 *   ?service=NETFLIX        — platforma üzrə filter
 *   ?mine=1                 — yalnız öz icmalları (PENDING + APPROVED + REJECTED)
 *   default: bütün APPROVED icmallar (yenidən köhnəyə)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tmdbIdRaw = url.searchParams.get("tmdbId");
  const kindRaw = url.searchParams.get("kind");
  const service = url.searchParams.get("service");
  const mine = url.searchParams.get("mine") === "1";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 30));

  const where: Prisma.StreamingReviewWhereInput = {};

  if (mine) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Login tələb olunur" }, { status: 401 });
    where.userId = user.id;
  } else {
    where.status = "APPROVED";
  }

  if (tmdbIdRaw && VALID_KIND.has(String(kindRaw))) {
    const tmdbId = Number(tmdbIdRaw);
    if (Number.isFinite(tmdbId)) {
      where.tmdbId = tmdbId;
      where.kind = String(kindRaw);
    }
  }
  if (service && VALID_SERVICES.has(service)) where.service = service;

  const reviews = await prisma.streamingReview.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reactions: { select: { kind: true, userId: true } },
    },
  });

  // Auth check — yalnız logged-in istifadəçilər üçün öz reaksiyasını qaytarırıq.
  const me = await getCurrentUser();
  const data = reviews.map((r) => {
    const likes = r.reactions.filter((x) => x.kind === "LIKE").length;
    const dislikes = r.reactions.filter((x) => x.kind === "DISLIKE").length;
    const myReaction = me ? r.reactions.find((x) => x.userId === me.id)?.kind ?? null : null;
    return {
      id: r.id,
      tmdbId: r.tmdbId,
      kind: r.kind,
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
      genresSnap: r.genresSnap,
      createdAt: r.createdAt.toISOString(),
      author: { id: r.user.id, name: r.user.name ?? r.user.email, avatarUrl: r.user.avatarUrl },
      likes,
      dislikes,
      myReaction,
      isMine: me?.id === r.userId,
    };
  });

  return NextResponse.json({ reviews: data });
}

/**
 * POST /api/streaming/reviews — yeni icmal yaratmaq.
 * Body: { tmdbId, kind, service, rating, body, titleSnap, posterUrlSnap, backdropUrlSnap, yearSnap, genresSnap }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login tələb olunur" }, { status: 401 });

  // Spam əleyhinə: 30 saniyədə bir icmal (rəy).
  const lastReview = await prisma.streamingReview.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const reviewWait = cooldownRemainingMs(lastReview?.createdAt, COMMUNITY_REVIEW_COOLDOWN_MS);
  if (reviewWait > 0) {
    return NextResponse.json(
      { error: `Çox tez-tez icmal yazırsan. ${formatWait(reviewWait)} sonra yenidən cəhd et.` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const {
    tmdbId,
    kind,
    service,
    rating,
    body: text,
    watchLanguage,
    spoiler,
    titleSnap,
    posterUrlSnap,
    backdropUrlSnap,
    yearSnap,
    genresSnap,
  } = body;

  // Validation
  const tmdbIdNum = Number(tmdbId);
  if (!Number.isFinite(tmdbIdNum) || tmdbIdNum <= 0) {
    return NextResponse.json({ error: "Düzgün TMDB id tələb olunur" }, { status: 400 });
  }
  if (!VALID_KIND.has(String(kind))) {
    return NextResponse.json({ error: "Növ MOVIE və ya SERIES olmalıdır" }, { status: 400 });
  }
  if (!VALID_SERVICES.has(String(service))) {
    return NextResponse.json({ error: "Platforma seçin" }, { status: 400 });
  }
  const wl = typeof watchLanguage === "string" ? watchLanguage.toLowerCase() : "";
  if (wl && !VALID_WATCH_LANG.has(wl)) {
    return NextResponse.json({ error: "İzləmə dili tr, ru, en və ya original olmalıdır" }, { status: 400 });
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 10) {
    return NextResponse.json({ error: "Reytinq 1-10 arasında tam ədəd olmalıdır" }, { status: 400 });
  }
  const txt = typeof text === "string" ? text.trim() : "";
  if (txt.length < 10) {
    return NextResponse.json({ error: "İcmal mətni ən az 10 simvol olmalıdır" }, { status: 400 });
  }
  if (txt.length > 2000) {
    return NextResponse.json({ error: "İcmal mətni 2000 simvolu keçməməlidir" }, { status: 400 });
  }
  const titleStr = typeof titleSnap === "string" ? titleSnap.trim() : "";
  if (!titleStr) {
    return NextResponse.json({ error: "Başlıq snapshot-u boş ola bilməz" }, { status: 400 });
  }

  // Profanity check — ad və body daxil
  const bad = findProfanity(`${titleStr} ${txt}`);
  if (bad) {
    return NextResponse.json(
      { error: "İcmalda qadağan olunmuş söz var. Mətni yenidən yoxlayın." },
      { status: 400 },
    );
  }

  // Duplicate check — eyni istifadəçi-tmdbId-kind unique
  const existing = await prisma.streamingReview.findUnique({
    where: { userId_tmdbId_kind: { userId: user.id, tmdbId: tmdbIdNum, kind: String(kind) } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Sən artıq bu film/serial üçün icmal yazmısan." },
      { status: 409 },
    );
  }

  const yearNum = yearSnap != null && yearSnap !== "" ? Number(yearSnap) : null;
  const genresArr = Array.isArray(genresSnap)
    ? genresSnap.map((g) => String(g)).filter(Boolean)
    : [];

  // Etibarlı istifadəçi APPROVED, qalan istifadəçilər PENDING.
  const status = user.streamingReviewTrusted ? "APPROVED" : "PENDING";

  const review = await prisma.streamingReview.create({
    data: {
      userId: user.id,
      tmdbId: tmdbIdNum,
      kind: String(kind),
      service: String(service),
      rating: ratingNum,
      body: txt,
      watchLanguage: wl || null,
      spoiler: Boolean(spoiler),
      status,
      titleSnap: titleStr,
      posterUrlSnap: posterUrlSnap ? String(posterUrlSnap) : null,
      backdropUrlSnap: backdropUrlSnap ? String(backdropUrlSnap) : null,
      yearSnap: Number.isFinite(yearNum) ? Number(yearNum) : null,
      genresSnap: genresArr.length > 0 ? (genresArr as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  return NextResponse.json({ id: review.id, status: review.status });
}
