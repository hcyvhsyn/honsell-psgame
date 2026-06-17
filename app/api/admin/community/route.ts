import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communityCategoryDef } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/community?status=PENDING — İcma postlarının moderasiya siyahısı.
 * Status: PENDING | APPROVED | REJECTED | HIDDEN | ALL.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "PENDING").toUpperCase();
  const where =
    status === "ALL"
      ? {}
      : ["PENDING", "APPROVED", "REJECTED", "HIDDEN"].includes(status)
        ? { status }
        : { status: "PENDING" };

  const posts = await prisma.communityPost.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      category: p.category,
      categoryLabel: communityCategoryDef(p.category).label,
      title: p.title,
      body: p.body,
      status: p.status,
      moderatedAt: p.moderatedAt?.toISOString() ?? null,
      moderationNote: p.moderationNote,
      createdAt: p.createdAt.toISOString(),
      author: { id: p.user.id, name: p.user.name, email: p.user.email },
      commentCount: p._count.comments,
      reactionCount: p._count.reactions,
    })),
  });
}
