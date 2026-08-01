import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rateLimit";
import { openLootBox, LootBoxError } from "@/lib/lootBoxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `LootBoxError` kodlarını HTTP statuslarına çevirir. */
const STATUS_BY_CODE: Record<string, number> = {
  BOX_NOT_FOUND: 404,
  BOX_INACTIVE: 400,
  NO_TICKETS: 409,
  TICKET_CONCURRENT_DRAW: 409,
  INSUFFICIENT_BALANCE: 402,
  DAILY_LIMIT: 429,
};

/**
 * Qutunu açır. Ödəniş yalnız cüzdan balansındandır.
 *
 * Balans şərtli debetlə tutulur (lib/lootBoxes.ts → openLootBox), ona görə
 * sürətlə iki dəfə klikləmə ikinci açılış yarada bilmir.
 */
export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Əvvəlcə hesabınıza daxil olun." }, { status: 401 });
  }

  const limit = await consumeRateLimit({
    key: `lootbox:open:${user.id}`,
    scope: "lootbox.open",
    windowSeconds: 3600,
    max: 60,
    identifier: user.id,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Çox sayda açılış cəhdi. Bir az gözləyin." },
      { status: 429 }
    );
  }

  const box = await prisma.lootBox.findUnique({ where: { slug: params.slug } });
  if (!box) {
    return NextResponse.json({ error: "Qutu tapılmadı." }, { status: 404 });
  }

  try {
    // İki nəfər eyni anda eyni bileti seçsə uduzan tərəfin transaction-ı geri
    // qayıdır (balans da qaytarılır) — istifadəçiyə xəta göstərmək əvəzinə
    // sakitcə yenidən cəhd edirik.
    let lastConcurrent: LootBoxError | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await openLootBox({ userId: user.id, box });
        return NextResponse.json({ ok: true, ...result });
      } catch (err) {
        if (err instanceof LootBoxError && err.code === "TICKET_CONCURRENT_DRAW") {
          lastConcurrent = err;
          continue;
        }
        throw err;
      }
    }
    throw lastConcurrent ?? new Error("LOOT_BOX_RETRY_EXHAUSTED");
  } catch (err) {
    if (err instanceof LootBoxError) {
      const status = STATUS_BY_CODE[err.code] ?? 400;
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          ...(err.code === "INSUFFICIENT_BALANCE"
            ? { requiredAzn: box.priceAznCents / 100, balanceAzn: user.walletBalance / 100 }
            : {}),
        },
        { status }
      );
    }
    console.error("loot box open failed", params.slug, err);
    return NextResponse.json({ error: "Qutu açıla bilmədi. Yenidən cəhd edin." }, { status: 500 });
  }
}
