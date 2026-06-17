import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COMMUNITY_POST_BODY_MAX,
  COMMUNITY_POST_BODY_MIN,
  COMMUNITY_POST_COOLDOWN_MS,
  COMMUNITY_POST_TITLE_MAX,
  cooldownRemainingMs,
  formatWait,
  isValidCommunityCategory,
  normalizeCommunityCategory,
} from "@/lib/community";
import { cleanupCommunityText } from "@/lib/communityModeration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?category=SERIAL&limit=20&offset=0
 *   Yalnız APPROVED postları (kateqoriyaya görə süzülə bilər) reaction sayları
 *   və mənim reaksiyam ilə qaytarır.
 *
 * POST { category, title?, body }
 *   Yeni post yaradır (status = PENDING). Yalnız login olmuş üzv.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryParam = url.searchParams.get("category");
  const category =
    categoryParam && isValidCommunityCategory(categoryParam) ? categoryParam : null;
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const me = await getCurrentUser().catch(() => null);

  const where = {
    status: "APPROVED" as const,
    ...(category ? { category } : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.communityPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { comments: { where: { isHidden: false } } } },
      },
    }),
    prisma.communityPost.count({ where }),
  ]);

  const postIds = posts.map((p) => p.id);
  const [reactions, myReactions] = await Promise.all([
    postIds.length === 0
      ? []
      : prisma.communityPostReaction.groupBy({
          by: ["postId", "value"],
          where: { postId: { in: postIds } },
          _count: { _all: true },
        }),
    postIds.length === 0 || !me
      ? []
      : prisma.communityPostReaction.findMany({
          where: { postId: { in: postIds }, userId: me.id },
          select: { postId: true, value: true },
        }),
  ]);

  const counts = new Map<string, { likes: number; dislikes: number }>();
  for (const id of postIds) counts.set(id, { likes: 0, dislikes: 0 });
  for (const r of reactions) {
    const slot = counts.get(r.postId)!;
    if (r.value > 0) slot.likes = r._count._all;
    else slot.dislikes = r._count._all;
  }
  const myMap = new Map(myReactions.map((r) => [r.postId, r.value]));

  return NextResponse.json({
    total,
    viewer: { isAuthenticated: !!me, userId: me?.id ?? null },
    posts: posts.map((p) => ({
      id: p.id,
      category: p.category,
      title: p.title,
      body: p.body,
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
      isMine: me?.id === p.userId,
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const category = normalizeCommunityCategory(body.category);
  const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
  const rawTitleForCleanup = rawTitle ? rawTitle.slice(0, COMMUNITY_POST_TITLE_MAX) : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (text.length < COMMUNITY_POST_BODY_MIN) {
    return NextResponse.json(
      { error: `Fikir ən azı ${COMMUNITY_POST_BODY_MIN} simvol olmalıdır.` },
      { status: 400 },
    );
  }
  if (text.length > COMMUNITY_POST_BODY_MAX) {
    return NextResponse.json(
      { error: `Fikir maksimum ${COMMUNITY_POST_BODY_MAX} simvol ola bilər.` },
      { status: 400 },
    );
  }

  // Spam əleyhinə: 5 dəqiqədə bir paylaşım.
  const lastPost = await prisma.communityPost.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const postWait = cooldownRemainingMs(lastPost?.createdAt, COMMUNITY_POST_COOLDOWN_MS);
  if (postWait > 0) {
    return NextResponse.json(
      { error: `Çox tez-tez paylaşım edirsən. ${formatWait(postWait)} sonra yenidən cəhd et.` },
      { status: 429 },
    );
  }

  const [titleCleanup, bodyCleanup] = await Promise.all([
    rawTitleForCleanup
      ? cleanupCommunityText({
          text: rawTitleForCleanup,
          kind: "title",
          maxLength: COMMUNITY_POST_TITLE_MAX,
        })
      : Promise.resolve({
          text: "",
          changed: false,
          aiUsed: false,
          safeToPublish: true,
          reason: null,
        }),
    cleanupCommunityText({
      text,
      kind: "post",
      maxLength: COMMUNITY_POST_BODY_MAX,
    }),
  ]);

  if (bodyCleanup.text.length < COMMUNITY_POST_BODY_MIN) {
    return NextResponse.json(
      { error: `Fikir ən azı ${COMMUNITY_POST_BODY_MIN} simvol olmalıdır.` },
      { status: 400 },
    );
  }

  const safeToPublish = titleCleanup.safeToPublish && bodyCleanup.safeToPublish;
  const title = safeToPublish ? titleCleanup.text || null : rawTitleForCleanup || null;
  const finalBody = safeToPublish ? bodyCleanup.text : text;
  const status = safeToPublish ? "APPROVED" : "PENDING";
  const moderationNote = safeToPublish
    ? null
    : [
        "AI public paylaşımı dayandırdı.",
        `Səbəb: ${bodyCleanup.reason ?? titleCleanup.reason ?? "REVIEW"}.`,
        bodyCleanup.aiUsed || titleCleanup.aiUsed ? "Mənbə: AI moderation." : "Mənbə: local fallback.",
      ].join(" ");

  const post = await prisma.communityPost.create({
    data: {
      userId: user.id,
      category,
      title,
      body: finalBody,
      status,
      moderationNote,
    },
  });

  return NextResponse.json({
    ok: true,
    post: {
      id: post.id,
      title: post.title,
      body: post.body,
      status: post.status,
      blocked: !safeToPublish,
      reason: safeToPublish ? null : bodyCleanup.reason ?? titleCleanup.reason ?? "OTHER",
      changed: titleCleanup.changed || bodyCleanup.changed,
      aiUsed: titleCleanup.aiUsed || bodyCleanup.aiUsed,
    },
  });
}
