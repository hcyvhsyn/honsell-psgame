import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COMMUNITY_COMMENT_BODY_MAX,
  COMMUNITY_COMMENT_BODY_MIN,
  COMMUNITY_COMMENT_COOLDOWN_MS,
  cooldownRemainingMs,
  formatWait,
} from "@/lib/community";
import { cleanupCommunityText } from "@/lib/communityModeration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: posta yazılmış (gizlənməmiş) şərhləri siyahılayır. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser().catch(() => null);
  const post = await prisma.communityPost.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!post || post.status !== "APPROVED") {
    return NextResponse.json({ error: "Post tapılmadı." }, { status: 404 });
  }

  const comments = await prisma.communityPostComment.findMany({
    where: { postId: post.id, isHidden: false },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: {
        id: c.user.id,
        name: c.user.name ?? c.user.email.split("@")[0],
        avatarUrl: c.user.avatarUrl,
      },
      isMine: me?.id === c.userId,
    })),
  });
}

/** POST: posta şərh əlavə et. Body: { body: 1..1000 }. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (text.length < COMMUNITY_COMMENT_BODY_MIN) {
    return NextResponse.json({ error: "Şərh boş ola bilməz." }, { status: 400 });
  }
  if (text.length > COMMUNITY_COMMENT_BODY_MAX) {
    return NextResponse.json(
      { error: `Şərh maksimum ${COMMUNITY_COMMENT_BODY_MAX} simvol ola bilər.` },
      { status: 400 },
    );
  }

  // Spam əleyhinə: 30 saniyədə bir şərh.
  const lastComment = await prisma.communityPostComment.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const commentWait = cooldownRemainingMs(lastComment?.createdAt, COMMUNITY_COMMENT_COOLDOWN_MS);
  if (commentWait > 0) {
    return NextResponse.json(
      { error: `Çox tez-tez şərh yazırsan. ${formatWait(commentWait)} sonra yenidən cəhd et.` },
      { status: 429 },
    );
  }

  const clean = await cleanupCommunityText({
    text,
    kind: "comment",
    maxLength: COMMUNITY_COMMENT_BODY_MAX,
  });

  if (clean.text.length < COMMUNITY_COMMENT_BODY_MIN) {
    return NextResponse.json({ error: "Şərh boş ola bilməz." }, { status: 400 });
  }

  const post = await prisma.communityPost.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!post || post.status !== "APPROVED") {
    return NextResponse.json({ error: "Post tapılmadı." }, { status: 404 });
  }

  if (!clean.safeToPublish) {
    await prisma.communityPost.create({
      data: {
        userId: user.id,
        category: "GENERAL",
        title: "Şərh yoxlaması",
        body: text,
        status: "PENDING",
        moderationNote: [
          "AI şərhi public paylaşmadı.",
          `Səbəb: ${clean.reason ?? "REVIEW"}.`,
          `Aid olduğu post: ${post.id}.`,
        ].join(" "),
      },
    });

    return NextResponse.json({
      ok: true,
      blocked: true,
      reason: clean.reason ?? "OTHER",
    });
  }

  const created = await prisma.communityPostComment.create({
    data: { postId: post.id, userId: user.id, body: clean.text },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: created.id,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
      author: {
        id: created.user.id,
        name: created.user.name ?? created.user.email.split("@")[0],
        avatarUrl: created.user.avatarUrl,
      },
      isMine: true,
    },
  });
}
