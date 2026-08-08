import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  SESSION_COOKIE as ANALYTICS_SESSION_COOKIE,
  VISITOR_COOKIE,
  decodeTouch,
  isSafeId,
  normalizePath,
  touchChannel,
  truncate,
  MAX_CAMPAIGN_LEN,
  type Touch,
} from "@/lib/analyticsShared";

/**
 * Sifariş → kanal damğası (server tərəf).
 *
 * NİYƏ `Transaction.metadata`-ya YAZILMIR:
 * `app/api/cart/checkout/route.ts`-də ~25, `lib/epointCartCheckout.ts`-də ~25
 * ədəd `metadata: JSON.stringify({...})` literalı var. Atributsiya sahələrini
 * onların hamısına əlavə etmək 1939 sətrlik PUL EMAL EDƏN faylda 50 redaktə
 * deməkdir — hesabat üçün qəbuledilməz risk. Üstəlik hesabat
 * `metadata: { contains }` LIKE skanına çevrilərdi.
 *
 * Əvəzinə: ayrıca `OrderAttribution` cədvəli + `Transaction.orderCode` join
 * açarı. Yazma nöqtəsi cəmi ikidir (cüzdan və kart yolu).
 *
 * ⚠️ Bu funksiyalar HEÇ VAXT xəta atmır. Atributsiya hesabat rahatlığıdır;
 * ona görə checkout sınmamalıdır.
 */

/** Client `attributionPayload()`-dan göndərdiyi ehtiyat nüsxə. */
type BodyAttribution = {
  vid?: unknown;
  sid?: unknown;
  ft?: unknown;
  lt?: unknown;
};

function safeStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? truncate(trimmed, max) : null;
}

export type ResolvedAttribution = {
  visitorId: string | null;
  sessionId: string | null;
  firstTouch: Touch | null;
  lastTouch: Touch | null;
};

/**
 * Cookie-dən (əsas) və body-dən (ehtiyat) ziyarətçi kimliyini və toxunuşları
 * oxuyur.
 *
 * Cookie-ni burada oxumaq QANUNİDİR: `/api/cart/checkout` bir route handler-dir
 * və heç vaxt keşlənmir. Qadağa yalnız statik səhifə ağacına aiddir
 * (bax: docs/PERFORMANCE.md, CLAUDE.md).
 */
export async function resolveAttribution(
  body: unknown,
): Promise<ResolvedAttribution> {
  const fallback = ((body as { attribution?: BodyAttribution } | null)
    ?.attribution ?? {}) as BodyAttribution;

  let jarVisitor: string | null = null;
  let jarSession: string | null = null;
  let jarFirst: string | null = null;
  let jarLast: string | null = null;

  try {
    const jar = await cookies();
    jarVisitor = jar.get(VISITOR_COOKIE)?.value ?? null;
    jarSession = jar.get(ANALYTICS_SESSION_COOKIE)?.value ?? null;
    jarFirst = jar.get(FIRST_TOUCH_COOKIE)?.value ?? null;
    jarLast = jar.get(LAST_TOUCH_COOKIE)?.value ?? null;
  } catch {
    // Cookie oxunmadısa body-dəki nüsxə ilə davam edirik.
  }

  const visitorRaw = jarVisitor ?? safeStr(fallback.vid, 64);
  const sessionRaw = jarSession ?? safeStr(fallback.sid, 64);

  const firstTouch = decodeTouch(jarFirst ?? safeStr(fallback.ft, 600));
  const lastTouch = decodeTouch(jarLast ?? safeStr(fallback.lt, 600));

  return {
    visitorId: isSafeId(visitorRaw) ? visitorRaw : null,
    sessionId: isSafeId(sessionRaw) ? sessionRaw : null,
    firstTouch,
    lastTouch,
  };
}

/**
 * `OrderAttribution` sətrini yazır. Sifariş kodu unikaldır — təkrar çağırış
 * (məs. epoint yenidən cəhd) səssizcə keçilir.
 *
 * Atributsiya YOXDURSA da sətir yazılır (`direct` kanalı ilə): hesabatda
 * "Mənbəsi bilinməyən" sətri yalnız `OrderAttribution`-ı ÜMUMİYYƏTLƏ olmayan
 * köhnə sifarişlərə aid olsun deyə.
 */
export async function recordOrderAttribution(params: {
  orderCode: string;
  userId: string;
  paymentMethod: string;
  orderTotalAznCents: number;
  attribution: ResolvedAttribution;
}): Promise<void> {
  const { attribution: a } = params;
  const firstChannel = touchChannel(a.firstTouch);
  const lastChannel = touchChannel(a.lastTouch ?? a.firstTouch);

  try {
    await prisma.orderAttribution.create({
      data: {
        orderCode: params.orderCode,
        userId: params.userId,
        visitorId: a.visitorId,
        sessionId: a.sessionId,

        firstChannel,
        firstSource: a.firstTouch?.source ?? null,
        firstMedium: a.firstTouch?.medium ?? null,
        firstCampaign: a.firstTouch?.campaign
          ? truncate(a.firstTouch.campaign, MAX_CAMPAIGN_LEN)
          : null,
        firstReferrerHost: a.firstTouch?.referrerHost ?? null,
        firstLandingPath: a.firstTouch?.landingPath
          ? normalizePath(a.firstTouch.landingPath)
          : null,

        lastChannel,
        lastSource: a.lastTouch?.source ?? null,
        lastMedium: a.lastTouch?.medium ?? null,
        lastCampaign: a.lastTouch?.campaign
          ? truncate(a.lastTouch.campaign, MAX_CAMPAIGN_LEN)
          : null,
        lastReferrerHost: a.lastTouch?.referrerHost ?? null,

        paymentMethod: truncate(params.paymentMethod, 32),
        orderTotalAznCents: Math.max(0, Math.round(params.orderTotalAznCents)),
      },
    });
  } catch {
    // Unikal konflikt və ya DB problemi — checkout dayanmamalıdır.
  }
}

/**
 * Sifarişin bütün `Transaction` sətirlərinə `orderCode` damğası vurur.
 *
 * TƏK `updateMany` — 50 ədəd `metadata` literalına toxunmadan. Hesabat bundan
 * sonra sadə join olur: `Transaction JOIN OrderAttribution ON orderCode`.
 */
export async function stampOrderCode(
  transactionIds: string[],
  orderCode: string,
): Promise<void> {
  const ids = transactionIds.filter(Boolean);
  if (ids.length === 0) return;
  try {
    await prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data: { orderCode },
    });
  } catch {
    // Hesabat damğası — sifarişi sındırmamalıdır.
  }
}
