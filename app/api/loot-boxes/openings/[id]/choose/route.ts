import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { resolveOpeningChoice, LootBoxError, LOOT_BOX_CHOICES } from "@/lib/lootBoxes";
import type { LootBoxChoice } from "@/lib/lootBoxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_BY_CODE: Record<string, number> = {
  OPENING_NOT_FOUND: 404,
  ALREADY_RESOLVED: 409,
  NO_PSN_ACCOUNT: 400,
  NO_EPIC_ACCOUNT: 400,
};

/**
 * Qazanılan hədiyyə ilə bağlı seçim:
 *   GAME      → adi sifariş kimi PENDING fulfillment (admin çatdırır)
 *   SELL_BACK → dəyərin `sellBackPct` faizi cüzdana kredit
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Əvvəlcə hesabınıza daxil olun." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const choice = body?.choice as LootBoxChoice;
  if (!LOOT_BOX_CHOICES.includes(choice)) {
    return NextResponse.json({ error: "Seçim düzgün deyil." }, { status: 400 });
  }

  try {
    const result = await resolveOpeningChoice({
      openingId: params.id,
      userId: user.id,
      choice,
      psnAccountId: typeof body?.psnAccountId === "string" ? body.psnAccountId : null,
      epicAccountId: typeof body?.epicAccountId === "string" ? body.epicAccountId : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LootBoxError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: STATUS_BY_CODE[err.code] ?? 400 }
      );
    }
    console.error("loot box choice failed", params.id, err);
    return NextResponse.json({ error: "Əməliyyat tamamlanmadı. Yenidən cəhd edin." }, { status: 500 });
  }
}
