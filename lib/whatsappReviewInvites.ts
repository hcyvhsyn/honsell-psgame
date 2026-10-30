/**
 * WhatsApp rəy dəvətinin yaradılması — TƏK mənbə.
 *
 * ÜÇ çağırış yeri var:
 *   • admin paneli  → app/api/admin/whatsapp-reviews/route.ts (POST)
 *   • CRM (partner) → app/api/partner/review-invites/route.ts (POST) — bank modalı
 *   • CRM (partner) → app/api/partner/review-links/route.ts (POST) — `offerReviewLink`:
 *     ödəniş təsdiqi mesajının SONUNA əlavə olunan link (mağaza mesaj göndərmir)
 *
 * Qiymət və başlıq HƏMİŞƏ serverdə yenidən hesablanır — client (və CRM) yalnız
 * məhsul id-sini göndərir. Beləcə xarici sistem qiymət uydura bilmir.
 * İstisna: məhsulsuz dəvət (`productTitle`, `items` boş) — satış qeydi YARANMIR,
 * ona görə qiymət də yoxdur.
 */

import crypto from "node:crypto";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
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

const INVITE_TTL_DAYS = 30;

export type ReviewInviteRawItem = { kind: "GAME" | "SERVICE"; id: string };

export type CreateReviewInviteInput = {
  phone: unknown;
  /** Yeni format. Köhnə admin client-i `serviceProductIds` göndərirdi. */
  items?: unknown;
  serviceProductIds?: unknown;
  platform?: unknown;
  /**
   * Xarici sistemin öz açarı (məs. `crm:cardTransaction:<id>`). Verilibsə dəvət
   * idempotent olur — eyni ref ilə ikinci sorğu YENİ satış qeydi yaratmır.
   */
  externalRef?: unknown;
  /**
   * Məhsulsuz dəvət: `items` boşdursa bu başlıq göstərilir (məs. CRM-dən
   * "Netflix — 1 ay"). Mağaza kataloqunda məhsul olmadığı üçün satış qeydi
   * yaranmır; kateqoriya `platform`-dan, o da yoxdursa GENERAL.
   */
  productTitle?: unknown;
  /** false → WhatsApp göndərilmir, yalnız link qaytarılır (çağıran öz mesajına əlavə edir). */
  sendWhatsapp?: boolean;
};

export type CreateReviewInviteResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      alreadyExists: boolean;
      invite: {
        id: string;
        token: string;
        phone: string;
        productTitle: string;
        status: string;
        url: string;
        usedAt: string | null;
        expiresAt: string;
        createdAt: string;
      };
      customer: { id: string; name: string | null; email: string; phone: string | null } | null;
      whatsappSent: boolean;
      whatsappError: string | null;
    };

export function reviewInviteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://honsell.site").replace(/\/$/, "");
}

export function reviewInviteText(productTitle: string, url: string): string {
  return [
    `Salam! 👋`,
    ``,
    `Honsell Store-dan aldığın *${productTitle}* üçün rəyini bizimlə bölüş.`,
    `Bir neçə addımda tamamlanır və honsell.site hesabın da yaranır:`,
    ``,
    url,
  ].join("\n");
}

/** Gövdədən `items` çıxarır; köhnə `serviceProductIds` formatını da qəbul edir. */
function parseItems(input: CreateReviewInviteInput): ReviewInviteRawItem[] {
  const raw: ReviewInviteRawItem[] = Array.isArray(input.items)
    ? input.items
        .map((v: unknown): ReviewInviteRawItem | null => {
          const o = v as { kind?: unknown; id?: unknown };
          const id = typeof o?.id === "string" ? o.id.trim() : "";
          if (!id) return null;
          return { kind: o?.kind === "GAME" ? "GAME" : "SERVICE", id };
        })
        .filter((v: ReviewInviteRawItem | null): v is ReviewInviteRawItem => v !== null)
    : Array.isArray(input.serviceProductIds)
      ? input.serviceProductIds
          .map((v: unknown) => String(v).trim())
          .filter(Boolean)
          .map((id: string): ReviewInviteRawItem => ({ kind: "SERVICE", id }))
      : [];

  // Təkrarları at (kind+id üzrə), seçim sırasını qoru.
  const seen = new Set<string>();
  return raw.filter((it) => {
    const key = `${it.kind}:${it.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function createWhatsappReviewInvite(
  input: CreateReviewInviteInput
): Promise<CreateReviewInviteResult> {
  const phone = normalizeToE164(input.phone != null ? String(input.phone) : "");
  if (!phone) {
    return {
      ok: false,
      status: 400,
      error: "Telefon nömrəsi düzgün deyil (məs: +994501234567).",
    };
  }

  const externalRef =
    typeof input.externalRef === "string" && input.externalRef.trim()
      ? input.externalRef.trim().slice(0, 200)
      : null;

  // İdempotentlik: eyni xarici açarla dəvət varsa YENİSİNİ yaratma. Mesajın
  // təkrarı zərərsizdir, amma satış `Transaction` sətirlərinin təkrarı anasayfa
  // statistikasını şişirdir.
  if (externalRef) {
    const existing = await prisma.whatsappReviewInvite.findUnique({
      where: { externalRef },
      select: {
        id: true,
        token: true,
        phone: true,
        productTitle: true,
        status: true,
        usedAt: true,
        expiresAt: true,
        createdAt: true,
        userId: true,
      },
    });
    if (existing) {
      const customer = existing.userId
        ? await prisma.user.findUnique({
            where: { id: existing.userId },
            select: { id: true, name: true, email: true, phone: true },
          })
        : null;
      return {
        ok: true,
        alreadyExists: true,
        invite: {
          id: existing.id,
          token: existing.token,
          phone: existing.phone,
          productTitle: existing.productTitle,
          status: existing.status,
          url: `${reviewInviteBaseUrl()}/rey/${existing.token}`,
          usedAt: existing.usedAt?.toISOString() ?? null,
          expiresAt: existing.expiresAt.toISOString(),
          createdAt: existing.createdAt.toISOString(),
        },
        customer,
        whatsappSent: false,
        whatsappError: null,
      };
    }
  }

  const items = parseItems(input);
  const freeTitle =
    typeof input.productTitle === "string" ? input.productTitle.trim().slice(0, 200) : "";
  if (items.length === 0 && !freeTitle) {
    return { ok: false, status: 400, error: "Ən azı bir məhsul seçin." };
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
            customMarginPct: true,
            customPriceAznCents: true,
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
        return { ok: false, status: 400, error: "Bəzi oyunlar tapılmadı və ya aktiv deyil." };
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
        return { ok: false, status: 400, error: "Bəzi məhsullar tapılmadı və ya aktiv deyil." };
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

  const combinedTitle = products.length
    ? products.map((p) => p.title).join(" + ")
    : freeTitle;
  const totalPriceCents = products.length
    ? products.reduce((sum, p) => sum + p.priceAznCents, 0)
    : null;
  // Rəy kateqoriyası: admin əl ilə seçibsə onu götür, əks halda ilk məhsuldan çıxar.
  const first = products[0];
  const platform = isReviewCategoryOverride(input.platform)
    ? input.platform
    : first
      ? derivePlatform(first.kind, first.type, first.store)
      : "GENERAL";

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
  if (customer && products.length > 0) {
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
      externalRef,
      expiresAt,
    },
    select: { id: true, token: true, phone: true, productTitle: true, status: true, createdAt: true },
  });

  if (salesRecorded) revalidateTag("home");

  const url = `${reviewInviteBaseUrl()}/rey/${token}`;

  let whatsappSent = false;
  let whatsappError: string | null = null;
  if (input.sendWhatsapp !== false) {
    try {
      const result = await sendWasenderText({ to: phone, text: reviewInviteText(combinedTitle, url) });
      whatsappSent = result.ok;
      if (!result.ok) whatsappError = result.error;
    } catch (err) {
      whatsappError = err instanceof Error ? err.message : "network error";
    }
  }

  return {
    ok: true,
    alreadyExists: false,
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
  };
}

/** Eyni nömrəyə avtomatik link arası — müştəri rəy yazmayıbsa 30 gündə bir. */
const REVIEW_LINK_COOLDOWN_DAYS = 30;

export type ReviewLinkSkipReason = "PHONE_INVALID" | "ALREADY_REVIEWED" | "RECENTLY_INVITED";

export type OfferReviewLinkResult =
  | { ok: false; status: number; error: string }
  | { ok: true; url: null; skipped: ReviewLinkSkipReason }
  | { ok: true; url: string; skipped: null; inviteId: string; alreadyExists: boolean };

/**
 * Ödəniş təsdiqi mesajının sonuna əlavə olunacaq rəy linki. Mağaza mesaj
 * GÖNDƏRMİR — linki çağırana (CRM) qaytarır.
 *
 * Qayda: müştəri (telefon üzrə) artıq rəy yazıbsa link heç vaxt verilmir; yazmayıbsa
 * son dəvətdən 30 gün keçməyincə yenisi verilmir. Admin panelindən əl ilə göndərilən
 * dəvətlər də sayılır — eyni cədvəldir.
 *
 * `externalRef` ilə təkrar sorğu (retry) mövcud linki qaytarır, limitə düşmür —
 * yoxsa ilk cəhddə yaranmış dəvət ikinci cəhdi "RECENTLY_INVITED" ilə bloklayardı.
 */
export async function offerReviewLink(
  input: Omit<CreateReviewInviteInput, "sendWhatsapp">
): Promise<OfferReviewLinkResult> {
  const phone = normalizeToE164(input.phone != null ? String(input.phone) : "");
  if (!phone) return { ok: true, url: null, skipped: "PHONE_INVALID" };

  const externalRef =
    typeof input.externalRef === "string" && input.externalRef.trim()
      ? input.externalRef.trim().slice(0, 200)
      : null;

  if (externalRef) {
    const existing = await prisma.whatsappReviewInvite.findUnique({
      where: { externalRef },
      select: { id: true, token: true, status: true, expiresAt: true },
    });
    if (existing) {
      if (existing.status === "SUBMITTED") return { ok: true, url: null, skipped: "ALREADY_REVIEWED" };
      if (existing.expiresAt.getTime() <= Date.now()) {
        return { ok: true, url: null, skipped: "RECENTLY_INVITED" };
      }
      return {
        ok: true,
        url: `${reviewInviteBaseUrl()}/rey/${existing.token}`,
        skipped: null,
        inviteId: existing.id,
        alreadyExists: true,
      };
    }
  }

  const since = new Date(Date.now() - REVIEW_LINK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const blocker = await prisma.whatsappReviewInvite.findFirst({
    where: { phone, OR: [{ status: "SUBMITTED" }, { createdAt: { gte: since } }] },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  if (blocker) {
    return {
      ok: true,
      url: null,
      skipped: blocker.status === "SUBMITTED" ? "ALREADY_REVIEWED" : "RECENTLY_INVITED",
    };
  }

  const result = await createWhatsappReviewInvite({ ...input, phone, sendWhatsapp: false });
  if (!result.ok) return result;
  return {
    ok: true,
    url: result.invite.url,
    skipped: null,
    inviteId: result.invite.id,
    alreadyExists: result.alreadyExists,
  };
}
