import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartnerKey } from "@/lib/partnerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRM → mağaza: /abunelik yeniləməsinin nəticəsi (vendor Done, PS admin uzatması, və ya uğursuz).
 * Body: { externalRef: "store:renewal:<txId>", status: "COMPLETED" | "FAILED", resultEndDate?, reason? }
 * İdempotent: sifariş artıq SUCCESS/FAILED-dirsə `{ ok: true, alreadyCompleted: true }`.
 */
export async function POST(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    externalRef?: string;
    status?: string;
    resultEndDate?: string | null;
    reason?: string | null;
  } | null;
  const externalRef = String(body?.externalRef ?? "").trim();
  const status = body?.status === "COMPLETED" ? "SUCCESS" : body?.status === "FAILED" ? "FAILED" : null;
  if (!externalRef.startsWith("store:renewal:") || !status) {
    return NextResponse.json({ error: "externalRef və ya status düzgün deyil" }, { status: 400 });
  }
  const order = await prisma.crmRenewalOrder.findUnique({ where: { externalRef } });
  if (!order) return NextResponse.json({ error: "Sifariş tapılmadı" }, { status: 404 });
  if (order.status !== "PENDING") return NextResponse.json({ ok: true, alreadyCompleted: true });

  const end = body?.resultEndDate ? new Date(body.resultEndDate) : null;
  const now = new Date();
  await prisma.crmRenewalOrder.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: {
      status,
      crmStatus: body!.status!,
      completedAt: now,
      crmSyncedAt: order.crmSyncedAt ?? now,
      crmSyncError: null,
      ...(end && !Number.isNaN(end.getTime()) ? { resultEndDate: end } : {}),
      ...(status === "FAILED" ? { failReason: String(body?.reason || "CRM uzada bilmədi — geri ödəniş lazımdır").slice(0, 500) } : {}),
    },
  });
  return NextResponse.json({ ok: true, alreadyCompleted: false });
}
