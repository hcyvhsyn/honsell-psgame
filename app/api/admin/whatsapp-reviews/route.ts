import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeToE164, sendWasenderText } from "@/lib/wasender";
import { findCustomerByPhone } from "@/lib/whatsappCustomerLookup";
import { isReviewCategoryOverride } from "@/lib/reviewCategoryShared";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { serviceProductLabel } from "@/lib/serviceProductLabel";
import {
  REVIEW_SERVICE_TYPES,
  derivePlatform,
  reviewSaleTxnData,
  type InviteProduct,
} from "@/lib/whatsappReviewProducts";

export const runtime = "nodejs";

const INVITE_TTL_DAYS = 30;

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

  // Seçim: oyun (`Game`) və ya xidmət (`ServiceProduct`) qarışıq ola bilər.
  // Yeni client `items: [{kind,id}]` göndərir; köhnə `serviceProductIds` fallback.
  type RawItem = { kind: "GAME" | "SERVICE"; id: string };
  const rawItems: RawItem[] = Array.isArray(body.items)
    ? body.items
        .map((v: unknown): RawItem | null => {
          const o = v as { kind?: unknown; id?: unknown };
          const id = typeof o?.id === "string" ? o.id.trim() : "";
          if (!id) return null;
          return { kind: o?.kind === "GAME" ? "GAME" : "SERVICE", id };
        })
        .filter((v: RawItem | null): v is RawItem => v !== null)
    : Array.isArray(body.serviceProductIds)
      ? body.serviceProductIds
          .map((v: unknown) => String(v).trim())
          .filter(Boolean)
          .map((id: string): RawItem => ({ kind: "SERVICE", id }))
      : [];

  // Təkrarları at (kind+id üzrə), seçim sırasını qoru.
  const seen = new Set<string>();
  const items = rawItems.filter((it) => {
    const key = `${it.kind}:${it.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (items.length === 0) {
    return NextResponse.json({ error: "Ən azı bir məhsul seçin." }, { status: 400 });
  }

  const gameIds = items.filter((i) => i.kind === "GAME").map((i) => i.id);
  const serviceIds = items.filter((i) => i.kind === "SERVICE").map((i) => i.id);

  const [gameRows, serviceRows, settings] = await Promise.all([
    gameIds.length
      ? prisma.game.findMany({
          where: { id: { in: gameIds }, isActive: true },
          select: {
            id: true,
            title: true,
            store: true,
            priceTryCents: true,
            discountTryCents: true,
            discountEndAt: true,
            priceUsdCents: true,
            discountUsdCents: true,
          },
        })
      : Promise.resolve([]),
    serviceIds.length
      ? prisma.serviceProduct.findMany({
          where: { id: { in: serviceIds }, isActive: true, type: { in: [...REVIEW_SERVICE_TYPES] } },
          select: { id: true, title: true, priceAznCents: true, type: true, metadata: true },
        })
      : Promise.resolve([]),
    getSettings(),
  ]);

  const gameById = new Map(gameRows.map((g) => [g.id, g]));
  const serviceById = new Map(serviceRows.map((s) => [s.id, s]));

  // Qiymət və başlıq server-də hesablanır (client-ə etibar edilmir), seçim sırası qorunur.
  const products: (InviteProduct & { store: string | null })[] = [];
  for (const it of items) {
    if (it.kind === "GAME") {
      const g = gameById.get(it.id);
      if (!g) {
        return NextResponse.json(
          { error: "Bəzi oyunlar tapılmadı və ya aktiv deyil." },
          { status: 400 }
        );
      }
      const priceAznCents = Math.round(computeDisplayPrice(g, settings).finalAzn * 100);
      products.push({
        kind: "GAME",
        id: g.id,
        title: g.title,
        priceAznCents,
        type: "GAME",
        store: g.store,
      });
    } else {
      const s = serviceById.get(it.id);
      if (!s) {
        return NextResponse.json(
          { error: "Bəzi məhsullar tapılmadı və ya aktiv deyil." },
          { status: 400 }
        );
      }
      products.push({
        kind: "SERVICE",
        id: s.id,
        title: serviceProductLabel(s.title, s.metadata),
        priceAznCents: s.priceAznCents,
        type: s.type,
        store: null,
      });
    }
  }

  const combinedTitle = products.map((p) => p.title).join(" + ");
  const totalPriceCents = products.reduce((sum, p) => sum + p.priceAznCents, 0);
  // Rəy kateqoriyası: admin əl ilə seçibsə onu götür, əks halda ilk məhsuldan çıxar.
  const first = products[0];
  const platform = isReviewCategoryOverride(body.platform)
    ? body.platform
    : derivePlatform(first.kind, first.type, first.store);

  // İlk xidmət SKU-su (backward-compat sütunu); yoxdursa null (yalnız oyunlar seçilib).
  const firstServiceId = products.find((p) => p.kind === "SERVICE")?.id ?? null;

  const customer = await findCustomerByPhone(phone);

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Mövcud müştəri: hər məhsul üçün ayrı satış dərhal qeyd et ki, homepage güvən
  // zöləsi + bestsellers sayı artsın. Oyun → PURCHASE, xidmət → SERVICE_PURCHASE.
  // walletBalance toxunulmur.
  let firstTxnId: string | null = null;
  let salesRecorded = false;
  if (customer) {
    for (const p of products) {
      const txn = await prisma.transaction.create({
        data: reviewSaleTxnData(customer.id, p),
        select: { id: true },
      });
      if (!firstTxnId) firstTxnId = txn.id;
    }
    salesRecorded = true;
  }

  const invite = await prisma.whatsappReviewInvite.create({
    data: {
      token,
      phone,
      productTitle: combinedTitle,
      platform,
      serviceProductId: firstServiceId,
      priceAznCents: totalPriceCents,
      products,
      salesRecorded,
      userId: customer?.id ?? null,
      transactionId: firstTxnId,
      expiresAt,
    },
    select: { id: true, token: true, phone: true, productTitle: true, status: true, createdAt: true },
  });

  if (salesRecorded) revalidateTag("home");

  const url = `${baseUrl()}/rey/${token}`;

  let whatsappSent = false;
  let whatsappError: string | null = null;
  try {
    const result = await sendWasenderText({ to: phone, text: inviteText(combinedTitle, url) });
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
