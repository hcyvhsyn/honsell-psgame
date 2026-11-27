import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { parseCrmRenewalMetadata } from "@/lib/crmRenewalCheckout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin: /abunelik CRM yeniləmələri (son 300). */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const rows = await prisma.crmRenewalOrder.findMany({
    where: status && ["PENDING", "SUCCESS", "FAILED"].includes(status) ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  // 3% xidmət haqqı CrmRenewalOrder-də sütun deyil — ödənişin metadata-sındadır (geri ödəmə məbləği = qiymət + haqq).
  const payments = await prisma.transaction.findMany({
    where: { id: { in: rows.map((r) => r.paymentTransactionId) } },
    select: { id: true, metadata: true },
  });
  const feeByPayment = new Map(
    payments.map((p) => [p.id, parseCrmRenewalMetadata(p.metadata)?.renewal.serviceFeeCents ?? 0]),
  );
  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, serviceFeeCents: feeByPayment.get(r.paymentTransactionId) ?? 0 })),
  });
}
