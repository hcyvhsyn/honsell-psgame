import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  isValidAiKnowledgeCategory,
  invalidateAiKnowledgeCache,
} from "@/lib/aiKnowledge";

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();
  const items = await prisma.aiKnowledge.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const category = isValidAiKnowledgeCategory(String(body.category))
    ? String(body.category)
    : "GENERAL";

  if (!title || !content) {
    return NextResponse.json(
      { error: "Başlıq və mətn tələb olunur." },
      { status: 400 }
    );
  }

  const created = await prisma.aiKnowledge.create({
    data: { title, content, isActive, sortOrder, category },
  });
  invalidateAiKnowledgeCache();
  return NextResponse.json({ ok: true, item: created });
}
