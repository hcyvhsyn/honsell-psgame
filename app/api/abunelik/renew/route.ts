import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import { isAbunelikEnabled, resolveVerifiedPhone } from "@/lib/abunelik/session";
import { CrmRenewalError, quoteCrmRenewal } from "@/lib/crmRenewals";
import { CRM_RENEWAL_FLOW, type CrmRenewalPaymentMetadata } from "@/lib/crmRenewalCheckout";
import { EPOINT_CART_PAYMENT_TYPE } from "@/lib/epointCartCheckout";
import { createEpointCheckout, getEpointConfig } from "@/lib/epoint";
import { renewalCharge } from "@/lib/abunelik/charge";
import { consumeRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(req: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto ?? "https"}://${host}`.replace(/\/$/, "");
  return SITE_URL;
}

/** Lokal test: Epoint-ə getmədən ödəniş səhifəsini keç (callback `scripts/epointSimulateResult.ts` ilə). */
function epointMock(): boolean {
  return process.env.EPOINT_MOCK === "1" && process.env.NODE_ENV !== "production";
}

const QUOTE_ERRORS: Record<string, string> = {
  NOT_FOUND: "Abunəlik tapılmadı. Səhifəni yeniləyin.",
  OPEN_RENEWAL: "Bu abunəliyin yeniləməsi artıq emal olunur.",
  NOT_RENEWABLE: "Bu abunəlik saytdan yenilənə bilmir — bizə WhatsApp-da yazın.",
  MONTHS_UNAVAILABLE: "Seçdiyiniz müddət hazırda mövcud deyil. Səhifəni yeniləyin.",
};

/**
 * POST /api/abunelik/renew  { ref, months, expectedPriceAzn }
 * Qiymət server tərəfdə CRM-dən alınır (klientin məbləği yalnız "qiymət dəyişib" yoxlaması üçündür;
 * `expectedPriceAzn` haqqsız CRM qiymətidir). Kartdan CRM qiyməti + 3% xidmət haqqı tutulur (`renewalCharge`),
 * minimum 5 AZN — fərq ödənişdən sonra cüzdana yazılır (səbət qaydası).
 */
export async function POST(req: Request) {
  if (!isAbunelikEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const phone = await resolveVerifiedPhone();
  if (!phone) {
    return NextResponse.json({ error: "Nömrənizi WhatsApp kodu ilə təsdiqləyin.", code: "PHONE_UNVERIFIED" }, { status: 401 });
  }
  const user = await getCurrentUser();
  if (!user || user.id !== phone.uid) return NextResponse.json({ error: "Hesabınıza yenidən daxil olun.", code: "PHONE_UNVERIFIED" }, { status: 401 });
  if (user.disabled) return NextResponse.json({ error: "Bu hesab bloklanıb. Dəstək ilə əlaqə saxlayın." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { ref?: string; months?: number; expectedPriceAzn?: number } | null;
  const ref = String(body?.ref ?? "").trim();
  const months = Math.floor(Number(body?.months));
  if (!/^(slot|fam|si|ni|ps):[\w-]+$/.test(ref) || !Number.isFinite(months) || months < 1 || months > 24) {
    return NextResponse.json({ error: "Seçim düzgün deyil." }, { status: 400 });
  }

  const rl = await consumeRateLimit({ key: `abunelik-renew:${user.id}`, scope: "abunelik-renew", windowSeconds: 60 * 60, max: 15 });
  if (!rl.ok) return NextResponse.json({ error: "Çox sayda cəhd. Bir az sonra yenidən yoxlayın." }, { status: 429 });

  const open = await prisma.crmRenewalOrder.findFirst({ where: { phone: phone.e164, ref, status: "PENDING" }, select: { id: true } });
  if (open) return NextResponse.json({ error: QUOTE_ERRORS.OPEN_RENEWAL, code: "OPEN_RENEWAL" }, { status: 409 });

  let quote;
  try {
    quote = await quoteCrmRenewal({ phone: phone.e164, ref, months });
  } catch (e) {
    if (e instanceof CrmRenewalError && (e.status === 404 || e.status === 409)) {
      const code = e.code || (e.status === 404 ? "NOT_FOUND" : "NOT_RENEWABLE");
      return NextResponse.json({ error: QUOTE_ERRORS[code] ?? QUOTE_ERRORS.NOT_RENEWABLE, code }, { status: 409 });
    }
    console.error("[abunelik:renew] quote", e);
    return NextResponse.json({ error: "Abunəlik sistemi cavab vermir. Bir az sonra yenidən cəhd edin." }, { status: 503 });
  }

  const expected = Number(body?.expectedPriceAzn);
  if (Number.isFinite(expected) && Math.abs(expected - quote.priceAzn) > 0.009) {
    return NextResponse.json(
      { error: `Qiymət yeniləndi: ${quote.priceAzn.toFixed(2)} ₼. Yenidən təsdiqləyin.`, code: "PRICE_CHANGED", priceAzn: quote.priceAzn },
      { status: 409 },
    );
  }

  const config = getEpointConfig();
  if (!config && !epointMock()) {
    return NextResponse.json({ error: "Kartla ödəniş müvəqqəti əlçatmazdır." }, { status: 503 });
  }

  const { priceCents, serviceFeeCents, chargeCents, topUpCents } = renewalCharge(quote.priceAzn);
  const orderCode = `HON-${randomBytes(3).toString("hex").toUpperCase()}`;
  const metadata: CrmRenewalPaymentMetadata = {
    gateway: "epoint",
    flow: CRM_RENEWAL_FLOW,
    orderCode,
    createdAt: new Date().toISOString(),
    renewal: {
      ref,
      kind: quote.kind,
      title: quote.title,
      months: quote.months,
      priceCents,
      serviceFeeCents,
      topUpCents,
      chargeCents,
      phoneE164: phone.e164,
      quotedAt: new Date().toISOString(),
      newEndDate: quote.newEndDate,
    },
  };

  const payment = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: EPOINT_CART_PAYMENT_TYPE,
      status: "PENDING",
      amountAznCents: chargeCents,
      orderCode,
      metadata: JSON.stringify(metadata),
    },
    select: { id: true },
  });

  const origin = requestOrigin(req);
  const successUrl = `${origin}/profile/abunelikler?odenis=ugurlu&o=${encodeURIComponent(payment.id)}`;
  const errorUrl = `${origin}/profile/abunelikler?odenis=xeta&o=${encodeURIComponent(payment.id)}`;

  if (epointMock()) {
    await prisma.transaction.update({
      where: { id: payment.id },
      data: { metadata: JSON.stringify({ ...metadata, epoint: { transaction: `mock-${payment.id}`, status: "success", mock: true } }) },
    });
    return NextResponse.json({ ok: true, orderId: payment.id, orderCode, redirectUrl: successUrl });
  }

  const amountAzn = Number((chargeCents / 100).toFixed(2));
  let checkout;
  try {
    checkout = await createEpointCheckout(
      {
        public_key: config!.publicKey,
        amount: amountAzn,
        currency: "AZN",
        language: "az",
        order_id: payment.id,
        description: `Honsell abunəlik yeniləməsi ${orderCode}: ${quote.title} — ${quote.months} ay`,
        success_redirect_url: successUrl,
        error_redirect_url: errorUrl,
        result_url: `${origin}/result`,
      },
      config!.privateKey,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Epoint sorğusu alınmadı.";
    await prisma.transaction.update({
      where: { id: payment.id },
      data: { status: "FAILED", metadata: JSON.stringify({ ...metadata, error: message }) },
    });
    return NextResponse.json({ error: "Ödəniş səhifəsi açılmadı. Yenidən cəhd edin." }, { status: 502 });
  }

  const ok =
    String(checkout.status ?? "").toLowerCase() === "success" &&
    typeof checkout.redirect_url === "string" &&
    checkout.redirect_url.length > 0;
  if (!ok) {
    await prisma.transaction.update({
      where: { id: payment.id },
      data: { status: "FAILED", metadata: JSON.stringify({ ...metadata, epoint: checkout }) },
    });
    return NextResponse.json({ error: checkout.message ?? "Ödəniş səhifəsi açılmadı." }, { status: 502 });
  }

  await prisma.transaction.update({
    where: { id: payment.id },
    data: {
      metadata: JSON.stringify({ ...metadata, epoint: { transaction: checkout.transaction ?? null, status: checkout.status ?? null } }),
    },
  });
  return NextResponse.json({ ok: true, orderId: payment.id, orderCode, redirectUrl: checkout.redirect_url });
}
