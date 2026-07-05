import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeToE164, sendWasenderText } from "@/lib/wasender";

export const runtime = "nodejs";

const INVITE_TTL_DAYS = 30;
const SUBSCRIPTION_TYPES = ["STREAMING", "PLATFORM"];

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://honsell.store").replace(/\/$/, "");
}

function inviteText(productTitle: string, url: string): string {
  return [
    `Salam! 👋`,
    ``,
    `Honsell Store-dan aldığın *${productTitle}* üçün rəyini bizimlə bölüş.`,
    `Bir neçə addımda tamamlanır və honsell.store hesabın da yaranır:`,
    ``,
    url,
  ].join("\n");
}

/**
 * Eyni telefonun DB-də saxlanan mümkün formatlarını qaytarır (E.164, ölkə kodsuz,
 * yerli 0-lı). İstifadəçi qeydiyyatda telefonu sərbəst formatda saxlaya bilir.
 */
function phoneCandidates(e164: string): string[] {
  const digits = e164.replace(/\D/g, ""); // məs. 994501234567
  const set = new Set<string>([e164, digits]);
  // AZ nömrələri: +994 XX XXXXXXX → yerli 0XX XXXXXXX və kodsuz XX XXXXXXX
  if (digits.startsWith("994") && digits.length >= 12) {
    const local = digits.slice(3); // 501234567
    set.add(local);
    set.add(`0${local}`);
  }
  return Array.from(set);
}

async function findCustomerByPhone(rawPhone: string) {
  const e164 = normalizeToE164(rawPhone);
  if (!e164) return null;
  return prisma.user.findFirst({
    where: { phone: { in: phoneCandidates(e164) } },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function GET(req: Request) {
  await requireAdmin();

  const url = new URL(req.url);
  const lookupPhone = url.searchParams.get("phone");
  if (lookupPhone !== null) {
    const customer = await findCustomerByPhone(lookupPhone);
    return NextResponse.json({ customer });
  }

  const items = await prisma.whatsappReviewInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      token: true,
      phone: true,
      productTitle: true,
      status: true,
      name: true,
      reviewText: true,
      rating: true,
      userId: true,
      testimonialId: true,
      usedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  // Admin cavabları Testimonial-da saxlanılır — dəvətin testimonialId-si ilə birləşdir.
  const testimonialIds = items
    .map((i) => i.testimonialId)
    .filter((id): id is string => Boolean(id));
  const replies = testimonialIds.length
    ? await prisma.testimonial.findMany({
        where: { id: { in: testimonialIds } },
        select: { id: true, adminReply: true, adminReplyImageUrl: true },
      })
    : [];
  const replyById = new Map(replies.map((r) => [r.id, r]));

  return NextResponse.json({
    items: items.map((i) => {
      const reply = i.testimonialId ? replyById.get(i.testimonialId) : null;
      return {
        ...i,
        url: `${baseUrl()}/rey/${i.token}`,
        adminReply: reply?.adminReply ?? null,
        adminReplyImageUrl: reply?.adminReplyImageUrl ?? null,
        usedAt: i.usedAt?.toISOString() ?? null,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      };
    }),
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

  const serviceProductId = body.serviceProductId ? String(body.serviceProductId).trim() : "";
  const product = serviceProductId
    ? await prisma.serviceProduct.findFirst({
        where: { id: serviceProductId, isActive: true, type: { in: SUBSCRIPTION_TYPES } },
        select: { id: true, title: true, priceAznCents: true, type: true },
      })
    : null;
  if (!product) {
    return NextResponse.json({ error: "Məhsul tapılmadı və ya aktiv deyil." }, { status: 400 });
  }

  const customer = await findCustomerByPhone(phone);

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Mövcud müştəri: satışı dərhal qeyd et (real SERVICE_PURCHASE) ki, homepage
  // güvən zöləsi + bestsellers sayı artsın. walletBalance toxunulmur.
  let transactionId: string | null = null;
  if (customer) {
    const txn = await prisma.transaction.create({
      data: {
        userId: customer.id,
        type: "SERVICE_PURCHASE",
        status: "SUCCESS",
        serviceProductId: product.id,
        amountAznCents: -product.priceAznCents,
        metadata: "whatsapp-review-invite",
      },
      select: { id: true },
    });
    transactionId = txn.id;
  }

  const invite = await prisma.whatsappReviewInvite.create({
    data: {
      token,
      phone,
      productTitle: product.title,
      platform: product.type === "PLATFORM" ? "MUSIC" : "STREAMING",
      serviceProductId: product.id,
      priceAznCents: product.priceAznCents,
      userId: customer?.id ?? null,
      transactionId,
      expiresAt,
    },
    select: { id: true, token: true, phone: true, productTitle: true, status: true, createdAt: true },
  });

  if (transactionId) revalidateTag("home");

  const url = `${baseUrl()}/rey/${token}`;

  let whatsappSent = false;
  let whatsappError: string | null = null;
  try {
    const result = await sendWasenderText({ to: phone, text: inviteText(product.title, url) });
    whatsappSent = result.ok;
    if (!result.ok) whatsappError = result.error;
  } catch (err) {
    whatsappError = err instanceof Error ? err.message : "network error";
  }

  return NextResponse.json({
    invite: {
      ...invite,
      url,
      usedAt: null,
      expiresAt: expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    },
    customer,
    whatsappSent,
    whatsappError,
  });
}
