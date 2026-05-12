import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  decodeEpointData,
  epointResultIsSuccess,
  readEpointAmountCents,
  readEpointOrderId,
  verifyEpointSignature,
  type EpointResultData,
} from "@/lib/epoint";
import {
  EPOINT_CART_PAYMENT_TYPE,
  finalizeEpointCartCheckout,
} from "@/lib/epointCartCheckout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResultPayload = {
  data: string | null;
  signature: string | null;
  decoded: EpointResultData;
  verified: boolean;
};

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

function buildResultMetadata(txMetadata: string | null, payload: EpointResultData) {
  return JSON.stringify({
    ...readMetadata(txMetadata),
    gateway: "epoint",
    result: payload,
    resultReceivedAt: new Date().toISOString(),
  });
}

async function readPayload(req: Request): Promise<ResultPayload> {
  const url = new URL(req.url);
  let data = url.searchParams.get("data");
  let signature = url.searchParams.get("signature");
  let decoded: EpointResultData = {};

  if (req.method !== "GET") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      data = typeof body.data === "string" ? body.data : data;
      signature = typeof body.signature === "string" ? body.signature : signature;
      if (!data && body && typeof body === "object" && !Array.isArray(body)) {
        decoded = body as EpointResultData;
      }
    } else {
      const raw = await req.text().catch(() => "");
      if (raw) {
        const params = new URLSearchParams(raw);
        const d = params.get("data");
        const s = params.get("signature");
        if (d) data = d;
        if (s) signature = s;
      }
    }
  }

  if (data) {
    try {
      decoded = decodeEpointData(data);
    } catch {
      decoded = {};
    }
  }

  const privateKey = (process.env.EPOINT_PRIVATE_KEY ?? "").trim();
  const verified =
    Boolean(privateKey) && Boolean(data) && Boolean(signature)
      ? verifyEpointSignature(data!, signature!, privateKey)
      : false;

  return { data, signature, decoded, verified };
}

async function applyResult(payload: ResultPayload) {
  const orderId = readEpointOrderId(payload.decoded);
  if (!orderId) return { orderId: null, updated: false, reason: "ORDER_ID_MISSING" };

  if (!payload.data || !payload.signature) {
    return { orderId, updated: false, reason: "SIGNED_PAYLOAD_MISSING" };
  }

  if (!payload.verified) {
    return { orderId, updated: false, reason: "SIGNATURE_INVALID" };
  }

  const status = epointResultIsSuccess(payload.decoded) ? "SUCCESS" : "FAILED";
  const tx = await prisma.transaction.findUnique({ where: { id: orderId } });
  if (!tx) return { orderId, updated: false, reason: "ORDER_NOT_FOUND" };

  if (tx.type !== "DEPOSIT" && tx.type !== EPOINT_CART_PAYMENT_TYPE) {
    return { orderId, updated: false, reason: "UNSUPPORTED_TRANSACTION_TYPE" };
  }

  if (tx.status !== "PENDING") {
    return { orderId, updated: false, reason: `ALREADY_${tx.status}` };
  }

  const amountCents = readEpointAmountCents(payload.decoded);
  if (status === "SUCCESS" && amountCents != null && amountCents !== tx.amountAznCents) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: "FAILED",
        metadata: JSON.stringify({
          ...readMetadata(tx.metadata),
          gateway: "epoint",
          result: payload.decoded,
          resultReceivedAt: new Date().toISOString(),
          error: "AMOUNT_MISMATCH",
          expectedAmountAznCents: tx.amountAznCents,
          receivedAmountAznCents: amountCents,
        }),
      },
    });

    return { orderId, updated: false, reason: "AMOUNT_MISMATCH" };
  }

  const metadata = buildResultMetadata(tx.metadata, payload.decoded);

  if (tx.type === EPOINT_CART_PAYMENT_TYPE) {
    if (status === "SUCCESS") {
      const checkoutResult = await finalizeEpointCartCheckout(tx, payload.decoded);
      return {
        orderId,
        updated: checkoutResult.ok,
        status,
        reason: checkoutResult.ok ? undefined : checkoutResult.reason,
        orderCode: checkoutResult.ok ? checkoutResult.orderCode : undefined,
      };
    }

    const result = await prisma.transaction.updateMany({
      where: { id: tx.id, status: "PENDING" },
      data: { status, metadata },
    });
    if (result.count !== 1) return { orderId, updated: false, reason: "ALREADY_PROCESSED" };

    return { orderId, updated: true, status };
  }

  if (status === "SUCCESS") {
    const updated = await prisma.$transaction(async (db) => {
      const result = await db.transaction.updateMany({
        where: { id: tx.id, status: "PENDING" },
        data: { status, metadata },
      });
      if (result.count !== 1) return false;

      await db.user.update({
        where: { id: tx.userId },
        data: { walletBalance: { increment: tx.amountAznCents } },
      });

      return true;
    });

    if (!updated) return { orderId, updated: false, reason: "ALREADY_PROCESSED" };
  } else {
    const result = await prisma.transaction.updateMany({
      where: { id: tx.id, status: "PENDING" },
      data: { status, metadata },
    });

    if (result.count !== 1) return { orderId, updated: false, reason: "ALREADY_PROCESSED" };
  }

  return { orderId, updated: true, status };
}

async function handleResult(req: Request) {
  try {
    const payload = await readPayload(req);
    const result = await applyResult(payload);

    console.log("[epoint:/result]", {
      method: req.method,
      verified: payload.verified,
      hasData: Boolean(payload.data),
      hasSignature: Boolean(payload.signature),
      decodedKeys: Object.keys(payload.decoded ?? {}),
      decodedStatus: payload.decoded?.status,
      decodedCode: payload.decoded?.code,
      decodedOrderId: payload.decoded?.order_id,
      result,
    });

    if (result.reason === "SIGNATURE_INVALID") {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      verified: payload.verified,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Epoint result failed";
    console.error("[epoint:/result] error", message, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handleResult(req);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.has("data") || url.searchParams.has("signature")) {
    return handleResult(req);
  }

  return new Response(
    `<!doctype html>
<html lang="az">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Epoint nəticə endpointi</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #09090b;
        color: #f4f4f5;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(92vw, 520px);
        border: 1px solid rgba(129, 140, 248, 0.28);
        border-radius: 22px;
        background: rgba(24, 24, 27, 0.72);
        padding: 32px;
        box-shadow: 0 24px 90px rgba(49, 46, 129, 0.18);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(129, 140, 248, 0.35);
        border-radius: 999px;
        padding: 6px 10px;
        color: #c4b5fd;
        background: rgba(99, 102, 241, 0.12);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      h1 { margin: 18px 0 10px; font-size: 30px; line-height: 1.15; }
      p { margin: 0; color: #a1a1aa; line-height: 1.7; font-size: 15px; }
      code {
        display: block;
        margin-top: 18px;
        border-radius: 12px;
        border: 1px solid rgba(63, 63, 70, 0.9);
        background: rgba(9, 9, 11, 0.65);
        padding: 12px;
        color: #d4d4d8;
        font-size: 13px;
      }
      a {
        display: inline-flex;
        margin-top: 24px;
        border-radius: 12px;
        background: #6366f1;
        color: #fff;
        padding: 10px 14px;
        text-decoration: none;
        font-size: 14px;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Epoint callback</span>
      <h1>Bu URL istifadəçi səhifəsi deyil</h1>
      <p>
        <b>/result</b> Epoint-in ödəniş nəticəsini serverə göndərməsi üçündür.
        Brauzerdə açanda balans və ya sifariş dəyişmir. Epoint bu endpointə imzalı
        <b>POST</b> sorğusu göndərəndə nəticə emal olunur.
      </p>
      <code>Result URL: ${url.origin}/result</code>
      <a href="/profile/wallet">Balans səhifəsinə qayıt</a>
    </main>
  </body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
