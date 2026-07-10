import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ENTRY_CONDITIONS, GIVEAWAY_STATUSES, type EntryCondition } from "@/lib/giveaways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → tək çəkiliş + iştirakçılar (admin baxışı). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { entries: true } },
      entries: {
        orderBy: [{ isWinner: "desc" }, { createdAt: "asc" }],
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      },
    },
  });
  if (!giveaway) return NextResponse.json({ error: "Tapılmadı." }, { status: 404 });
  return NextResponse.json({ giveaway });
}

/** PATCH → redaktə (sahələr + status dəyişimi). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.prizeLabel === "string") data.prizeLabel = body.prizeLabel.trim();
  if (typeof body.prizeImageUrl === "string") data.prizeImageUrl = body.prizeImageUrl.trim() || null;
  if (typeof body.winnersCount === "number" && body.winnersCount >= 1)
    data.winnersCount = Math.floor(body.winnersCount);
  if (ENTRY_CONDITIONS.includes(body.entryCondition as EntryCondition)) {
    data.entryCondition = body.entryCondition;
    data.conditionType =
      body.entryCondition === "PURCHASE_PRODUCT" && typeof body.conditionType === "string"
        ? body.conditionType.trim() || null
        : null;
  }
  if (typeof body.isVip === "boolean") data.isVip = body.isVip;
  if (typeof body.participantBoost === "number" && body.participantBoost >= 0)
    data.participantBoost = Math.floor(body.participantBoost);
  if (typeof body.endAt === "string") {
    const d = new Date(body.endAt);
    if (!Number.isNaN(d.getTime())) data.endAt = d;
  }
  if (typeof body.status === "string" && GIVEAWAY_STATUSES.includes(body.status as (typeof GIVEAWAY_STATUSES)[number]))
    data.status = body.status;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Dəyişiklik yoxdur." }, { status: 400 });

  const giveaway = await prisma.giveaway.update({ where: { id: params.id }, data });
  return NextResponse.json({ giveaway });
}

/** DELETE → çəkilişi sil (entries cascade). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  await prisma.giveaway.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
