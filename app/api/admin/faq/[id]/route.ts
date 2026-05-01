import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  const body = await req.json().catch(() => ({}));

  const data: {
    question?: string;
    answer?: string;
    isActive?: boolean;
    sortOrder?: number;
  } = {};

  if (typeof body.question === "string") data.question = body.question.trim();
  if (typeof body.answer === "string") data.answer = body.answer.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder);
  }

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Yeniləmək üçün data yoxdur." }, { status: 400 });
  }

  const updated = await prisma.faqItem.update({ where: { id }, data });
  return NextResponse.json({ ok: true, faq: updated });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await requireAdmin();
  const id = String(ctx.params.id ?? "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.faqItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

