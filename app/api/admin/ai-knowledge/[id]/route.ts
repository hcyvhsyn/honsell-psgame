import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  isValidAiKnowledgeCategory,
  invalidateAiKnowledgeCache,
} from "@/lib/aiKnowledge";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const data: {
    title?: string;
    content?: string;
    isActive?: boolean;
    sortOrder?: number;
    category?: string;
  } = {};

  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.content === "string") data.content = body.content.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder);
  }
  if (typeof body.category === "string" && isValidAiKnowledgeCategory(body.category)) {
    data.category = body.category;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Yeniləmək üçün data yoxdur." }, { status: 400 });
  }

  const updated = await prisma.aiKnowledge.update({ where: { id }, data });
  invalidateAiKnowledgeCache();
  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.aiKnowledge.delete({ where: { id } });
  invalidateAiKnowledgeCache();
  return NextResponse.json({ ok: true });
}
