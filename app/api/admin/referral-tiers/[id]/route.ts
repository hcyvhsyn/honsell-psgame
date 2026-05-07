import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const data: {
    thresholdPoints?: number;
    label?: string;
    emoji?: string;
    bonusAznCents?: number;
    position?: number;
    isActive?: boolean;
  } = {};

  if (body.thresholdPoints !== undefined) {
    const n = Number(body.thresholdPoints);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Düzgün bal həddi tələb olunur." }, { status: 400 });
    }
    data.thresholdPoints = n;
  }
  if (typeof body.label === "string") data.label = body.label.trim();
  if (typeof body.emoji === "string") data.emoji = body.emoji.trim();
  if (body.bonusAznCents !== undefined) {
    const n = Number(body.bonusAznCents);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Bonus qəpik (cents) ilə verilməlidir." }, { status: 400 });
    }
    data.bonusAznCents = n;
  }
  if (body.position !== undefined && Number.isFinite(Number(body.position))) {
    data.position = Number(body.position);
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  try {
    const updated = await prisma.referralTier.update({ where: { id }, data });
    return NextResponse.json({ ok: true, tier: updated });
  } catch {
    return NextResponse.json(
      { error: "Yeniləmə alınmadı (eyni bal həddi başqa pillədə ola bilər)." },
      { status: 409 }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await ctx.params;
  // Soft-delete by toggling `isActive`. Hard-delete is blocked by FK from
  // already-issued `ReferralCycleReward` rows (intentional — preserves
  // history). To reactivate, PATCH `isActive: true`.
  try {
    await prisma.referralTier.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Pillə tapılmadı." }, { status: 404 });
  }
}
