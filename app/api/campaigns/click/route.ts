import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gameUrl } from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public klik izləmə yönləndiricisi. Kampaniya mesajlarındakı oyun linkləri
 * buradan keçir: klik qeyd olunur, sonra istifadəçi oyun səhifəsinə yönləndirilir.
 *
 * Açıq yönləndirmə (open redirect) riskini önləmək üçün yalnız öz domenimizdəki
 * `/oyunlar/{productId}` ünvanına yönləndiririk.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("c") ?? "";
  const recipientId = searchParams.get("r") ?? "";
  const productId = searchParams.get("p") ?? "";

  const target = productId ? gameUrl(productId) : gameUrl("");

  if (!campaignId || !productId) {
    return NextResponse.redirect(target, 302);
  }

  // İzləmə uğursuz olsa belə yönləndirmə pozulmamalıdır.
  try {
    const recipient = recipientId
      ? await prisma.campaignRecipient.findUnique({
          where: { id: recipientId },
          select: { id: true, campaignId: true, userId: true },
        })
      : null;

    await prisma.campaignClick.create({
      data: {
        campaignId,
        recipientId: recipient?.id ?? null,
        userId: recipient?.userId ?? null,
        productId,
      },
    });

    if (recipient) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { clickCount: { increment: 1 }, lastClickAt: new Date() },
      });
      // firstClickAt yalnız ilk klikdə təyin olunsun.
      await prisma.campaignRecipient.updateMany({
        where: { id: recipient.id, firstClickAt: null },
        data: { firstClickAt: new Date() },
      });
    }
  } catch {
    /* izləmə xətası — yönləndirməyə təsir etmir */
  }

  return NextResponse.redirect(target, 302);
}
