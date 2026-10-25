import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import {
  computeDisplayPrice,
  getSettings,
  tryCentsToCostAzn,
} from "@/lib/pricing";
import { applyFlashDeal, getFlashDealOverrides } from "@/lib/flashDeals";
import { resolveServiceBundlesForCart } from "@/lib/serviceBundles";
import { getEffectiveTier } from "@/lib/customerTier";
import {
  applyCashbackToBalance,
  getLifetimeSpendAznForLoyalty,
} from "@/lib/loyaltyCashback";
import { sendAdminOrderNotification } from "@/lib/resend";
import {
  clearReviewAffiliateCookie,
  readReviewAffiliateCookie,
} from "@/lib/reviewAffiliate";
import {
  recordPurchaseSpend,
  recordSuccessfulInvite,
} from "@/lib/referralCycle";
import { awardStreamingReferralCommission } from "@/lib/streamingReferral";
import { streamingUsesCustomerEmail } from "@/lib/streamingCart";
import {
  EPOINT_CART_PAYMENT_TYPE,
  type EpointCartLineSnapshot,
  type EpointCartPaymentMetadata,
} from "@/lib/epointCartCheckout";
import {
  createEpointCheckout,
  createEpointWidget,
  createEpointInstallment,
  getEpointConfig,
  type EpointCheckoutResponse,
  type EpointWidgetResponse,
} from "@/lib/epoint";
import {
  HONSELL_GIFT_CARD_SERVICE_TYPE,
  HONSELL_GIFT_CARD_VALIDITY_DAYS,
} from "@/lib/honsellGiftCard";
import {
  generateUniqueProductGiftCode,
  formatProductGiftCode,
  PRODUCT_GIFT_VALIDITY_DAYS,
  PRODUCT_GIFT_CLAIM_PATH,
} from "@/lib/productGift";
import { sendProductGiftCodeEmail } from "@/lib/resend";
import { EPOINT_MIN_CHARGE_AZN_CENTS, meetsMinOrder, minOrderMessage } from "@/lib/cartLimits";
import { getInstallmentOffer } from "@/lib/installments";
import {
  installmentAvailable,
  installmentChargeCents,
  type InstallmentCard,
  type InstallmentOption,
} from "@/lib/installmentsShared";
import { sellableGameWhere, sellableServiceWhere } from "@/lib/storeScope";
import { pushSpotifyOrdersToCrm } from "@/lib/crmSpotify";
import { validateAccountPassword } from "@/lib/accountPasswordRules";
import {
  validatePromoForOrder,
  applyPromoRedemption,
  type PromoScopeItem,
} from "@/lib/promoCodes";
import { grantCheckoutBonuses, generateUniqueBonusPromoCode } from "@/lib/checkoutBonuses";
import {
  recordOrderAttribution,
  resolveAttribution,
  stampOrderCode,
} from "@/lib/attribution";
import type { PromoCode } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

type AccountCreationBody = {
  fullName: string;
  birthDate: string;
  email: string;
  password: string;
};

type StreamingBody = {
  gmail: string;
  /** YouTube Premium kimi xidmətlərdə müştəri öz hesabının şifrəsini də verir. */
  password?: string;
};

/** Çoxhesablı PLATFORM planları (Spotify Duo/Family) üçün bir hesab cütü. */
type PlatformAccount = {
  email: string;
  password: string;
};

type CartLinePayload = {
  id: string;
  qty: number;
  accountCreation?: unknown;
  streaming?: unknown;
  /**
   * Xidmət dəsti sətrində hər üzvün müştəri məlumatı, `serviceProductId` ilə
   * açarlanır. Dəst səbətdə tək sətirdir, amma içindəki Spotify öz hesab
   * cütlərini, Netflix isə öz e-poçtunu tələb edə bilər.
   */
  serviceBundle?: Record<string, unknown>;
  /** Bu sətir dostuna HƏDİYYƏ olaraq alınır — çatdırılma hesabı tələb olunmur,
   *  ödənişdən sonra hər nüsxə üçün 11 simvollu kod yaranır. */
  isGift?: boolean;
  giftMessage?: string;
};

/**
 * Xidmət dəstindən "açılmış" sətir. Dəst üzvləri ADİ xidmət payload-ları kimi
 * emal olunur (per-type validasiya, fulfillment, komissiya dəyişmir) — yeganə
 * fərq `unitListCents`-in dəst qiyməti ilə əvəzlənməsi və damğadır.
 */
type ExpandedPayload = CartLinePayload & {
  bundleRef?: { bundleId: string; bundleTitle: string; unitListCents: number };
};

function splitFullName(full: string): { firstName: string; lastName: string } {
  const t = full.trim().replace(/\s+/g, " ");
  if (!t) return { firstName: "?", lastName: "-" };
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "-" };
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() || "-" };
}

function parseStreamingBody(
  raw: unknown,
  opts: { allowAnyEmail?: boolean; emailLabel?: string } = {},
):
  | { ok: true; value: StreamingBody }
  | { ok: false; error: string } {
  const emailLabel = opts.emailLabel ?? "Gmail ünvanı";
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: `Xidmət üçün ${emailLabel} tələb olunur.` };
  }
  const o = raw as Record<string, unknown>;
  const gmail = typeof o.gmail === "string" ? o.gmail.trim().toLowerCase() : "";
  const regex = opts.allowAnyEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    : /^[^\s@]+@gmail\.com$/;
  if (!gmail || !regex.test(gmail)) {
    const hint = opts.allowAnyEmail ? "" : " (@gmail.com)";
    return { ok: false, error: `Etibarlı ${emailLabel}${hint} tələb olunur.` };
  }
  const password = typeof o.password === "string" ? o.password : "";
  return {
    ok: true,
    value: password ? { gmail, password } : { gmail },
  };
}

/**
 * Çoxhesablı PLATFORM planları (Spotify Duo/Family) üçün `streaming.accounts`
 * massivini validasiya edir: tam olaraq `slots` ədəd email+şifrə cütü, hər email
 * etibarlı, hər şifrə ən az 4 simvol.
 */
function parsePlatformAccounts(
  raw: unknown,
  slots: number,
):
  | { ok: true; value: PlatformAccount[] }
  | { ok: false; error: string } {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const rawAccounts = o && Array.isArray(o.accounts) ? o.accounts : null;
  if (!rawAccounts || rawAccounts.length !== slots) {
    return {
      ok: false,
      error: `Bu plan üçün ${slots} hesab (email və şifrə) tələb olunur.`,
    };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const value: PlatformAccount[] = [];
  for (let i = 0; i < rawAccounts.length; i++) {
    const a = rawAccounts[i] as Record<string, unknown> | null;
    const email = a && typeof a.email === "string" ? a.email.trim().toLowerCase() : "";
    const password = a && typeof a.password === "string" ? a.password : "";
    if (!email || !emailRegex.test(email)) {
      return { ok: false, error: `${i + 1}-ci hesab üçün etibarlı email tələb olunur.` };
    }
    if (!password || password.length < 4) {
      return { ok: false, error: `${i + 1}-ci hesab üçün şifrə tələb olunur (ən az 4 simvol).` };
    }
    value.push({ email, password });
  }
  return { ok: true, value };
}

function parseAccountCreationBody(raw: unknown):
  | { ok: true; value: AccountCreationBody }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Hesab açılışı üçün məlumatlar çatışmır." };
  }
  const o = raw as Record<string, unknown>;
  const fullName = typeof o.fullName === "string" ? o.fullName.trim() : "";
  const birthDate = typeof o.birthDate === "string" ? o.birthDate.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (!fullName) return { ok: false, error: "Ad və soyad tələb olunur." };
  if (!birthDate) return { ok: false, error: "Doğum tarixi tələb olunur." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Etibarlı e-poçt ünvanı tələb olunur." };
  }
  const pwErr = validateAccountPassword(password, [email]);
  if (pwErr) return { ok: false, error: pwErr };
  return { ok: true, value: { fullName, birthDate, email, password } };
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

/**
 * Atomic multi-item checkout. Body: { items [...], psnAccountId?, paymentSource?: "wallet" | "referral" }.
 *
 * PSN hesabı yalnız oyun / PS Plus / TRY (hədiyyə kartı) sətirləri varsa lazımdır.
 * Yalnız ACCOUNT_CREATION səbəti üçün psnAccountId göndərilməyə bilər.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawItems = Array.isArray(body.items) ? body.items : [];

  const payloads: CartLinePayload[] = rawItems
    .map((i: CartLinePayload) => ({
      id: typeof i?.id === "string" ? i.id : "",
      qty: Math.max(1, Math.min(20, Math.floor(Number(i?.qty) || 1))),
      accountCreation: i?.accountCreation,
      streaming: i?.streaming,
      serviceBundle:
        i?.serviceBundle && typeof i.serviceBundle === "object"
          ? (i.serviceBundle as Record<string, unknown>)
          : undefined,
      isGift: i?.isGift === true,
      giftMessage:
        typeof i?.giftMessage === "string" ? i.giftMessage.trim().slice(0, 300) : undefined,
    }))
    .filter((i: CartLinePayload) => i.id);

  if (payloads.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const paymentSource: "wallet" | "referral" =
    body.paymentSource === "referral" ? "referral" : "wallet";

  const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim() : "";

  const settings = await getSettings();
  const ids = payloads.map((i) => i.id);

  // Rəy affiliate cookie-si — alış SUCCESS olduqda rəy müəllifinə
  // komissiya yazılması üçün GAME alış metadata-sına stamp olunur.
  // Validasiya award vaxtı edilir; burada sadəcə dəyər saxlanır.
  const reviewAffiliateId = await readReviewAffiliateCookie();

  // ─── Xidmət dəstləri kataloq sorğusundan ƏVVƏL həll olunur ────────────────
  // Dəst id-si `ServiceProduct` cədvəlində deyil, üzvləri isə `services`
  // sorğusuna daxil olmalıdır — ona görə burada həll edilir.
  //
  // Satıla bilməyən dəst (deaktiv, vaxtı bitmiş, tərkibində deaktiv məhsul)
  // map-ə düşmür → aşağıda "artıq mövcud deyil" cavabı gedir. Köhnə səbətdəki
  // oyun PAKETİ sətri (silinib, 2026-10) də heç yerdə tapılmır → eyni cavab.
  const cartServiceBundles = await resolveServiceBundlesForCart(ids);

  // Xidmət dəsti N sintetik xidmət sətrinə açılır — beləcə Spotify-ın hesab
  // validasiyası, Netflix-in `deliveryMode` məntiqi, abunəlik yaradılması və admin
  // təsdiqi üçün AYRICA fulfillment budağı lazım gəlmir.
  const expandedPayloads: ExpandedPayload[] = [];
  for (const p of payloads) {
    const sb = cartServiceBundles.get(p.id);
    if (!sb) {
      expandedPayloads.push(p);
      continue;
    }
    // Dəst hədiyyə kimi göndərilmir (hər xidmət ayrıca çatdırılma tələb edərdi).
    if (p.isGift) continue;
    const memberDetails = p.serviceBundle ?? {};
    for (const item of sb.pricing.items) {
      expandedPayloads.push({
        id: item.serviceProductId,
        qty: 1,
        streaming: memberDetails[item.serviceProductId],
        bundleRef: {
          bundleId: sb.id,
          bundleTitle: sb.title,
          unitListCents: item.bundleAznCents,
        },
      });
    }
  }
  const expandedIds = expandedPayloads.map((p) => p.id);

  const [games, services] = await Promise.all([
    // PS-only rejimdə Epic oyunları və qeyri-PS xidmətlər burada süzülür →
    // aşağıdakı `resolvedIds` yoxlaması "artıq mövcud deyil" cavabı verir
    // (lib/storeScope.ts).
    prisma.game.findMany({
      where: { id: { in: ids }, isActive: true, ...sellableGameWhere() },
    }),
    prisma.serviceProduct.findMany({
      where: {
        id: { in: expandedIds },
        isActive: true,
        type: {
          in: [
            "PS_PLUS",
            "EA_PLAY",
            "TRY_BALANCE",
            "POINT_BLANK_TG",
            "ACCOUNT_CREATION",
            "STREAMING",
            "PLATFORM",
            HONSELL_GIFT_CARD_SERVICE_TYPE,
          ],
        },
        ...sellableServiceWhere(),
      },
    }),
  ]);

  type GameModel = (typeof games)[number];
  type ServiceModel = (typeof services)[number];

  /**
   * Bu sətir xidmət DƏSTİNDƏN açılıbsa dəstin id/başlığı.
   *
   * Bütün sətir növlərinə birdən şamil olunur (intersection) — çünki dəstə istənilən
   * xidmət tipi girə bilər və hər variantı ayrıca genişləndirmək lazım deyil.
   * Damğa `Transaction.metadata`-ya yazılır (admin sifarişləri dəst üzrə görsün)
   * və sətri kupon bazasından kənarlaşdırır.
   */
  type ServiceBundleStamp = {
    serviceBundleId?: string;
    serviceBundleTitle?: string;
  };

  type LineBase =
    | {
        kind: "GAME";
        game: GameModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
        unitSavingsCents: number;
      }
    | {
        kind: "TRY_BALANCE";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      }
    | {
        // Point Blank TG (e-pin kod stoku + manual fallback). TRY_BALANCE ilə
        // eyni kod-çatdırılma məntiqi, fəqət PSN hesabı tələb etmir.
        kind: "POINT_BLANK";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      }
    | {
        kind: "PS_PLUS";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      }
    | {
        kind: "EA_PLAY";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      }
    | {
        kind: "ACCOUNT_CREATION";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
        detail: AccountCreationBody;
      }
    | {
        kind: "STREAMING";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
        deliveryMode: "CODE" | "GMAIL";
        gmail?: string;
      }
    | {
        kind: "PLATFORM";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
        /** YouTube Premium üçün müştəri Gmail-i. */
        gmail?: string;
        /** YouTube Premium üçün müştəri Gmail şifrəsi. */
        password?: string;
        /** Çoxhesablı planlar (Spotify Duo/Family) üçün N hesab cütü. */
        accounts?: PlatformAccount[];
        /** Spotify: müştərinin mövcud hesabı var (true) yoxsa yeni açılmalı (false). */
        hasAccount?: boolean;
      }
    | {
        kind: "HONSELL_GIFT_CARD";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      };

  type LineUnion = LineBase & ServiceBundleStamp;

  // ⚠️ Bu, ÇOXLUQ yoxlamasıdır, say müqayisəsi DEYİL.
  //
  // Əvvəl `games.length + services.length !== payloads.length` yazılırdı və bu,
  // iki halda yalançı 409 verirdi: (a) səbətdə dəst olanda — onun id-si
  // heç bir kataloq cədvəlində yoxdur, (b) eyni məhsul həm adi, həm hədiyyə sətri
  // kimi olanda — Prisma `id: { in: ids }` nəticəsini dedupe edir, ona görə say
  // həmişə az çıxırdı.
  const resolvedIds = new Set<string>([
    ...games.map((g) => g.id),
    ...services.map((s) => s.id),
  ]);
  if (expandedPayloads.some((p) => !resolvedIds.has(p.id))) {
    return NextResponse.json(
      { error: "Some items are no longer available" },
      { status: 409 }
    );
  }

  // Hədiyyə sətirləri adi sətirlərdən AYRILIR: onlar per-type fulfillment
  // switch-inə düşmür (çatdırılmanı dost claim vaxtı seçir), yalnız məhsul
  // snapshot-u + məbləğ lazımdır. Ödəniş uğurlu olduqda hər nüsxə üçün bir
  // ProductGift (UNCLAIMED, kodlu) yaranır.
  type GiftLine = {
    productKind: string;
    gameId: string | null;
    serviceProductId: string | null;
    store: string | null;
    title: string;
    imageUrl: string | null;
    qty: number;
    unitListCents: number;
    giftMessage: string | null;
  };

  const lines: LineUnion[] = [];
  const giftLines: GiftLine[] = [];

  // "Fürsətləri qaçırma" kampaniya qiymətləri. Ana səhifədə göstərilən rəqəm
  // burada da tutulmalıdır — yoxsa vitrində bir qiymət, kassada başqa qiymət olar.
  const flashDeals = await getFlashDealOverrides(games.map((g) => g.id));

  // ⚠️ Dövr `payloads` üzərində DEYİL, `expandedPayloads` üzərindədir — xidmət
  // dəstləri artıq üzvlərinə açılıb və hər üzv adi xidmət sətri kimi keçir.
  for (const p of expandedPayloads) {
    const game = games.find((g) => g.id === p.id);

    // ─── HƏDİYYƏ sətri ────────────────────────────────────────────────────
    if (p.isGift) {
      if (game) {
        const price = applyFlashDeal(computeDisplayPrice(game, settings), flashDeals.get(game.id));
        giftLines.push({
          productKind: "GAME",
          gameId: game.id,
          serviceProductId: null,
          store: "PS",
          title: game.title,
          imageUrl: game.imageUrl,
          qty: p.qty,
          unitListCents: Math.round(price.finalAzn * 100),
          giftMessage: p.giftMessage ?? null,
        });
        continue;
      }
      const giftService = services.find((s) => s.id === p.id);
      if (giftService) {
        giftLines.push({
          productKind: giftService.type,
          gameId: null,
          serviceProductId: giftService.id,
          store: null,
          title: giftService.title,
          imageUrl: giftService.imageUrl,
          qty: p.qty,
          unitListCents: giftService.priceAznCents,
          giftMessage: p.giftMessage ?? null,
        });
      }
      continue;
    }

    if (game) {
      const price = applyFlashDeal(computeDisplayPrice(game, settings), flashDeals.get(game.id));
      const unitListCents = Math.round(price.finalAzn * 100);
      const unitSavingsCents =
        price.originalAzn != null
          ? Math.max(0, Math.round(price.originalAzn * 100) - unitListCents)
          : 0;
      const tryForCost =
        game.discountTryCents != null && game.discountTryCents < game.priceTryCents
          ? game.discountTryCents
          : game.priceTryCents;
      const unitCostCents = Math.round(tryCentsToCostAzn(tryForCost, settings) * 100);
      lines.push({
        kind: "GAME",
        game,
        qty: p.qty,
        unitListCents,
        unitCostCents,
        lineCents: unitListCents * p.qty,
        unitSavingsCents,
      });
      continue;
    }

    // Nə oyun, nə servis, nə də satıla bilən paket — məhsul aradan qalxıb
    // (deaktiv oyun, vaxtı bitmiş paket). Sətri sadəcə buraxırıq; aşağıdakı
    // "sifariş məbləği etibarsızdır" yoxlaması boş səbəti onsuz da tutur.
    const service = services.find((s) => s.id === p.id);
    if (!service) continue;

    // Xidmət dəstindən açılan sətir üçün qiymət DƏSTİN qiymətidir; adi sətirdə
    // xidmətin öz qiyməti qalır. Aşağıdakı bütün budaqlar bu iki dəyişəni işlədir
    // ki, `service.priceAznCents` təkrarı dəst qiymətini "sızdırmasın".
    const unitListCents = p.bundleRef?.unitListCents ?? service.priceAznCents;
    const bundleStamp: ServiceBundleStamp = p.bundleRef
      ? { serviceBundleId: p.bundleRef.bundleId, serviceBundleTitle: p.bundleRef.bundleTitle }
      : {};

    if (service.type === "TRY_BALANCE") {
      lines.push({
        kind: "TRY_BALANCE",
        service,
        qty: p.qty,
        unitListCents,
        unitCostCents: unitListCents,
        lineCents: unitListCents * p.qty,
        ...bundleStamp,
      });
      continue;
    }

    if (service.type === "POINT_BLANK_TG") {
      lines.push({
        kind: "POINT_BLANK",
        service,
        qty: p.qty,
        unitListCents,
        unitCostCents: unitListCents,
        lineCents: unitListCents * p.qty,
        ...bundleStamp,
      });
      continue;
    }

    if (service.type === "PS_PLUS") {
      lines.push({
        kind: "PS_PLUS",
        service,
        qty: p.qty,
        unitListCents,
        unitCostCents: unitListCents,
        lineCents: unitListCents * p.qty,
        ...bundleStamp,
      });
      continue;
    }

    if (service.type === "EA_PLAY") {
      lines.push({
        kind: "EA_PLAY",
        service,
        qty: p.qty,
        unitListCents,
        unitCostCents: unitListCents,
        lineCents: unitListCents * p.qty,
        ...bundleStamp,
      });
      continue;
    }

    if (service.type === "ACCOUNT_CREATION") {
      const parsed = parseAccountCreationBody(p.accountCreation);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      lines.push({
        kind: "ACCOUNT_CREATION",
        service,
        qty: p.qty,
        unitListCents,
        unitCostCents: unitListCents,
        lineCents: unitListCents * p.qty,
        ...bundleStamp,
        detail: parsed.value,
      });
      continue;
    }

    if (service.type === "STREAMING") {
      const meta = (service.metadata as Record<string, unknown> | null) ?? {};
      const deliveryMode = String(meta.deliveryMode ?? "CODE") === "GMAIL" ? "GMAIL" : "CODE";
      let gmail: string | undefined;
      if (deliveryMode === "GMAIL") {
        // Müştərinin öz hesabına qoşulan plan (Netflix VVIP, Evimdə VIP) —
        // e-poçt hər provayder ola bilər (yalnız @gmail.com deyil).
        const customerEmail = streamingUsesCustomerEmail(meta.service as string);
        const parsed = parseStreamingBody(
          p.streaming,
          customerEmail ? { allowAnyEmail: true, emailLabel: "Netflix hesab e-poçtu" } : {},
        );
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        gmail = parsed.value.gmail;
      }
      lines.push({
        kind: "STREAMING",
        service,
        qty: p.qty,
        unitListCents,
        unitCostCents: unitListCents,
        lineCents: unitListCents * p.qty,
        ...bundleStamp,
        deliveryMode,
        gmail,
      });
      continue;
    }

    if (service.type === "PLATFORM") {
      // YouTube Premium və LinkedIn Premium üçün müştəri email + şifrə təqdim edir.
      // Digər PLATFORM paketləri (Spotify, Notion və s.) bu məlumatlara ehtiyac duymur.
      const platformMeta = (service.metadata as Record<string, unknown> | null) ?? {};
      const category = String(platformMeta.category ?? "");
      const musicBrand = String(platformMeta.musicBrand ?? "");
      const planType = String(platformMeta.planType ?? "");
      const accountSlotsRaw = Number(platformMeta.accountSlots);
      const accountSlots =
        Number.isInteger(accountSlotsRaw) && accountSlotsRaw >= 1 ? accountSlotsRaw : 0;
      const isYoutube = category === "MUSIC" && musicBrand === "YOUTUBE_PREMIUM";
      const isLinkedIn = category === "WORK" && (planType === "CAREER" || planType === "BUSINESS");
      const requiresCredentials = isYoutube || isLinkedIn;

      let gmail: string | undefined;
      let password: string | undefined;
      let accounts: PlatformAccount[] | undefined;
      let hasAccount: boolean | undefined;
      if (accountSlots >= 1) {
        // Çoxhesablı plan (Spotify Individual/Duo/Family) — N hesab cütü tələb olunur.
        const parsed = parsePlatformAccounts(p.streaming, accountSlots);
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        accounts = parsed.value;
        // Müştərinin ARTIQ hesabı var (Premium-a keçir) yoxsa yeni açılmalıdır.
        const s = p.streaming as Record<string, unknown> | null;
        hasAccount = typeof s?.hasAccount === "boolean" ? s.hasAccount : true;
      } else if (requiresCredentials) {
        const parsed = parseStreamingBody(p.streaming, {
          allowAnyEmail: isLinkedIn,
          emailLabel: isLinkedIn ? "LinkedIn email ünvanı" : "Gmail ünvanı",
        });
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        if (!parsed.value.password) {
          return NextResponse.json(
            {
              error: isLinkedIn
                ? "LinkedIn paketi üçün hesab şifrəsi tələb olunur."
                : "YouTube paketi üçün hesab şifrəsi tələb olunur.",
            },
            { status: 400 }
          );
        }
        gmail = parsed.value.gmail;
        password = parsed.value.password;
      }

      lines.push({
        kind: "PLATFORM",
        service,
        qty: p.qty,
        unitListCents,
        unitCostCents: unitListCents,
        lineCents: unitListCents * p.qty,
        ...bundleStamp,
        gmail,
        password,
        accounts,
        hasAccount,
      });
      continue;
    }

    if (service.type === HONSELL_GIFT_CARD_SERVICE_TYPE) {
      lines.push({
        kind: "HONSELL_GIFT_CARD",
        service,
        qty: p.qty,
        unitListCents,
        unitCostCents: unitListCents,
        lineCents: unitListCents * p.qty,
        ...bundleStamp,
      });
      continue;
    }
  }

  const needsPsn = lines.some(
    (l) =>
      l.kind === "GAME" ||
      l.kind === "PS_PLUS" ||
      l.kind === "EA_PLAY" ||
      l.kind === "TRY_BALANCE"
  );

  const requestedAccountId =
    typeof body.psnAccountId === "string" ? body.psnAccountId : null;

  let psnAccount = null;

  // PSN hesab açılışı eyni səbətdədirsə, mövcud PSN tələbi yumşalır: yeni
  // yaradılan hesab admin tərəfindən fulfillment vaxtı oyun sifarişlərinə
  // bağlanacaq.
  const hasPsnCreation = lines.some((l) => l.kind === "ACCOUNT_CREATION");

  if (needsPsn) {
    if (requestedAccountId) {
      psnAccount = await prisma.psnAccount.findUnique({
        where: { id: requestedAccountId },
      });
      if (!psnAccount || psnAccount.userId !== user.id) {
        return NextResponse.json({ error: "Invalid PSN account" }, { status: 400 });
      }
    } else if (!hasPsnCreation) {
      // Client konkret PSN seçməyibsə və səbətdə hesab açılışı YOXDURSA, mövcud
      // default PSN-ə fallback edirik. Hesab açılışı varsa fetch etmirik —
      // games yeni açılacaq hesaba bağlanmalıdır (psnAccount=null qalır, admin
      // fulfillment vaxtı bağlayır).
      psnAccount = await prisma.psnAccount.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
    }

    if (!psnAccount && !hasPsnCreation) {
      return NextResponse.json(
        {
          error:
            "Alış üçün PlayStation hesabı əlavə edin və ya seçin ki, çatdırılma üçün istifadə olunsun.",
          code: "NO_PSN_ACCOUNT",
        },
        { status: 400 }
      );
    }
  }

  const giftTotalCents = giftLines.reduce((sum, g) => sum + g.unitListCents * g.qty, 0);
  const totalCents = lines.reduce((sum, l) => sum + l.lineCents, 0) + giftTotalCents;

  if (totalCents <= 0) {
    return NextResponse.json({ error: "Sifariş məbləği etibarsızdır." }, { status: 400 });
  }

  // Minimum sifariş məbləği — KUPONDAN ƏVVƏLKİ cəm (səbət zolağı ilə eyni rəqəm).
  if (!meetsMinOrder(totalCents)) {
    return NextResponse.json(
      { error: minOrderMessage(totalCents), code: "MIN_ORDER" },
      { status: 400 },
    );
  }

  // ─── Kupon: server-də YENİDƏN validasiya (client preview-a etibar etmirik) ──
  let discountCents = 0;
  let promoForOrder: PromoCode | null = null;
  if (couponCode) {
    const scopeItems: PromoScopeItem[] = [
      // Dəstdən açılan sətirlər kupon bazasına DAXİL EDİLMİR — onlar
      // onsuz da endirimlidir, ikiqat endirim mənfəəti yeyir. `/api/cart/coupon`
      // preview-i də eyni istisnanı tətbiq edir (fərqli olsalar müştəri preview-də
      // bir rəqəm görür, kassada `COUPON_INVALID` alır).
      ...lines
        .filter((l) => !l.serviceBundleId)
        .map((l) => ({
          productId: l.kind === "GAME" ? l.game.id : l.service.id,
          productType:
            l.kind === "GAME"
              ? "GAME"
              : String((l as { service?: { type?: string } }).service?.type ?? l.kind),
          lineCents: l.lineCents,
        })),
      ...giftLines.map((g) => ({
        productId: g.gameId ?? g.serviceProductId ?? "",
        productType: g.productKind,
        lineCents: g.unitListCents * g.qty,
      })),
    ];
    const v = await validatePromoForOrder(prisma, { code: couponCode, userId: user.id, items: scopeItems });
    if (!v.ok) {
      return NextResponse.json({ error: v.message, code: "COUPON_INVALID" }, { status: 400 });
    }
    discountCents = v.discountCents;
    promoForOrder = v.promo;
  }
  const discountedTotalCents = Math.max(0, totalCents - discountCents);
  if (discountedTotalCents <= 0) {
    return NextResponse.json(
      { error: "Kupon bu sifarişə tam tətbiq oluna bilməz.", code: "COUPON_INVALID" },
      { status: 400 },
    );
  }

  // Epoint-in minimum işləm məbləği 5 AZN-dir. Sebet bundan azdırsa ödənişi
  // bloklamaq əvəzinə KARTDAN minimum 5 AZN tutub aradakı fərqi müştərinin
  // cüzdanına kredit olaraq qaytarırıq (round-up to wallet). Beləcə 4.98 kimi
  // məbləğlərdə müştəri "azca da məhsul əlavə et" tələsinə düşmür — fərq
  // növbəti alış üçün balansda qalır. Cüzdan/referal ödənişlərində gateway
  // yoxdur, ona görə round-up mənasızdır: dəqiq sebet məbləği tutulur.
  const isCardPayment =
    body.paymentMethod === "epoint" ||
    body.paymentMethod === "epoint-widget" ||
    body.paymentMethod === "epoint-installment";
  const chargeCents = isCardPayment
    ? Math.max(discountedTotalCents, EPOINT_MIN_CHARGE_AZN_CENTS)
    : discountedTotalCents;
  const topUpCents = chargeCents - discountedTotalCents;

  const spentAzn = await getLifetimeSpendAznForLoyalty(prisma, user.id);
  const effTier = await getEffectiveTier(user.id, spentAzn);
  const loyalty = {
    label: effTier?.displayName ?? effTier?.name ?? "",
    cashbackPct: effTier?.cashbackPct ?? 0,
  };

  if (isCardPayment) {
    const useWidget = body.paymentMethod === "epoint-widget";
    const useInstallment = body.paymentMethod === "epoint-installment";
    const config = getEpointConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Epoint açarları qurulmayıb: EPOINT_PUBLIC_KEY və EPOINT_PRIVATE_KEY lazımdır." },
        { status: 503 },
      );
    }

    // Taksit seçimi client-dən gəlir — kart və ay sayı Epoint-in bu məbləğ
    // üçün qaytardığı təkliflə yenidən yoxlanılır (min məbləğ də daxil).
    let installment: { card: InstallmentCard; option: InstallmentOption } | null = null;
    if (useInstallment) {
      const offer = await getInstallmentOffer(chargeCents / 100);
      if (!installmentAvailable(offer, chargeCents / 100)) {
        return NextResponse.json(
          { error: "Bu məbləğ üçün taksit mövcud deyil.", code: "INSTALLMENT_UNAVAILABLE" },
          { status: 400 },
        );
      }
      const card = offer.cards.find((c) => c.id === String(body.installmentCardId ?? ""));
      const months = Math.floor(Number(body.installmentMonths));
      const option = card?.options.find((o) => o.months === months);
      if (!card || !option) {
        return NextResponse.json(
          { error: "Taksit seçimi etibarsızdır. Kartı və ay sayını yenidən seçin.", code: "INSTALLMENT_INVALID" },
          { status: 400 },
        );
      }
      installment = { card, option };
    }

    // Taksitdə Epoint komissiyası müştəriyə yansıdılır (dəqiq örtük, faiz
    // lib/installmentRates.ts-dən). `topUpCents` (min 5 AZN round-up → cüzdan)
    // bundan ASILI DEYİL — komissiya cüzdana kredit kimi qayıtmamalıdır.
    const payCents = installment
      ? installmentChargeCents(chargeCents, installment.option.feePct)
      : chargeCents;

    const orderCode = `HON-${randomBytes(3).toString("hex").toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const snapshotLines: EpointCartLineSnapshot[] = lines
      .map((line): EpointCartLineSnapshot => {
        if (line.kind === "GAME") {
          return {
            kind: "GAME",
            title: line.game.title,
            qty: line.qty,
            gameId: line.game.id,
            unitListCents: line.unitListCents,
            unitSavingsCents: line.unitSavingsCents,
            unitCostCents: line.unitCostCents,
            psnAccountId: psnAccount?.id ?? null,
            store: "PS",
            reviewAffiliateId,
          };
        }

        if (line.kind === "TRY_BALANCE") {
          return {
            kind: "TRY_BALANCE",
            title: line.service.title,
            qty: line.qty,
            serviceProductId: line.service.id,
            unitListCents: line.unitListCents,
            psnAccountId: psnAccount?.id ?? null,
          };
        }

        if (line.kind === "POINT_BLANK") {
          return {
            kind: "POINT_BLANK",
            title: line.service.title,
            qty: line.qty,
            serviceProductId: line.service.id,
            unitListCents: line.unitListCents,
          };
        }

        if (line.kind === "PS_PLUS") {
          return {
            kind: "PS_PLUS",
            title: line.service.title,
            qty: line.qty,
            serviceProductId: line.service.id,
            unitListCents: line.unitListCents,
            psnAccountId: psnAccount?.id ?? null,
          };
        }

        if (line.kind === "EA_PLAY") {
          return {
            kind: "EA_PLAY",
            title: line.service.title,
            qty: line.qty,
            serviceProductId: line.service.id,
            unitListCents: line.unitListCents,
            psnAccountId: psnAccount?.id ?? null,
          };
        }

        if (line.kind === "ACCOUNT_CREATION") {
          const names = splitFullName(line.detail.fullName);
          return {
            kind: "ACCOUNT_CREATION",
            title: line.service.title,
            qty: line.qty,
            serviceProductId: line.service.id,
            unitListCents: line.unitListCents,
            psnAccountId: psnAccount?.id ?? null,
            detail: {
              firstName: names.firstName,
              lastName: names.lastName,
              birthDate: line.detail.birthDate,
              email: line.detail.email,
              password: line.detail.password,
            },
          };
        }

        if (line.kind === "STREAMING") {
          return {
            kind: "STREAMING",
            title: line.service.title,
            qty: line.qty,
            serviceProductId: line.service.id,
            unitListCents: line.unitListCents,
            deliveryMode: line.deliveryMode,
            gmail: line.gmail,
          };
        }

        if (line.kind === "HONSELL_GIFT_CARD") {
          return {
            kind: "HONSELL_GIFT_CARD",
            title: line.service.title,
            qty: line.qty,
            serviceProductId: line.service.id,
            unitListCents: line.unitListCents,
          };
        }

        const platformMeta = (line.service.metadata as Record<string, unknown> | null) ?? {};
        return {
          kind: "PLATFORM",
          title: line.service.title,
          qty: line.qty,
          serviceProductId: line.service.id,
          unitListCents: line.unitListCents,
          category: String(platformMeta.category ?? ""),
          musicBrand: typeof platformMeta.musicBrand === "string" ? platformMeta.musicBrand : null,
          planType: typeof platformMeta.planType === "string" ? platformMeta.planType : null,
          durationMonths: Number(platformMeta.durationMonths) || null,
          gmail: line.gmail,
          password: line.password,
          accounts: line.accounts,
          hasAccount: line.hasAccount,
        };
      })
      // Xidmət dəsti damğası snapshot-un BÜTÜN variantlarında eyni iki sahədir,
      // ona görə hər budaqda təkrarlanmaq əvəzinə nəticəyə ayrıca addımda yazılır
      // (`map` sıranı və uzunluğu qoruyur, ona görə indeks `lines` ilə üst-üstə düşür).
      // ⚠️ Kart yolu cüzdan yolundan AYRIDIR — damğa burada da olmalıdır, yoxsa
      // Epoint ilə alınan dəstin sətirləri admin panelində qruplaşmır.
      .map((snap, i) => {
        const line = lines[i];
        return line.serviceBundleId
          ? Object.assign(snap, {
              serviceBundleId: line.serviceBundleId,
              serviceBundleTitle: line.serviceBundleTitle,
            })
          : snap;
      });

    // Hədiyyə sətirləri — finalize zamanı (ödəniş təsdiqindən sonra) hər nüsxə
    // üçün ProductGift yaradılacaq.
    for (const g of giftLines) {
      snapshotLines.push({
        kind: "PRODUCT_GIFT",
        title: g.title,
        qty: g.qty,
        unitListCents: g.unitListCents,
        productKind: g.productKind,
        gameId: g.gameId,
        serviceProductId: g.serviceProductId,
        store: g.store,
        imageUrl: g.imageUrl,
        giftMessage: g.giftMessage,
      });
    }

    const metadata: EpointCartPaymentMetadata = {
      gateway: "epoint",
      flow: "cart-checkout",
      orderCode,
      createdAt,
      checkout: {
        totalCents: discountedTotalCents,
        originalTotalCents: totalCents,
        discountCents,
        couponCode: promoForOrder ? promoForOrder.code : null,
        promoCodeId: promoForOrder ? promoForOrder.id : null,
        topUpCents,
        loyalty: {
          label: loyalty.label,
          cashbackPct: loyalty.cashbackPct,
        },
        lines: snapshotLines,
      },
    };

    // Karta minimum 5 AZN (chargeCents) tutulur, taksitdə üstəgəl komissiya
    // (payCents). amountAznCents = payCents saxlanır ki, /result və /reconcile-dakı amount-mismatch yoxlaması
    // epoint-in bildirdiyi məbləğlə üst-üstə düşsün. Məhsul fulfillment-i və
    // cashback isə metadata.checkout.totalCents (real sebet) üzərindən gedir.
    const payment = await prisma.transaction.create({
      data: {
        userId: user.id,
        type: EPOINT_CART_PAYMENT_TYPE,
        status: "PENDING",
        amountAznCents: payCents,
        metadata: JSON.stringify(metadata),
      },
      select: { id: true },
    });

    // Kanal damğası — sifariş ödənilməsə də qalır. Məhz bu sətir "ödənişə
    // keçdi, ödəmədi" metrikasını pulsuz verir: OrderAttribution var, amma
    // SUCCESS Transaction yoxdur.
    await recordOrderAttribution({
      orderCode,
      userId: user.id,
      paymentMethod: useWidget ? "EPOINT_WIDGET" : installment ? "EPOINT_INSTALLMENT" : "EPOINT",
      orderTotalAznCents: discountedTotalCents,
      attribution: await resolveAttribution(body),
    });

    const origin = requestOrigin(req);
    const amountAzn = Number((payCents / 100).toFixed(2));
    const description = `Honsell sifariş ${orderCode}: ${amountAzn.toFixed(2)} AZN`;
    const successUrl = `${origin}/success?order_id=${encodeURIComponent(payment.id)}&order_code=${encodeURIComponent(orderCode)}`;
    const errorUrl = `${origin}/error?order_id=${encodeURIComponent(payment.id)}&order_code=${encodeURIComponent(orderCode)}`;

    if (useWidget) {
      let widget: EpointWidgetResponse;
      try {
        widget = await createEpointWidget(
          {
            public_key: config.publicKey,
            amount: amountAzn,
            order_id: payment.id,
            description,
          },
          config.privateKey,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Epoint widget sorğusu alınmadı.";
        await prisma.transaction.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            metadata: JSON.stringify({ ...metadata, error: message }),
          },
        });
        return NextResponse.json({ error: message }, { status: 502 });
      }

      const widgetOk =
        String(widget.status ?? "").toLowerCase() === "success" &&
        typeof widget.widget_url === "string" &&
        widget.widget_url.length > 0;

      if (!widgetOk) {
        await prisma.transaction.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            metadata: JSON.stringify({ ...metadata, epoint: widget }),
          },
        });
        return NextResponse.json(
          { error: widget.message ?? "Epoint widget yaratmadı.", epoint: widget },
          { status: 502 },
        );
      }

      await prisma.transaction.update({
        where: { id: payment.id },
        data: {
          metadata: JSON.stringify({
            ...metadata,
            epoint: { widget_status: widget.status ?? null, channel: "widget" },
          }),
        },
      });

      return NextResponse.json({
        ok: true,
        paymentMethod: "epoint-widget",
        orderId: payment.id,
        orderCode,
        widgetUrl: widget.widget_url,
        successUrl,
        errorUrl,
      });
    }

    let checkout: EpointCheckoutResponse;

    try {
      // Taksit endpoint-i `result_url` qəbul etmir — callback widget kimi
      // Epoint kabinetindəki merchant URL-inə (/result) gəlir, order_id eynidir.
      checkout = installment
        ? await createEpointInstallment(
            {
              public_key: config.publicKey,
              amount: amountAzn,
              currency: "AZN",
              language: "az",
              order_id: payment.id,
              installment_card_id: installment.card.id,
              installment_month: installment.option.months,
              description: `${description} · ${installment.card.name} ${installment.option.months} ay`,
              success_redirect_url: successUrl,
              error_redirect_url: errorUrl,
            },
            config.privateKey,
          )
        : await createEpointCheckout(
            {
              public_key: config.publicKey,
              amount: amountAzn,
              currency: "AZN",
              language: "az",
              order_id: payment.id,
              description,
              success_redirect_url: successUrl,
              error_redirect_url: errorUrl,
              result_url: `${origin}/result`,
            },
            config.privateKey,
          );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Epoint sorğusu alınmadı.";
      await prisma.transaction.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          metadata: JSON.stringify({ ...metadata, error: message }),
        },
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (!checkoutSucceeded(checkout)) {
      await prisma.transaction.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          metadata: JSON.stringify({ ...metadata, epoint: checkout }),
        },
      });
      return NextResponse.json(
        { error: checkout.message ?? "Epoint ödəniş linki yaratmadı.", epoint: checkout },
        { status: 502 },
      );
    }

    await prisma.transaction.update({
      where: { id: payment.id },
      data: {
        metadata: JSON.stringify({
          ...metadata,
          epoint: {
            transaction: checkout.transaction ?? null,
            status: checkout.status ?? null,
            ...(installment
              ? {
                  channel: "installment",
                  installment: {
                    cardId: installment.card.id,
                    cardName: installment.card.name,
                    months: installment.option.months,
                    feePct: installment.option.feePct,
                    baseCents: chargeCents,
                    feeCents: payCents - chargeCents,
                  },
                }
              : {}),
          },
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      paymentMethod: installment ? "epoint-installment" : "epoint",
      orderId: payment.id,
      orderCode,
      redirectUrl: checkout.redirect_url,
    });
  }

  if (paymentSource === "referral") {
    if (user.referralBalanceCents < discountedTotalCents) {
      return NextResponse.json(
        {
          error: "Referal balansı kifayət etmir.",
          requiredAzn: discountedTotalCents / 100,
          referralBalanceAzn: user.referralBalanceCents / 100,
        },
        { status: 402 }
      );
    }
  } else if (user.walletBalance < discountedTotalCents) {
    return NextResponse.json(
      {
        error: "Cüzdan balansı kifayət etmir.",
        requiredAzn: discountedTotalCents / 100,
        balanceAzn: user.walletBalance / 100,
      },
      { status: 402 }
    );
  }

  const payTag = paymentSource === "referral" ? ("REFERRAL" as const) : ("WALLET" as const);

  // Hədiyyə kodlarını tranzaksiyadan ƏVVƏL generasiya edirik: bu, ensure-once
  // cədvəl yaradılmasını işə salır və kolliziya yoxlamasını tx-dən kənarda saxlayır.
  const giftCodePool: string[] = [];
  if (giftLines.length > 0) {
    const totalGiftUnits = giftLines.reduce((n, g) => n + g.qty, 0);
    const seen = new Set<string>();
    for (let i = 0; i < totalGiftUnits; i++) {
      let code = await generateUniqueProductGiftCode();
      while (seen.has(code)) code = await generateUniqueProductGiftCode();
      seen.add(code);
      giftCodePool.push(code);
    }
  }

  // Bonus kupon kodunu tx-dən ƏVVƏL generasiya edirik (kolliziya yoxlaması tx-dən kənarda).
  const bonusCouponCode = await generateUniqueBonusPromoCode();

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const orderCode = `HON-${randomBytes(3).toString("hex").toUpperCase()}`;

      await tx.user.update({
        where: { id: user.id },
        data:
          paymentSource === "referral"
            ? { referralBalanceCents: { decrement: discountedTotalCents } }
            : { walletBalance: { decrement: discountedTotalCents } },
      });

      const purchaseIds: string[] = [];
      const serviceOrderIds: string[] = [];
      const referredByForTierCheck = new Set<string>();
      let totalCommissionCents = 0;
      let cashbackCents = 0;
      let tryBalancePendingCount = 0;
      let tryBalanceDeliveredCount = 0;
      let pointBlankPendingCount = 0;
      let pointBlankDeliveredCount = 0;
      const productGiftsIssued: {
        code: string;
        title: string;
        productKind: string;
        amountAznCents: number;
        giftMessage: string | null;
      }[] = [];
      const honsellGiftCardsIssued: {
        amountAznCents: number;
        expiresAt: Date;
        transactionId: string;
      }[] = [];

      const attachPsn = psnAccount?.id ?? null;

      for (const line of lines) {
        // Xidmət DƏSTİNDƏN açılmış sətrin damğası. Admin sifarişləri dəst üzrə
        // qruplaşdıra bilsin deyə hər fulfillment budağının metadata-sına düşür
        // (Order/OrderItem modeli yoxdur, `orderCode` + bu damğa yeganə əlaqədir).
        const bundleMeta = line.serviceBundleId
          ? {
              serviceBundleId: line.serviceBundleId,
              serviceBundleTitle: line.serviceBundleTitle,
            }
          : {};
        for (let n = 0; n < line.qty; n++) {
          if (line.kind === "GAME") {
            const purchase = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                savingsAznCents: line.unitSavingsCents,
                costAznCents: line.unitCostCents,
                gameId: line.game.id,
                psnAccountId: psnAccount?.id ?? null,
                metadata: JSON.stringify({
                  paymentSource: payTag,
                  fromCart: true,
                  manualDelivery: true,
                  fulfillmentStage: "NEW",
                  store: "PS",
                  orderCode,
                  ...bundleMeta,
                  ...(reviewAffiliateId
                    ? { reviewAffiliateId, reviewAffiliateLineCents: line.unitListCents }
                    : {}),
                }),
              },
            });
            purchaseIds.push(purchase.id);
          } else if (line.kind === "TRY_BALANCE") {
            const sc = await tx.serviceCode.findFirst({
              where: { serviceProductId: line.service.id, isUsed: false },
              orderBy: { createdAt: "asc" },
            });
            if (!sc) {
              const serviceOrder = await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: "SERVICE_PURCHASE",
                  status: "PENDING",
                  amountAznCents: -line.unitListCents,
                  serviceProductId: line.service.id,
                  psnAccountId: psnAccount?.id ?? null,
                  metadata: JSON.stringify({
                    fromCart: true,
                    kind: "TRY_BALANCE",
                    reason: "OUT_OF_STOCK",
                    paymentSource: payTag,
                    orderCode,
                    ...bundleMeta,
                  }),
                },
              });
              serviceOrderIds.push(serviceOrder.id);
              tryBalancePendingCount += 1;
            } else {
              await tx.serviceCode.update({
                where: { id: sc.id },
                data: { isUsed: true },
              });

              const serviceOrder = await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: "SERVICE_PURCHASE",
                  status: "SUCCESS",
                  amountAznCents: -line.unitListCents,
                  serviceProductId: line.service.id,
                  serviceCodeId: sc.id,
                  psnAccountId: psnAccount?.id ?? null,
                  metadata: JSON.stringify({
                    fromCart: true,
                    kind: "TRY_BALANCE",
                    paymentSource: payTag,
                    orderCode,
                    ...bundleMeta,
                  }),
                },
              });
              serviceOrderIds.push(serviceOrder.id);
              tryBalanceDeliveredCount += 1;

              const cm = await awardStreamingReferralCommission(tx, {
                sourceTransactionId: serviceOrder.id,
                buyerUserId: user.id,
                serviceProductId: line.service.id,
                lineCents: line.unitListCents,
                target: { type: "GIFT_CARDS" },
                kind: "TRY_BALANCE",
              });
              if (cm) {
                totalCommissionCents += cm.commissionCents;
                referredByForTierCheck.add(cm.referredById);
              }

              try {
                await recordPurchaseSpend(tx, user.id, line.unitListCents);
                if (cm?.referredById) {
                  await recordSuccessfulInvite(tx, cm.referredById, user.id);
                }
              } catch (err) {
                console.error("referral cycle bookkeeping failed", err);
              }
            }
          } else if (line.kind === "POINT_BLANK") {
            // Point Blank TG — stokda e-pin kod varsa dərhal təhvil (SUCCESS),
            // yoxdursa PENDING sifariş yaranır və admin /admin/orders-dən manual
            // təhvil verir. PSN hesabı tələb olunmur.
            const sc = await tx.serviceCode.findFirst({
              where: { serviceProductId: line.service.id, isUsed: false },
              orderBy: { createdAt: "asc" },
            });
            if (!sc) {
              const serviceOrder = await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: "SERVICE_PURCHASE",
                  status: "PENDING",
                  amountAznCents: -line.unitListCents,
                  serviceProductId: line.service.id,
                  psnAccountId: null,
                  metadata: JSON.stringify({
                    fromCart: true,
                    kind: "POINT_BLANK_TG",
                    reason: "OUT_OF_STOCK",
                    paymentSource: payTag,
                    orderCode,
                    ...bundleMeta,
                  }),
                },
              });
              serviceOrderIds.push(serviceOrder.id);
              pointBlankPendingCount += 1;
            } else {
              await tx.serviceCode.update({
                where: { id: sc.id },
                data: { isUsed: true },
              });

              const serviceOrder = await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: "SERVICE_PURCHASE",
                  status: "SUCCESS",
                  amountAznCents: -line.unitListCents,
                  serviceProductId: line.service.id,
                  serviceCodeId: sc.id,
                  psnAccountId: null,
                  metadata: JSON.stringify({
                    fromCart: true,
                    kind: "POINT_BLANK_TG",
                    paymentSource: payTag,
                    orderCode,
                    ...bundleMeta,
                  }),
                },
              });
              serviceOrderIds.push(serviceOrder.id);
              pointBlankDeliveredCount += 1;

              const cm = await awardStreamingReferralCommission(tx, {
                sourceTransactionId: serviceOrder.id,
                buyerUserId: user.id,
                serviceProductId: line.service.id,
                lineCents: line.unitListCents,
                target: { type: "GIFT_CARDS" },
                kind: "TRY_BALANCE",
              });
              if (cm) {
                totalCommissionCents += cm.commissionCents;
                referredByForTierCheck.add(cm.referredById);
              }

              try {
                await recordPurchaseSpend(tx, user.id, line.unitListCents);
                if (cm?.referredById) {
                  await recordSuccessfulInvite(tx, cm.referredById, user.id);
                }
              } catch (err) {
                console.error("referral cycle bookkeeping failed", err);
              }
            }
          } else if (line.kind === "PS_PLUS") {
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                psnAccountId: attachPsn,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "PS_PLUS",
                  paymentSource: payTag,
                  orderCode,
                  ...bundleMeta,
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
          } else if (line.kind === "EA_PLAY") {
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                psnAccountId: attachPsn,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "EA_PLAY",
                  paymentSource: payTag,
                  orderCode,
                  ...bundleMeta,
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
          } else if (line.kind === "ACCOUNT_CREATION") {
            const names = splitFullName(line.detail.fullName);
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                psnAccountId: attachPsn,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "ACCOUNT_CREATION",
                  paymentSource: payTag,
                  orderCode,
                  ...bundleMeta,
                  firstName: names.firstName,
                  lastName: names.lastName,
                  birthDate: line.detail.birthDate,
                  email: line.detail.email,
                  password: line.detail.password,
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
          } else if (line.kind === "STREAMING") {
            // STREAMING — bütün sifarişlər admin təsdiqini gözləyir.
            // Stok məntiqi yoxdur; admin sifarişə əl ilə hesab məlumatları verir.
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "STREAMING",
                  deliveryMode: line.deliveryMode,
                  paymentSource: payTag,
                  orderCode,
                  ...bundleMeta,
                  ...(line.deliveryMode === "GMAIL" && line.gmail ? { gmail: line.gmail } : {}),
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
          } else if (line.kind === "HONSELL_GIFT_CARD") {
            // Honsell hədiyyə kartı — alış zamanı kod yaranmır. Status PENDING
            // qalır; admin /admin/honsell-gift-cards səhifəsindən kodu manual
            // daxil edib müştəriyə təslim edir.
            const expiresAt = new Date(
              Date.now() + HONSELL_GIFT_CARD_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
            );
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "HONSELL_GIFT_CARD",
                  paymentSource: payTag,
                  orderCode,
                  ...bundleMeta,
                  honsellGiftCardAmountAznCents: line.unitListCents,
                  honsellGiftCardExpiresAt: expiresAt.toISOString(),
                }),
              },
            });
            await tx.honsellGiftCard.create({
              data: {
                code: null,
                amountAznCents: line.unitListCents,
                status: "PENDING",
                purchasedById: user.id,
                purchaseTransactionId: serviceOrder.id,
                expiresAt,
              },
            });
            serviceOrderIds.push(serviceOrder.id);
            honsellGiftCardsIssued.push({
              amountAznCents: line.unitListCents,
              expiresAt,
              transactionId: serviceOrder.id,
            });
          } else {
            // PLATFORM (Musiqi / AI / İş Platformaları) — streaming ilə eyni axın.
            const platformMeta =
              (line.service.metadata as Record<string, unknown> | null) ?? {};
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "PLATFORM",
                  category: String(platformMeta.category ?? ""),
                  musicBrand: String(platformMeta.musicBrand ?? "") || null,
                  planType: String(platformMeta.planType ?? "") || null,
                  durationMonths: Number(platformMeta.durationMonths) || null,
                  paymentSource: payTag,
                  orderCode,
                  ...bundleMeta,
                  ...(line.gmail ? { gmail: line.gmail } : {}),
                  ...(line.password ? { customerPassword: line.password } : {}),
                  ...(line.accounts?.length ? { accounts: line.accounts } : {}),
                  ...(typeof line.hasAccount === "boolean" ? { hasAccount: line.hasAccount } : {}),
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
          }
        }
      }

      // ─── HƏDİYYƏLƏR ─────────────────────────────────────────────────────
      // Hər hədiyyə nüsxəsi üçün: alıcının ödəniş qeydi (SUCCESS) + UNCLAIMED
      // ProductGift (kodla). Çatdırılma sifarişi YARANMIR — dost claim edəndə
      // öz adına PENDING sifariş açılır.
      if (giftLines.length > 0) {
        const giftExpiresAt = new Date(
          Date.now() + PRODUCT_GIFT_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
        );
        let giftCodeIdx = 0;
        for (const g of giftLines) {
          for (let n = 0; n < g.qty; n++) {
            const code = giftCodePool[giftCodeIdx++];
            const payment = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "SUCCESS",
                amountAznCents: -g.unitListCents,
                ...(g.gameId ? { gameId: g.gameId } : {}),
                ...(g.serviceProductId ? { serviceProductId: g.serviceProductId } : {}),
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "PRODUCT_GIFT",
                  giftProductKind: g.productKind,
                  paymentSource: payTag,
                  orderCode,
                  giftCode: code,
                  store: g.store,
                }),
              },
            });
            await tx.productGift.create({
              data: {
                code,
                status: "UNCLAIMED",
                productKind: g.productKind,
                gameId: g.gameId,
                serviceProductId: g.serviceProductId,
                store: g.store,
                titleSnap: g.title,
                imageSnap: g.imageUrl,
                amountAznCents: g.unitListCents,
                giftMessage: g.giftMessage,
                purchasedById: user.id,
                purchaseTransactionId: payment.id,
                expiresAt: giftExpiresAt,
              },
            });
            serviceOrderIds.push(payment.id);
            productGiftsIssued.push({
              code,
              title: g.title,
              productKind: g.productKind,
              amountAznCents: g.unitListCents,
              giftMessage: g.giftMessage,
            });
          }
        }
      }

      if (loyalty.cashbackPct > 0) {
        cashbackCents = Math.round((discountedTotalCents * loyalty.cashbackPct) / 100);
        if (cashbackCents > 0) {
          await applyCashbackToBalance(tx, {
            userId: user.id,
            cashbackCents,
            tierLabel: loyalty.label,
            cashbackPct: loyalty.cashbackPct,
            sourcePurchaseIds: purchaseIds,
            sourceServiceOrderIds: serviceOrderIds,
            orderCode,
          });
        }
      }

      // Kupon redemption (yalnız endirim varsa) — usedCount++ + audit.
      if (promoForOrder && discountCents > 0) {
        await applyPromoRedemption(tx, {
          promo: promoForOrder,
          userId: user.id,
          orderCode,
          discountCents,
          transactionId: purchaseIds[0] ?? serviceOrderIds[0] ?? null,
        });
      }

      // Checkout bonusları (idempotent, ödəniş təsdiqlənəndə = indi).
      const bonusItemCount =
        lines.reduce((n, l) => n + l.qty, 0) + giftLines.reduce((n, g) => n + g.qty, 0);
      const bonus = await grantCheckoutBonuses(tx, {
        userId: user.id,
        orderCode,
        orderTotalCents: discountedTotalCents,
        itemCount: bonusItemCount,
        bonusCouponCode,
      });

      return {
        purchaseIds,
        serviceOrderIds,
        totalCommissionCents,
        cashbackCents,
        tryBalancePendingCount,
        tryBalanceDeliveredCount,
        pointBlankPendingCount,
        pointBlankDeliveredCount,
        orderCode,
        referredByForTierCheck: Array.from(referredByForTierCheck),
        honsellGiftCardsIssued,
        productGiftsIssued,
        bonus,
      };
    });
  } catch (e: unknown) {
    throw e;
  }

  // ── Kanal atributsiyası (cüzdan yolu) ───────────────────────────────────
  // $transaction-dan KƏNARDA: hesabat damğası pul əməliyyatını gecikdirməməli
  // və uğursuzluğu onu geri qaytarmamalıdır. Hər iki funksiya öz-özünə səssizdir.
  await recordOrderAttribution({
    orderCode: result.orderCode,
    userId: user.id,
    paymentMethod: payTag, // WALLET | REFERRAL
    orderTotalAznCents: discountedTotalCents,
    attribution: await resolveAttribution(body),
  });
  await stampOrderCode(
    [...result.purchaseIds, ...result.serviceOrderIds],
    result.orderCode,
  );

  // Spotify Premium sifarişləri → CRM (vendor + müştəri WhatsApp-ı orada). Cavabı
  // GÖZLƏMİR (next start uzunömürlü prosesdir); funksiya throw etmir.
  // ⚠️ İKİQAT FULFILLMENT YOLU: kart yolunda da (lib/epointCartCheckout.ts) eyni çağırış var.
  void pushSpotifyOrdersToCrm(result.serviceOrderIds);

  // GAME alındıqdan sonra rəy affiliate cookie-sini təmizlə —
  // attribution alışın metadata-sına yazıldı, daha lazım deyil.
  if (reviewAffiliateId && lines.some((l) => l.kind === "GAME")) {
    try {
      await clearReviewAffiliateCookie();
    } catch {
      /* ignore */
    }
  }

  const cashbackCentsApplied = Number(result.cashbackCents ?? 0);

  const walletBonusCents = result.bonus?.walletCreditCents ?? 0;
  let newWalletCents = user.walletBalance;
  let newReferralCents = user.referralBalanceCents;
  if (paymentSource === "wallet") {
    newWalletCents = user.walletBalance - discountedTotalCents + walletBonusCents;
    newReferralCents = user.referralBalanceCents;
  } else {
    newWalletCents = user.walletBalance + walletBonusCents;
    newReferralCents = user.referralBalanceCents - discountedTotalCents;
  }
  const prevCashbackCents = user.cashbackBalanceCents ?? 0;
  const newCashbackBalanceAzn = (prevCashbackCents + cashbackCentsApplied) / 100;

  const hasTryBalance = lines.some((l) => l.kind === "TRY_BALANCE");
  const tryBalancePendingCount = Number(result.tryBalancePendingCount ?? 0);
  const hasPointBlank = lines.some((l) => l.kind === "POINT_BLANK");
  const pointBlankPendingCount = Number(result.pointBlankPendingCount ?? 0);
  const hasStreaming = lines.some((l) => l.kind === "STREAMING");

  const productGiftsIssued = result.productGiftsIssued ?? [];

  try {
    await sendAdminOrderNotification({
      orderCode: result.orderCode,
      userEmail: user.email,
      userName: user.name,
      totalAzn: totalCents / 100,
      paymentSource,
      items: [
        ...lines.map((l) => ({
          kind: l.kind,
          title: l.kind === "GAME" ? l.game.title : l.service.title,
          qty: l.qty,
          lineAzn: l.lineCents / 100,
        })),
        ...productGiftsIssued.map((g) => ({
          kind: "PRODUCT_GIFT",
          title: `🎁 ${g.title}`,
          qty: 1,
          lineAzn: g.amountAznCents / 100,
        })),
      ],
    });
  } catch (notifyErr) {
    console.error("admin order notify failed", notifyErr);
  }

  // Hədiyyə kodlarını alıcıya email ilə göndər (dostuna ötürməsi üçün).
  if (productGiftsIssued.length > 0) {
    try {
      await sendProductGiftCodeEmail({
        email: user.email,
        userName: user.name ?? user.email,
        claimUrl: `${SITE_URL}${PRODUCT_GIFT_CLAIM_PATH}`,
        gifts: productGiftsIssued.map((g) => ({
          title: g.title,
          formattedCode: formatProductGiftCode(g.code),
          amountAznFormatted: `${(g.amountAznCents / 100).toFixed(2)} AZN`,
        })),
        referralCode: user.referralCode,
      });
    } catch (emailErr) {
      console.error("product gift code email failed", emailErr);
    }
  }

  // Honsell hədiyyə kartı kodları admin tərəfindən manual daxil edildikdə
  // (/admin/honsell-gift-cards) müştəriyə email ilə göndərilir.
  const honsellGiftCards = result.honsellGiftCardsIssued ?? [];

  return NextResponse.json({
    ok: true,
    orderCode: result.orderCode as string,
    hasTryBalance,
    tryBalancePendingCount,
    hasPointBlank,
    pointBlankPendingCount,
    paymentSourceUsed: paymentSource,
    purchaseCount: result.purchaseIds.length + result.serviceOrderIds.length,
    paidAzn: discountedTotalCents / 100,
    discountAzn: discountCents / 100,
    bonus: result.bonus
      ? {
          walletCreditAzn: result.bonus.walletCreditCents / 100,
          couponCode: result.bonus.bonusCouponCode,
          communityAccess: result.bonus.communityAccess,
        }
      : null,
    cashbackAzn: cashbackCentsApplied / 100,
    cashbackPct: loyalty.cashbackPct,
    newCashbackBalanceAzn,
    commissionPaidAzn: result.totalCommissionCents / 100,
    newWalletBalanceAzn: newWalletCents / 100,
    newReferralBalanceAzn: newReferralCents / 100,
    newBalanceAzn: newWalletCents / 100,
    hasAccountCreation: lines.some((l) => l.kind === "ACCOUNT_CREATION"),
    hasStreaming,
    pendingGameFulfillmentQty: lines.reduce(
      (n, l) => n + (l.kind === "GAME" ? l.qty : 0),
      0
    ),
    honsellGiftCards: honsellGiftCards.map((c) => ({
      amountAzn: c.amountAznCents / 100,
      expiresAt: c.expiresAt.toISOString(),
      pending: true,
    })),
    gifts: productGiftsIssued.map((g) => ({
      title: g.title,
      code: g.code,
      formattedCode: formatProductGiftCode(g.code),
      amountAzn: g.amountAznCents / 100,
    })),
    pendingGiftQty: productGiftsIssued.length,
    deliveredTo: psnAccount
      ? {
          id: psnAccount.id,
          label: psnAccount.label,
          psnEmail: psnAccount.psnEmail,
        }
      : null,
  });
}
