import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { computeLegacyGameReferralRatePct } from "@/lib/pricing";

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
      msg.includes("profitMarginPsPlusPct") ||
      msg.includes("referralGamesPct") ||
      msg.includes("referralPsPlusPct") ||
      msg.includes("referralGiftCardsPct") ||
      msg.includes("referralAccountCreationPct");
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
    revalidatePath("/qazan");
    return NextResponse.json({
      ...s,
      profitMarginGamesPct: s.profitMarginPct,
      profitMarginGiftCardsPct: s.profitMarginPct,
      profitMarginPsPlusPct: s.profitMarginPct,
      referralGamesPct: computeLegacyGameReferralRatePct(
        s.referralProfitSharePct,
        s.profitMarginPct,
      ),
      referralPsPlusPct: 0,
      referralGiftCardsPct: 0,
      referralAccountCreationPct: 0,
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
  // Epic positional-pricing knobs — default when absent so older clients that
  // don't post them aren't rejected.
  const usdToAznRate = body.usdToAznRate != null ? Number(body.usdToAznRate) : 1.7;
  const epicPositionPct =
    body.epicPositionPct != null ? Number(body.epicPositionPct) : 50;
  const epicMinProfitPct =
    body.epicMinProfitPct != null ? Number(body.epicMinProfitPct) : 10;
  // Sabit dəvət bonusu (qəpik). Köhnə client-lər göndərməsə default saxlanır.
  const referralInviteBonusCents =
    body.referralInviteBonusCents != null
      ? Math.trunc(Number(body.referralInviteBonusCents))
      : 30;
  const sponsoredReferralInviteBonusCents =
    body.sponsoredReferralInviteBonusCents != null
      ? Math.trunc(Number(body.sponsoredReferralInviteBonusCents))
      : 30;

  if (!Number.isFinite(tryToAznRate) || tryToAznRate <= 0) {
    return NextResponse.json({ error: "Invalid tryToAznRate" }, { status: 400 });
  }
  if (!Number.isFinite(usdToAznRate) || usdToAznRate <= 0) {
    return NextResponse.json({ error: "Invalid usdToAznRate" }, { status: 400 });
  }
  if (!Number.isFinite(epicPositionPct) || epicPositionPct < 0 || epicPositionPct > 100) {
    return NextResponse.json({ error: "Invalid epicPositionPct" }, { status: 400 });
  }
  if (!Number.isFinite(epicMinProfitPct) || epicMinProfitPct < 0) {
    return NextResponse.json({ error: "Invalid epicMinProfitPct" }, { status: 400 });
  }
  if (!Number.isFinite(referralInviteBonusCents) || referralInviteBonusCents < 0) {
    return NextResponse.json({ error: "Invalid referralInviteBonusCents" }, { status: 400 });
  }
  if (
    !Number.isFinite(sponsoredReferralInviteBonusCents) ||
    sponsoredReferralInviteBonusCents < 0
  ) {
    return NextResponse.json(
      { error: "Invalid sponsoredReferralInviteBonusCents" },
      { status: 400 }
    );
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

  const depositCardNumber =
    typeof body.depositCardNumber === "string"
      ? body.depositCardNumber.replace(/\s+/g, "").slice(0, 19) || null
      : null;
  const depositCardHolder =
    typeof body.depositCardHolder === "string"
      ? body.depositCardHolder.trim().slice(0, 60) || null
      : null;

  try {
    const baseData = {
      tryToAznRate,
      profitMarginPct,
      profitMarginGamesPct,
      profitMarginGiftCardsPct,
      profitMarginPsPlusPct,
      usdToAznRate,
      epicPositionPct,
      epicMinProfitPct,
      referralInviteBonusCents,
      sponsoredReferralInviteBonusCents,
      depositCardNumber,
      depositCardHolder,
    };
    const updated = await prisma.settings.upsert({
      where: { id: "global" },
      create: { id: "global", ...baseData },
      update: baseData,
    });
    revalidatePath("/qazan");
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const missingNewColumns =
      msg.includes("profitMarginGamesPct") ||
      msg.includes("profitMarginGiftCardsPct") ||
      msg.includes("profitMarginPsPlusPct") ||
      msg.includes("referralGamesPct") ||
      msg.includes("referralPsPlusPct") ||
      msg.includes("referralGiftCardsPct") ||
      msg.includes("referralAccountCreationPct");
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
        "depositCardNumber",
        "depositCardHolder",
        "updatedAt"
      )
      VALUES (
        'global',
        ${tryToAznRate},
        ${profitMarginPct},
        ${depositCardNumber},
        ${depositCardHolder},
        NOW()
      )
      ON CONFLICT ("id") DO UPDATE SET
        "tryToAznRate" = EXCLUDED."tryToAznRate",
        "profitMarginPct" = EXCLUDED."profitMarginPct",
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
