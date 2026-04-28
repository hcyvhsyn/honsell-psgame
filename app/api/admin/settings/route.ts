import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const settings = await prisma.settings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const tryToAznRate = Number(body.tryToAznRate);
  const profitMarginPct = Number(body.profitMarginPct);
  const affiliateRatePct = Number(body.affiliateRatePct);

  if (!Number.isFinite(tryToAznRate) || tryToAznRate <= 0) {
    return NextResponse.json({ error: "Invalid tryToAznRate" }, { status: 400 });
  }
  if (!Number.isFinite(profitMarginPct) || profitMarginPct < 0) {
    return NextResponse.json({ error: "Invalid profitMarginPct" }, { status: 400 });
  }
  if (!Number.isFinite(affiliateRatePct) || affiliateRatePct < 0) {
    return NextResponse.json({ error: "Invalid affiliateRatePct" }, { status: 400 });
  }

  const depositCardNumber =
    typeof body.depositCardNumber === "string"
      ? body.depositCardNumber.replace(/\s+/g, "").slice(0, 19) || null
      : null;
  const depositCardHolder =
    typeof body.depositCardHolder === "string"
      ? body.depositCardHolder.trim().slice(0, 60) || null
      : null;

  const updated = await prisma.settings.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      tryToAznRate,
      profitMarginPct,
      affiliateRatePct,
      depositCardNumber,
      depositCardHolder,
    },
    update: {
      tryToAznRate,
      profitMarginPct,
      affiliateRatePct,
      depositCardNumber,
      depositCardHolder,
    },
  });

  return NextResponse.json(updated);
}
