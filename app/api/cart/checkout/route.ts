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
import { getLoyaltyTier } from "@/lib/loyalty";
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
import {
  EPOINT_CART_PAYMENT_TYPE,
  type EpointCartLineSnapshot,
  type EpointCartPaymentMetadata,
} from "@/lib/epointCartCheckout";
import {
  createEpointCheckout,
  createEpointWidget,
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
import { MIN_CART_AZN_CENTS } from "@/lib/cartLimits";
import { validateAccountPassword } from "@/lib/accountPasswordRules";

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

type EpicAccountBody = {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  password: string;
  displayName: string;
};

type CartLinePayload = {
  id: string;
  qty: number;
  accountCreation?: unknown;
  epicAccountCreation?: unknown;
  streaming?: unknown;
  /** Bu sətir dostuna HƏDİYYƏ olaraq alınır — çatdırılma hesabı tələb olunmur,
   *  ödənişdən sonra hər nüsxə üçün 11 simvollu kod yaranır. */
  isGift?: boolean;
  giftMessage?: string;
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

function parseEpicAccountBody(raw: unknown):
  | { ok: true; value: EpicAccountBody }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Epic hesab açılışı üçün məlumatlar çatışmır." };
  }
  const o = raw as Record<string, unknown>;
  const firstName = typeof o.firstName === "string" ? o.firstName.trim() : "";
  const lastName = typeof o.lastName === "string" ? o.lastName.trim() : "";
  const birthDate = typeof o.birthDate === "string" ? o.birthDate.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const password = typeof o.password === "string" ? o.password : "";
  const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";
  if (!firstName) return { ok: false, error: "Ad tələb olunur." };
  if (!lastName) return { ok: false, error: "Soyad tələb olunur." };
  if (!birthDate) return { ok: false, error: "Doğum tarixi tələb olunur." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Etibarlı e-poçt ünvanı tələb olunur." };
  }
  if (password.length < 8) return { ok: false, error: "Şifrə ən azı 8 simvol olmalıdır." };
  if (!displayName) return { ok: false, error: "Görünən ad tələb olunur." };
  return { ok: true, value: { firstName, lastName, birthDate, email, password, displayName } };
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
      epicAccountCreation: i?.epicAccountCreation,
      streaming: i?.streaming,
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

  const settings = await getSettings();
  const ids = payloads.map((i) => i.id);

  // Rəy affiliate cookie-si — alış SUCCESS olduqda rəy müəllifinə
  // komissiya yazılması üçün GAME alış metadata-sına stamp olunur.
  // Validasiya award vaxtı edilir; burada sadəcə dəyər saxlanır.
  const reviewAffiliateId = await readReviewAffiliateCookie();

  const [games, services] = await Promise.all([
    prisma.game.findMany({
      where: { id: { in: ids }, isActive: true },
    }),
    prisma.serviceProduct.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        type: {
          in: [
            "PS_PLUS",
            "EA_PLAY",
            "TRY_BALANCE",
            "POINT_BLANK_TG",
            "ACCOUNT_CREATION",
            "EPIC_ACCOUNT_CREATION",
            "STREAMING",
            "PLATFORM",
            HONSELL_GIFT_CARD_SERVICE_TYPE,
          ],
        },
      },
    }),
  ]);

  type GameModel = (typeof games)[number];
  type ServiceModel = (typeof services)[number];

  type LineUnion =
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
        kind: "EPIC_ACCOUNT_CREATION";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
        detail: EpicAccountBody;
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
      }
    | {
        kind: "HONSELL_GIFT_CARD";
        service: ServiceModel;
        qty: number;
        unitListCents: number;
        unitCostCents: number;
        lineCents: number;
      };

  if (games.length + services.length !== payloads.length) {
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

  for (const p of payloads) {
    const game = games.find((g) => g.id === p.id);

    // ─── HƏDİYYƏ sətri ────────────────────────────────────────────────────
    if (p.isGift) {
      if (game) {
        const price = computeDisplayPrice(game, settings);
        giftLines.push({
          productKind: "GAME",
          gameId: game.id,
          serviceProductId: null,
          store: game.store === "EPIC" ? "EPIC" : "PS",
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
      const price = computeDisplayPrice(game, settings);
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

    const service = services.find((s) => s.id === p.id)!;

    if (service.type === "TRY_BALANCE") {
      lines.push({
        kind: "TRY_BALANCE",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
      });
      continue;
    }

    if (service.type === "POINT_BLANK_TG") {
      lines.push({
        kind: "POINT_BLANK",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
      });
      continue;
    }

    if (service.type === "PS_PLUS") {
      lines.push({
        kind: "PS_PLUS",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
      });
      continue;
    }

    if (service.type === "EA_PLAY") {
      lines.push({
        kind: "EA_PLAY",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
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
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
        detail: parsed.value,
      });
      continue;
    }

    if (service.type === "EPIC_ACCOUNT_CREATION") {
      const parsed = parseEpicAccountBody(p.epicAccountCreation);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      lines.push({
        kind: "EPIC_ACCOUNT_CREATION",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
        detail: parsed.value,
      });
      continue;
    }

    if (service.type === "STREAMING") {
      const meta = (service.metadata as Record<string, unknown> | null) ?? {};
      const deliveryMode = String(meta.deliveryMode ?? "CODE") === "GMAIL" ? "GMAIL" : "CODE";
      let gmail: string | undefined;
      if (deliveryMode === "GMAIL") {
        const parsed = parseStreamingBody(p.streaming);
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        gmail = parsed.value.gmail;
      }
      lines.push({
        kind: "STREAMING",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
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
      if (accountSlots >= 1) {
        // Çoxhesablı plan (Spotify Individual/Duo/Family) — N hesab cütü tələb olunur.
        const parsed = parsePlatformAccounts(p.streaming, accountSlots);
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        accounts = parsed.value;
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
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
        gmail,
        password,
        accounts,
      });
      continue;
    }

    if (service.type === HONSELL_GIFT_CARD_SERVICE_TYPE) {
      lines.push({
        kind: "HONSELL_GIFT_CARD",
        service,
        qty: p.qty,
        unitListCents: service.priceAznCents,
        unitCostCents: service.priceAznCents,
        lineCents: service.priceAznCents * p.qty,
      });
      continue;
    }
  }

  // Epic PC games deliver to an Epic account, not PSN — both have kind "GAME",
  // so we split on the catalog row's `store`.
  const needsPsn = lines.some(
    (l) =>
      (l.kind === "GAME" && l.game.store !== "EPIC") ||
      l.kind === "PS_PLUS" ||
      l.kind === "EA_PLAY" ||
      l.kind === "TRY_BALANCE"
  );
  const needsEpic = lines.some((l) => l.kind === "GAME" && l.game.store === "EPIC");

  const requestedAccountId =
    typeof body.psnAccountId === "string" ? body.psnAccountId : null;

  let psnAccount = null;

  // Resolve the Epic delivery account. Unlike PSN it is NOT hard-required: a
  // customer can buy an Epic game together with the account-creation service
  // (the account is created on fulfillment), in which case epicAccount stays
  // null and the admin links it later.
  const requestedEpicId =
    typeof body.epicAccountId === "string" ? body.epicAccountId : null;
  let epicAccount = null;
  if (needsEpic) {
    if (requestedEpicId) {
      epicAccount = await prisma.epicAccount.findUnique({ where: { id: requestedEpicId } });
      if (!epicAccount || epicAccount.userId !== user.id) {
        return NextResponse.json({ error: "Invalid Epic account" }, { status: 400 });
      }
    } else {
      epicAccount = await prisma.epicAccount.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
    }
    const hasEpicCreation = lines.some((l) => l.kind === "EPIC_ACCOUNT_CREATION");
    if (!epicAccount && !hasEpicCreation) {
      return NextResponse.json(
        {
          error:
            "Epic oyununu almaq üçün Türkiyə Epic hesabı seçin və ya hesab açılışını sifarişə əlavə edin.",
          code: "NO_EPIC_ACCOUNT",
        },
        { status: 400 }
      );
    }
  }

  // PSN hesab açılışı eyni səbətdədirsə, mövcud PSN tələbi yumşalır: yeni
  // yaradılan hesab admin tərəfindən fulfillment vaxtı oyun sifarişlərinə
  // bağlanacaq. Bu, Epic üçün mövcud `hasEpicCreation` məntiqinin PSN qarşılığıdır.
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

  // Epoint-in minimum işləm məbləği 5 AZN-dir. Sebet bundan azdırsa ödənişi
  // bloklamaq əvəzinə KARTDAN minimum 5 AZN tutub aradakı fərqi müştərinin
  // cüzdanına kredit olaraq qaytarırıq (round-up to wallet). Beləcə 4.98 kimi
  // məbləğlərdə müştəri "azca da məhsul əlavə et" tələsinə düşmür — fərq
  // növbəti alış üçün balansda qalır. Cüzdan/referal ödənişlərində gateway
  // yoxdur, ona görə round-up mənasızdır: dəqiq sebet məbləği tutulur.
  const isCardPayment =
    body.paymentMethod === "epoint" || body.paymentMethod === "epoint-widget";
  const chargeCents = isCardPayment
    ? Math.max(totalCents, MIN_CART_AZN_CENTS)
    : totalCents;
  const topUpCents = chargeCents - totalCents;

  const spentAzn = await getLifetimeSpendAznForLoyalty(prisma, user.id);
  const loyalty = getLoyaltyTier(spentAzn);

  if (body.paymentMethod === "epoint" || body.paymentMethod === "epoint-widget") {
    const useWidget = body.paymentMethod === "epoint-widget";
    const config = getEpointConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Epoint açarları qurulmayıb: EPOINT_PUBLIC_KEY və EPOINT_PRIVATE_KEY lazımdır." },
        { status: 503 },
      );
    }

    const orderCode = `HON-${randomBytes(3).toString("hex").toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const snapshotLines: EpointCartLineSnapshot[] = lines.map((line) => {
      if (line.kind === "GAME") {
        const isEpicGame = line.game.store === "EPIC";
        return {
          kind: "GAME",
          title: line.game.title,
          qty: line.qty,
          gameId: line.game.id,
          unitListCents: line.unitListCents,
          unitSavingsCents: line.unitSavingsCents,
          unitCostCents: line.unitCostCents,
          psnAccountId: isEpicGame ? null : (psnAccount?.id ?? null),
          epicAccountId: isEpicGame ? epicAccount?.id ?? null : null,
          store: isEpicGame ? "EPIC" : "PS",
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

      if (line.kind === "EPIC_ACCOUNT_CREATION") {
        return {
          kind: "EPIC_ACCOUNT_CREATION",
          title: line.service.title,
          qty: line.qty,
          serviceProductId: line.service.id,
          unitListCents: line.unitListCents,
          epicAccountId: epicAccount?.id ?? null,
          detail: {
            firstName: line.detail.firstName,
            lastName: line.detail.lastName,
            birthDate: line.detail.birthDate,
            email: line.detail.email,
            password: line.detail.password,
            displayName: line.detail.displayName,
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
      };
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
        totalCents,
        topUpCents,
        loyalty: {
          label: loyalty.label,
          cashbackPct: loyalty.cashbackPct,
        },
        lines: snapshotLines,
      },
    };

    // Karta minimum 5 AZN (chargeCents) tutulur. amountAznCents = chargeCents
    // saxlanır ki, /result və /reconcile-dakı amount-mismatch yoxlaması
    // epoint-in bildirdiyi məbləğlə üst-üstə düşsün. Məhsul fulfillment-i və
    // cashback isə metadata.checkout.totalCents (real sebet) üzərindən gedir.
    const payment = await prisma.transaction.create({
      data: {
        userId: user.id,
        type: EPOINT_CART_PAYMENT_TYPE,
        status: "PENDING",
        amountAznCents: chargeCents,
        metadata: JSON.stringify(metadata),
      },
      select: { id: true },
    });

    const origin = requestOrigin(req);
    const amountAzn = Number((chargeCents / 100).toFixed(2));
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
      checkout = await createEpointCheckout(
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
          },
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      paymentMethod: "epoint",
      orderId: payment.id,
      orderCode,
      redirectUrl: checkout.redirect_url,
    });
  }

  if (paymentSource === "referral") {
    if (user.referralBalanceCents < totalCents) {
      return NextResponse.json(
        {
          error: "Referal balansı kifayət etmir.",
          requiredAzn: totalCents / 100,
          referralBalanceAzn: user.referralBalanceCents / 100,
        },
        { status: 402 }
      );
    }
  } else if (user.walletBalance < totalCents) {
    return NextResponse.json(
      {
        error: "Cüzdan balansı kifayət etmir.",
        requiredAzn: totalCents / 100,
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

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const orderCode = `HON-${randomBytes(3).toString("hex").toUpperCase()}`;

      await tx.user.update({
        where: { id: user.id },
        data:
          paymentSource === "referral"
            ? { referralBalanceCents: { decrement: totalCents } }
            : { walletBalance: { decrement: totalCents } },
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
      const attachEpic = epicAccount?.id ?? null;

      for (const line of lines) {
        for (let n = 0; n < line.qty; n++) {
          if (line.kind === "GAME") {
            const isEpicGame = line.game.store === "EPIC";
            const purchase = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                savingsAznCents: line.unitSavingsCents,
                costAznCents: line.unitCostCents,
                gameId: line.game.id,
                psnAccountId: isEpicGame ? null : (psnAccount?.id ?? null),
                epicAccountId: isEpicGame ? attachEpic : null,
                metadata: JSON.stringify({
                  paymentSource: payTag,
                  fromCart: true,
                  manualDelivery: true,
                  fulfillmentStage: "NEW",
                  store: isEpicGame ? "EPIC" : "PS",
                  orderCode,
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
                  firstName: names.firstName,
                  lastName: names.lastName,
                  birthDate: line.detail.birthDate,
                  email: line.detail.email,
                  password: line.detail.password,
                }),
              },
            });
            serviceOrderIds.push(serviceOrder.id);
          } else if (line.kind === "EPIC_ACCOUNT_CREATION") {
            const serviceOrder = await tx.transaction.create({
              data: {
                userId: user.id,
                type: "SERVICE_PURCHASE",
                status: "PENDING",
                amountAznCents: -line.unitListCents,
                serviceProductId: line.service.id,
                epicAccountId: attachEpic,
                metadata: JSON.stringify({
                  fromCart: true,
                  kind: "EPIC_ACCOUNT_CREATION",
                  paymentSource: payTag,
                  orderCode,
                  firstName: line.detail.firstName,
                  lastName: line.detail.lastName,
                  birthDate: line.detail.birthDate,
                  email: line.detail.email,
                  password: line.detail.password,
                  displayName: line.detail.displayName,
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
                  ...(line.gmail ? { gmail: line.gmail } : {}),
                  ...(line.password ? { customerPassword: line.password } : {}),
                  ...(line.accounts?.length ? { accounts: line.accounts } : {}),
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
        cashbackCents = Math.round((totalCents * loyalty.cashbackPct) / 100);
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
      };
    });
  } catch (e: unknown) {
    throw e;
  }

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

  let newWalletCents = user.walletBalance;
  let newReferralCents = user.referralBalanceCents;
  if (paymentSource === "wallet") {
    newWalletCents = user.walletBalance - totalCents;
    newReferralCents = user.referralBalanceCents;
  } else {
    newWalletCents = user.walletBalance;
    newReferralCents = user.referralBalanceCents - totalCents;
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
    paidAzn: totalCents / 100,
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
