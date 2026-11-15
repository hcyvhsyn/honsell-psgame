import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { pushCrmRenewalToCrm } from "@/lib/crmRenewals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin əməliyyatları: { action: "crm-push" | "mark-success" | "mark-failed" | "refund-wallet", reason? }
 * refund-wallet: yalnız FAILED sifarişdə, bir dəfə — CRM qiyməti (amountAznCents) cüzdana qaytarılır
 * (min 5 AZN round-up fərqi ödəniş anında onsuz da cüzdana yazılıb).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { action?: string; reason?: string } | null;
  const order = await prisma.crmRenewalOrder.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Tapılmadı" }, { status: 404 });

  switch (body?.action) {
    case "crm-push": {
      if (order.status !== "PENDING") return NextResponse.json({ error: `Status: ${order.status}` }, { status: 409 });
      const r = await pushCrmRenewalToCrm(order.id);
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 502 });
    }
    case "mark-success":
    case "mark-failed": {
      const status = body.action === "mark-success" ? "SUCCESS" : "FAILED";
      const r = await prisma.crmRenewalOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: {
          status,
          completedAt: new Date(),
          ...(status === "FAILED" ? { failReason: String(body.reason || `Admin (${admin.email}) ləğv etdi`).slice(0, 500) } : {}),
        },
      });
      return r.count === 1 ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Sifariş artıq bağlanıb" }, { status: 409 });
    }
    case "refund-wallet": {
      if (order.status !== "FAILED") return NextResponse.json({ error: "Yalnız uğursuz sifariş qaytarılır" }, { status: 409 });
      const done = await prisma.$transaction(async (tx) => {
        const claim = await tx.crmRenewalOrder.updateMany({
          where: { id: order.id, status: "FAILED", refundStatus: null },
          data: { refundStatus: "WALLET" },
        });
        if (claim.count !== 1) return false;
        await tx.user.update({ where: { id: order.userId }, data: { walletBalance: { increment: order.amountAznCents } } });
        await tx.transaction.create({
          data: {
            userId: order.userId,
            type: "DEPOSIT",
            status: "SUCCESS",
            amountAznCents: order.amountAznCents,
            metadata: JSON.stringify({
              kind: "CRM_RENEWAL_REFUND",
              orderCode: order.orderCode,
              crmRenewalOrderId: order.id,
              epointPaymentId: order.paymentTransactionId,
              refundedBy: admin.email,
            }),
          },
        });
        return true;
      });
      return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Artıq qaytarılıb" }, { status: 409 });
    }
    default:
      return NextResponse.json({ error: "Naməlum əməliyyat" }, { status: 400 });
  }
}
