import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeToE164, sendWasenderText } from "@/lib/wasender";
import { findCustomerByPhone } from "@/lib/whatsappCustomerLookup";

export const runtime = "nodejs";

const INVITE_TTL_DAYS = 30;
const SUBSCRIPTION_TYPES = ["STREAMING", "PLATFORM"];

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://honsell.store").replace(/\/$/, "");
}

function winbackText(productTitle: string, url: string): string {
  return [
    `Salam! 👋`,
    ``,
    `Honsell Store-dan aldığın *${productTitle}* abunəliyi bitib.`,
    `Davam etmədiyini gördük — bizə çox kömək olar: niyə davam etmədin?`,
    `Bir neçə saniyəlik sualdır, cavabın xidmətimizi yaxşılaşdırmağa kömək edir 🙏`,
    ``,
    url,
  ].join("\n");
}

export async function GET(req: Request) {
  await requireAdmin();

  const url = new URL(req.url);
  const lookupPhone = url.searchParams.get("phone");
  if (lookupPhone !== null) {
    const customer = await findCustomerByPhone(lookupPhone);
    return NextResponse.json({ customer });
  }

  const items = await prisma.whatsappWinbackInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      token: true,
      phone: true,
      productTitle: true,
      status: true,
      reason: true,
      reasonText: true,
      userId: true,
      submittedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    items: items.map((i) => ({
      ...i,
      url: `${baseUrl()}/niye/${i.token}`,
      submittedAt: i.submittedAt?.toISOString() ?? null,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const phone = normalizeToE164(body.phone != null ? String(body.phone) : "");
  if (!phone) {
    return NextResponse.json(
      { error: "Telefon nömrəsi düzgün deyil (məs: +994501234567)." },
      { status: 400 }
    );
  }

  // Bir və ya bir neçə məhsul seçilə bilər (müştəri eyni anda birdən çox almışdı).
  const rawIds: string[] = Array.isArray(body.serviceProductIds)
    ? body.serviceProductIds.map((v: unknown) => String(v).trim()).filter(Boolean)
    : body.serviceProductId
      ? [String(body.serviceProductId).trim()]
      : [];
  const uniqueIds = Array.from(new Set(rawIds));
  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: "Ən azı bir məhsul seçin." }, { status: 400 });
  }

  const found = await prisma.serviceProduct.findMany({
    where: { id: { in: uniqueIds }, isActive: true, type: { in: SUBSCRIPTION_TYPES } },
    select: { id: true, title: true, priceAznCents: true, type: true },
  });
  if (found.length !== uniqueIds.length) {
    return NextResponse.json(
      { error: "Bəzi məhsullar tapılmadı və ya aktiv deyil." },
      { status: 400 }
    );
  }
  // Seçim sırasını qoru.
  const products = uniqueIds.map((id) => found.find((p) => p.id === id)!);
  const combinedTitle = products.map((p) => p.title).join(" + ");

  const customer = await findCustomerByPhone(phone);

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.whatsappWinbackInvite.create({
    data: {
      token,
      phone,
      productTitle: combinedTitle,
      serviceProductId: products[0].id,
      products,
      userId: customer?.id ?? null,
      expiresAt,
    },
    select: {
      id: true,
      token: true,
      phone: true,
      productTitle: true,
      status: true,
      createdAt: true,
    },
  });

  const url = `${baseUrl()}/niye/${token}`;

  let whatsappSent = false;
  let whatsappError: string | null = null;
  try {
    const result = await sendWasenderText({ to: phone, text: winbackText(combinedTitle, url) });
    whatsappSent = result.ok;
    if (!result.ok) whatsappError = result.error;
  } catch (err) {
    whatsappError = err instanceof Error ? err.message : "network error";
  }

  return NextResponse.json({
    invite: {
      ...invite,
      url,
      reason: null,
      reasonText: null,
      userId: customer?.id ?? null,
      submittedAt: null,
      expiresAt: expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    },
    customer,
    whatsappSent,
    whatsappError,
  });
}
