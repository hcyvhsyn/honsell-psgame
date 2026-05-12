import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  epointResultIsSuccess,
  fetchEpointStatus,
  getEpointConfig,
  readEpointAmountCents,
  type EpointResultData,
} from "@/lib/epoint";
import {
  EPOINT_CART_PAYMENT_TYPE,
  finalizeEpointCartCheckout,
} from "@/lib/epointCartCheckout";

export const runtime = "nodejs";

function readMetadata(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId tələb olunur." }, { status: 400 });
  }

  const tx = await prisma.transaction.findUnique({ where: { id: orderId } });
  if (!tx) return NextResponse.json({ error: "Tranzaksiya tapılmadı." }, { status: 404 });

  if (tx.type !== "DEPOSIT" && tx.type !== EPOINT_CART_PAYMENT_TYPE) {
    return NextResponse.json({ error: "Bu tip tranzaksiya Epoint-lə əlaqəli deyil." }, { status: 400 });
  }

  if (tx.status !== "PENDING") {
    return NextResponse.json({ ok: true, alreadyResolved: tx.status, orderId });
  }

  const config = getEpointConfig();
  if (!config) {
    return NextResponse.json({ error: "Epoint açarları qurulmayıb." }, { status: 503 });
  }

  const meta = readMetadata(tx.metadata);
  const epointMeta =
    meta.epoint && typeof meta.epoint === "object"
      ? (meta.epoint as Record<string, unknown>)
      : null;
  const epointTransaction =
    typeof epointMeta?.transaction === "string" ? (epointMeta.transaction as string) : null;

  if (!epointTransaction) {
    return NextResponse.json(
      { error: "Tranzaksiya metadata-sında Epoint transaction ID yoxdur." },
      { status: 422 },
    );
  }

  const statusResult = await fetchEpointStatus(epointTransaction, config.publicKey, config.privateKey);
  const decoded: EpointResultData = statusResult;
  const isSuccess = epointResultIsSuccess(decoded);
  const newStatus = isSuccess ? "SUCCESS" : "FAILED";

  const amountCents = readEpointAmountCents(decoded);
  if (isSuccess && amountCents != null && amountCents !== tx.amountAznCents) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: "FAILED",
        metadata: JSON.stringify({
          ...meta,
          gateway: "epoint",
          result: decoded,
          resultReceivedAt: new Date().toISOString(),
          reconciledManually: true,
          error: "AMOUNT_MISMATCH",
          expectedAmountAznCents: tx.amountAznCents,
          receivedAmountAznCents: amountCents,
        }),
      },
    });
    return NextResponse.json({
      ok: false,
      reason: "AMOUNT_MISMATCH",
      expectedAmountAznCents: tx.amountAznCents,
      receivedAmountAznCents: amountCents,
      epointStatus: decoded,
    });
  }

  const finalMeta = JSON.stringify({
    ...meta,
    gateway: "epoint",
    result: decoded,
    resultReceivedAt: new Date().toISOString(),
    reconciledManually: true,
  });

  if (tx.type === EPOINT_CART_PAYMENT_TYPE) {
    if (isSuccess) {
      const checkoutResult = await finalizeEpointCartCheckout(tx, decoded);
      return NextResponse.json({
        ok: checkoutResult.ok,
        status: newStatus,
        reason: checkoutResult.ok ? undefined : checkoutResult.reason,
        orderCode: checkoutResult.ok ? checkoutResult.orderCode : undefined,
        epointStatus: decoded,
      });
    }
    const updateResult = await prisma.transaction.updateMany({
      where: { id: tx.id, status: "PENDING" },
      data: { status: newStatus, metadata: finalMeta },
    });
    return NextResponse.json({
      ok: updateResult.count === 1,
      status: newStatus,
      epointStatus: decoded,
    });
  }

  if (isSuccess) {
    const updated = await prisma.$transaction(async (db) => {
      const updateResult = await db.transaction.updateMany({
        where: { id: tx.id, status: "PENDING" },
        data: { status: newStatus, metadata: finalMeta },
      });
      if (updateResult.count !== 1) return false;
      await db.user.update({
        where: { id: tx.userId },
        data: { walletBalance: { increment: tx.amountAznCents } },
      });
      return true;
    });
    return NextResponse.json({
      ok: updated,
      status: newStatus,
      epointStatus: decoded,
    });
  }

  const updateResult = await prisma.transaction.updateMany({
    where: { id: tx.id, status: "PENDING" },
    data: { status: newStatus, metadata: finalMeta },
  });
  return NextResponse.json({
    ok: updateResult.count === 1,
    status: newStatus,
    epointStatus: decoded,
  });
}
