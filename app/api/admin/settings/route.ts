import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await prisma.settings.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global" },
    });
    return NextResponse.json(settings);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const missingNewColumns =
      msg.includes("profitMarginGamesPct") ||
      msg.includes("profitMarginGiftCardsPct") ||
      msg.includes("profitMarginPsPlusPct");
    if (!missingNewColumns) throw err;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        tryToAznRate: number;
        profitMarginPct: number;
        affiliateRatePct: number;
        referralProfitSharePct: number;
        depositCardNumber: string | null;
        depositCardHolder: string | null;
        updatedAt: Date;
      }>
    >`
      INSERT INTO "Settings" ("id", "updatedAt")
      VALUES ('global', NOW())
      ON CONFLICT ("id") DO UPDATE SET "id" = EXCLUDED."id"
      RETURNING
        "id",
        "tryToAznRate",
        "profitMarginPct",
        "affiliateRatePct",
        "referralProfitSharePct",
        "depositCardNumber",
        "depositCardHolder",
        "updatedAt";
    `;
    const s = rows[0];
    return NextResponse.json({
      ...s,
      profitMarginGamesPct: s.profitMarginPct,
      profitMarginGiftCardsPct: s.profitMarginPct,
      profitMarginPsPlusPct: s.profitMarginPct,
    });
  }
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
  const profitMarginGamesPct = Number(body.profitMarginGamesPct);
  const profitMarginGiftCardsPct = Number(body.profitMarginGiftCardsPct);
  const profitMarginPsPlusPct = Number(body.profitMarginPsPlusPct);
  const affiliateRatePct = Number(body.affiliateRatePct);

  if (!Number.isFinite(tryToAznRate) || tryToAznRate <= 0) {
    return NextResponse.json({ error: "Invalid tryToAznRate" }, { status: 400 });
  }
  if (!Number.isFinite(profitMarginPct) || profitMarginPct < 0) {
    return NextResponse.json({ error: "Invalid profitMarginPct" }, { status: 400 });
  }
  if (!Number.isFinite(profitMarginGamesPct) || profitMarginGamesPct < 0) {
    return NextResponse.json({ error: "Invalid profitMarginGamesPct" }, { status: 400 });
  }
  if (!Number.isFinite(profitMarginGiftCardsPct) || profitMarginGiftCardsPct < 0) {
    return NextResponse.json({ error: "Invalid profitMarginGiftCardsPct" }, { status: 400 });
  }
  if (!Number.isFinite(profitMarginPsPlusPct) || profitMarginPsPlusPct < 0) {
    return NextResponse.json({ error: "Invalid profitMarginPsPlusPct" }, { status: 400 });
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

  try {
    const updated = await prisma.settings.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        tryToAznRate,
        profitMarginPct,
        profitMarginGamesPct,
        profitMarginGiftCardsPct,
        profitMarginPsPlusPct,
        affiliateRatePct,
        depositCardNumber,
        depositCardHolder,
      },
      update: {
        tryToAznRate,
        profitMarginPct,
        profitMarginGamesPct,
        profitMarginGiftCardsPct,
        profitMarginPsPlusPct,
        affiliateRatePct,
        depositCardNumber,
        depositCardHolder,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const missingNewColumns =
      msg.includes("profitMarginGamesPct") ||
      msg.includes("profitMarginGiftCardsPct") ||
      msg.includes("profitMarginPsPlusPct");
    if (!missingNewColumns) throw err;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        tryToAznRate: number;
        profitMarginPct: number;
        affiliateRatePct: number;
        referralProfitSharePct: number;
        depositCardNumber: string | null;
        depositCardHolder: string | null;
        updatedAt: Date;
      }>
    >`
      INSERT INTO "Settings" (
        "id",
        "tryToAznRate",
        "profitMarginPct",
        "affiliateRatePct",
        "depositCardNumber",
        "depositCardHolder",
        "updatedAt"
      )
      VALUES (
        'global',
        ${tryToAznRate},
        ${profitMarginPct},
        ${affiliateRatePct},
        ${depositCardNumber},
        ${depositCardHolder},
        NOW()
      )
      ON CONFLICT ("id") DO UPDATE SET
        "tryToAznRate" = EXCLUDED."tryToAznRate",
        "profitMarginPct" = EXCLUDED."profitMarginPct",
        "affiliateRatePct" = EXCLUDED."affiliateRatePct",
        "depositCardNumber" = EXCLUDED."depositCardNumber",
        "depositCardHolder" = EXCLUDED."depositCardHolder",
        "updatedAt" = NOW()
      RETURNING
        "id",
        "tryToAznRate",
        "profitMarginPct",
        "affiliateRatePct",
        "referralProfitSharePct",
        "depositCardNumber",
        "depositCardHolder",
        "updatedAt";
    `;
    const s = rows[0];
    return NextResponse.json({
      ...s,
      profitMarginGamesPct: s.profitMarginPct,
      profitMarginGiftCardsPct: s.profitMarginPct,
      profitMarginPsPlusPct: s.profitMarginPct,
    });
  }
}
