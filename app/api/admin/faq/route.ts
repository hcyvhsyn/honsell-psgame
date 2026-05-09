import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { isValidContentScope } from "@/lib/contentScopes";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const where = scope && isValidContentScope(scope) ? { scope } : {};
  const faqs = await prisma.faqItem.findMany({
    where,
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
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
  const scope = isValidContentScope(String(body.scope)) ? String(body.scope) : "HOME";

  if (!question || !answer) {
    return NextResponse.json({ error: "Sual və cavab tələb olunur." }, { status: 400 });
  }

  const created = await prisma.faqItem.create({
    data: { question, answer, isActive, sortOrder, scope },
  });
  return NextResponse.json({ ok: true, faq: created });
}
