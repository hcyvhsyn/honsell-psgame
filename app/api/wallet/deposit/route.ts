import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import {
  createEpointCheckout,
  getEpointConfig,
  type EpointCheckoutResponse,
} from "@/lib/epoint";

export const runtime = "nodejs";

const MIN_DEPOSIT_CENTS = 1;
const MAX_DEPOSIT_CENTS = 1_000_000;

function parseAznToCents(value: unknown) {
  const amount = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function requestOrigin(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host");
  if (host) return `${forwardedProto ?? "https"}://${host}`.replace(/\/$/, "");

  return SITE_URL;
}

function checkoutSucceeded(response: EpointCheckoutResponse) {
  return (
    String(response.status ?? "").toLowerCase() === "success" &&
    typeof response.redirect_url === "string" &&
    response.redirect_url.length > 0
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const amountCents = parseAznToCents(body.amountAzn);

  if (amountCents == null || amountCents < MIN_DEPOSIT_CENTS) {
    return NextResponse.json({ error: "Məbləğ ən azı 0.01 AZN olmalıdır." }, { status: 400 });
  }
  if (amountCents > MAX_DEPOSIT_CENTS) {
    return NextResponse.json({ error: "Məbləğ maksimum 10 000 AZN ola bilər." }, { status: 400 });
  }

  const config = getEpointConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Epoint açarları qurulmayıb: EPOINT_PUBLIC_KEY və EPOINT_PRIVATE_KEY lazımdır." },
      { status: 503 },
    );
  }

  const amountAzn = Number((amountCents / 100).toFixed(2));
  const origin = requestOrigin(req);
  const createdAt = new Date().toISOString();

  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "DEPOSIT",
      status: "PENDING",
      amountAznCents: amountCents,
      metadata: JSON.stringify({
        gateway: "epoint",
        flow: "wallet-deposit",
        createdAt,
      }),
    },
    select: { id: true },
  });

  let checkout: EpointCheckoutResponse;
  try {
    checkout = await createEpointCheckout(
      {
        public_key: config.publicKey,
        amount: amountAzn,
        currency: "AZN",
        language: "az",
        order_id: tx.id,
        description: `Honsell cüzdan balansı: ${amountAzn.toFixed(2)} AZN`,
        success_redirect_url: `${origin}/success?order_id=${encodeURIComponent(tx.id)}`,
        error_redirect_url: `${origin}/error?order_id=${encodeURIComponent(tx.id)}`,
        result_url: `${origin}/result`,
      },
      config.privateKey,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Epoint sorğusu alınmadı.";
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: "FAILED",
        metadata: JSON.stringify({
          gateway: "epoint",
          flow: "wallet-deposit",
          createdAt,
          error: message,
        }),
      },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!checkoutSucceeded(checkout)) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: "FAILED",
        metadata: JSON.stringify({
          gateway: "epoint",
          flow: "wallet-deposit",
          createdAt,
          epoint: checkout,
        }),
      },
    });

    return NextResponse.json(
      { error: checkout.message ?? "Epoint ödəniş linki yaratmadı.", epoint: checkout },
      { status: 502 },
    );
  }

  await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      metadata: JSON.stringify({
        gateway: "epoint",
        flow: "wallet-deposit",
        createdAt,
        epoint: {
          transaction: checkout.transaction ?? null,
          status: checkout.status ?? null,
        },
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    orderId: tx.id,
    redirectUrl: checkout.redirect_url,
  });
}
