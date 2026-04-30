import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { serviceProductId, psnAccountId, metadata } = body;

  if (!serviceProductId) return NextResponse.json({ error: "Xidmət seçilməyib." }, { status: 400 });

  const sp = await prisma.serviceProduct.findUnique({ where: { id: serviceProductId } });
  if (!sp || !sp.isActive) return NextResponse.json({ error: "Xidmət tapılmadı və ya aktiv deyil." }, { status: 404 });

  if (user.walletBalance < sp.priceAznCents) {
    return NextResponse.json({ error: "Balans kifayət etmir." }, { status: 400 });
  }

  // Transaction for TRY_BALANCE -> instant fulfillment
  if (sp.type === "TRY_BALANCE") {
    try {
      const code = await prisma.$transaction(async (tx) => {
        // Find one unused code, lock it
        const sc = await tx.serviceCode.findFirst({
          where: { serviceProductId: sp.id, isUsed: false },
          orderBy: { createdAt: "asc" },
        });
        if (!sc) throw new Error("OUT_OF_STOCK");

        // Mark as used
        await tx.serviceCode.update({
          where: { id: sc.id },
          data: { isUsed: true },
        });

        // Deduct balance
        await tx.user.update({
          where: { id: user.id },
          data: { walletBalance: { decrement: sp.priceAznCents } },
        });

        // Create transaction
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: "SERVICE_PURCHASE",
            status: "SUCCESS", // delivered instantly
            amountAznCents: -sp.priceAznCents,
            serviceProductId: sp.id,
            serviceCodeId: sc.id,
            metadata: JSON.stringify({ tryAmount: (sp.metadata as Record<string, unknown>)?.tryAmount }),
          },
        });

        return sc.code;
      });

      return NextResponse.json({ ok: true, code });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "OUT_OF_STOCK") {
        return NextResponse.json({ error: "Bu balans üçün stokda e-pin qalmayıb." }, { status: 400 });
      }
      return NextResponse.json({ error: "Gözlənilməz xəta baş verdi." }, { status: 500 });
    }
  }

  // PS_PLUS and ACCOUNT_CREATION -> Requires manual admin fulfillment
  try {
    await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: user.id },
        data: { walletBalance: { decrement: sp.priceAznCents } },
      });

      // Create pending transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "SERVICE_PURCHASE",
          status: "PENDING",
          amountAznCents: -sp.priceAznCents,
          serviceProductId: sp.id,
          psnAccountId: psnAccountId || null,
          metadata: JSON.stringify(metadata || {}), // stores Form answers or PS Plus details
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sifariş yaradıla bilmədi." }, { status: 500 });
  }
}
