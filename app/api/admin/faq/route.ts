import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();
  const faqs = await prisma.faqItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ faqs });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!question || !answer) {
    return NextResponse.json({ error: "Sual və cavab tələb olunur." }, { status: 400 });
  }

  const created = await prisma.faqItem.create({
    data: { question, answer, isActive, sortOrder },
  });
  return NextResponse.json({ ok: true, faq: created });
}

