import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartnerKey } from "@/lib/partnerAuth";
import { isSpotifyOrderRow, transactionIdFromExternalRef } from "@/lib/crmSpotify";
import { approvePlatformOrder } from "@/lib/platformOrderApproval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRM → mağaza: Spotify Individual "Hazırdır" (vendor premium etdi).
 * Body: { externalRef: "store:tx:<transactionId>" } — CRM-ə göndərdiyimiz açar.
 *
 * Sifariş SUCCESS olur, müştəri profilində abunəlik yaranır, referal komissiyası yazılır.
 * Müştəriyə WhatsApp GÖNDƏRİLMİR — "premium edildi" mesajını CRM göndərib (təkrar olmasın).
 * İdempotent: artıq SUCCESS-dirsə `{ ok: true, alreadyCompleted: true }`.
 */
export async function POST(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { externalRef?: string } | null;
  const transactionId = transactionIdFromExternalRef(String(body?.externalRef ?? ""));
  if (!transactionId) {
    return NextResponse.json({ error: "externalRef düzgün deyil" }, { status: 400 });
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { serviceProduct: { select: { type: true, metadata: true } } },
  });
  if (!tx || tx.type !== "SERVICE_PURCHASE" || !isSpotifyOrderRow(tx)) {
    return NextResponse.json({ error: "Sifariş tapılmadı" }, { status: 404 });
  }
  if (tx.status === "SUCCESS") {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }
  if (tx.status !== "PENDING") {
    return NextResponse.json({ error: `Sifariş ${tx.status} statusundadır` }, { status: 409 });
  }

  const approved = await approvePlatformOrder(tx);
  return NextResponse.json({ ok: true, alreadyCompleted: !approved });
}
