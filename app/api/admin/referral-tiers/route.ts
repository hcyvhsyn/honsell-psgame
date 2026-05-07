import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();
  const tiers = await prisma.referralTier.findMany({
    orderBy: [{ position: "asc" }, { thresholdPoints: "asc" }],
  });
  return NextResponse.json({ tiers });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const thresholdPoints = Number(body.thresholdPoints);
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  const bonusAznCents = Number(body.bonusAznCents);
  const position = Number.isFinite(Number(body.position)) ? Number(body.position) : 0;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  if (!Number.isFinite(thresholdPoints) || thresholdPoints <= 0) {
    return NextResponse.json({ error: "Düzgün bal həddi (>0) tələb olunur." }, { status: 400 });
  }
  if (!label || !emoji) {
    return NextResponse.json({ error: "Ad və emoji tələb olunur." }, { status: 400 });
  }
  if (!Number.isFinite(bonusAznCents) || bonusAznCents < 0) {
    return NextResponse.json({ error: "Bonus məbləği qəpik (cents) ilə verilməlidir." }, { status: 400 });
  }

  try {
    const created = await prisma.referralTier.create({
      data: { thresholdPoints, label, emoji, bonusAznCents, position, isActive },
    });
    return NextResponse.json({ ok: true, tier: created });
  } catch {
    return NextResponse.json(
      { error: "Bu bal həddi ilə pillə artıq mövcuddur." },
      { status: 409 }
    );
  }
}
