import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, isLikelyBot, isSameSiteRequest } from "@/lib/analyticsServer";
import { allowTrackRequest } from "@/lib/trackRateLimit";
import {
  decodeTouch,
  isEventName,
  isSafeId,
  normalizePath,
  touchChannel,
  truncate,
  MAX_BEACON_BYTES,
  MAX_CAMPAIGN_LEN,
  MAX_EVENTS_PER_BEACON,
  MAX_PATH_LEN,
  MAX_QUERY_LEN,
  type Touch,
} from "@/lib/analyticsShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Analitika beacon-u.
 *
 * NİYƏ ADI `/api/t`-DİR: uBlock/EasyPrivacy siyahıları `/track`, `/collect`,
 * `/analytics` yol seqmentlərini avtomatik bloklayır. Qısa ad bu filtrlərə
 * düşmür. Yenə də 10–25% itki gözlənilir — problem deyil, çünki **beacon
 * huninin yuxarısını ölçür, pulu isə `OrderAttribution` ölçür** (FAZA 3).
 * Yəni gəlir rəqəmi reklam blokerdən asılı deyil.
 *
 * Həmişə 204 qaytarır: `sendBeacon` cavabı oxumur, xəta qaytarmaq isə yalnız
 * brauzer konsolunu zibilləyər.
 */

type IncomingEvent = {
  id?: unknown;
  name?: unknown;
  path?: unknown;
  productId?: unknown;
  productType?: unknown;
  valueAznCents?: unknown;
  query?: unknown;
};

/** Hər dəfə TƏZƏ cavab qaytarılır — Response obyekti təkrar istifadə oluna bilməz. */
function noContent() {
  return new NextResponse(null, { status: 204 });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? truncate(trimmed, max) : null;
}

function intOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  // Absurd dəyərlər hesabatı sındırır — məhdudlaşdırılır.
  if (n < 0 || n > 100_000_000) return null;
  return n;
}

export async function POST(req: Request) {
  if (!isSameSiteRequest(req)) return noContent();

  // Body ölçüsü — oxumadan ƏVVƏL yoxlanılır ki, nəhəng payload yaddaşa düşməsin.
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BEACON_BYTES) return noContent();

  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BEACON_BYTES) return noContent();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return noContent();
  }

  const visitorId = body.vid;
  const sessionId = body.sid;
  if (!isSafeId(visitorId) || !isSafeId(sessionId)) return noContent();

  const incoming = Array.isArray(body.events) ? body.events : [];
  if (incoming.length === 0) return noContent();
  const events = incoming.slice(0, MAX_EVENTS_PER_BEACON) as IncomingEvent[];

  const ip = clientIp(req);
  if (!allowTrackRequest(ip, events.length)) return noContent();

  const isBot = isLikelyBot(req.headers.get("user-agent"));

  // İlk toxunuş heç vaxt üzərinə yazılmır; son toxunuş yalnız yeni xarici
  // mənbədə yenilənir. Hər ikisi client-də cookie-yə yazılır, burada yalnız
  // oxunur — statik səhifə keşinə toxunmamaq üçün (bax: docs/PERFORMANCE.md).
  const firstTouch: Touch | null = decodeTouch(str(body.ft, 600));
  const lastTouch: Touch | null = decodeTouch(str(body.lt, 600));
  const firstChannel = touchChannel(firstTouch);
  const lastChannel = touchChannel(lastTouch ?? firstTouch);

  const landingPath = normalizePath(
    firstTouch?.landingPath ?? str(body.land, MAX_PATH_LEN) ?? "/",
  );

  const user = await getCurrentUser().catch(() => null);
  const userId = user?.id ?? null;

  // Seans bayraqları — huni addımları. 0/1, `Int` (bax: sxemdəki şərh).
  let sawProduct = 0;
  let addedToCart = 0;
  let beganCheckout = 0;
  let purchased = 0;
  let pageViews = 0;

  const rows = [];
  for (const ev of events) {
    if (!isSafeId(ev.id)) continue;
    if (!isEventName(ev.name)) continue;

    const name = ev.name;
    if (name === "page_view") pageViews += 1;
    if (name === "view_item") sawProduct = 1;
    if (name === "add_to_cart") addedToCart = 1;
    if (name === "begin_checkout") beganCheckout = 1;
    if (name === "purchase") purchased = 1;

    rows.push({
      id: ev.id,
      visitorId,
      sessionId,
      userId,
      name,
      path: normalizePath(str(ev.path, MAX_PATH_LEN)),
      productId: str(ev.productId, 64),
      productType: str(ev.productType, 32),
      valueAznCents: intOrNull(ev.valueAznCents),
      query: name === "search" ? str(ev.query, MAX_QUERY_LEN) : null,
      channel: lastChannel,
      isBot,
    });
  }

  if (rows.length === 0) return noContent();

  try {
    await prisma.$transaction([
      // `skipDuplicates` + client tərəfdə yaradılan id → beacon təkrarı
      // idempotentdir (sendBeacon dublikat göndərə bilər).
      prisma.analyticsEvent.createMany({ data: rows, skipDuplicates: true }),
      prisma.analyticsSession.upsert({
        where: { visitorId_sessionId: { visitorId, sessionId } },
        create: {
          visitorId,
          sessionId,
          userId,
          firstChannel,
          firstSource: firstTouch?.source ?? null,
          firstMedium: firstTouch?.medium ?? null,
          firstCampaign: truncateOrNull(firstTouch?.campaign, MAX_CAMPAIGN_LEN),
          firstReferrerHost: firstTouch?.referrerHost ?? null,
          firstLandingPath: landingPath,
          lastChannel,
          lastSource: lastTouch?.source ?? null,
          lastMedium: lastTouch?.medium ?? null,
          lastCampaign: truncateOrNull(lastTouch?.campaign, MAX_CAMPAIGN_LEN),
          lastReferrerHost: lastTouch?.referrerHost ?? null,
          landingPath,
          pageViews,
          sawProduct,
          addedToCart,
          beganCheckout,
          purchased,
          isBot,
        },
        update: {
          // ⚠️ `first*` sahələri BURADA YENİLƏNMİR — ilk toxunuş dəyişməzdir.
          // Yalnız son toxunuş, sayğac və huni bayraqları irəli gedir.
          ...(userId ? { userId } : {}),
          lastChannel,
          lastSource: lastTouch?.source ?? null,
          lastMedium: lastTouch?.medium ?? null,
          lastCampaign: truncateOrNull(lastTouch?.campaign, MAX_CAMPAIGN_LEN),
          lastReferrerHost: lastTouch?.referrerHost ?? null,
          ...(pageViews > 0 ? { pageViews: { increment: pageViews } } : {}),
          // Bayraq yalnız 0 → 1 istiqamətində hərəkət edir.
          ...(sawProduct ? { sawProduct: 1 } : {}),
          ...(addedToCart ? { addedToCart: 1 } : {}),
          ...(beganCheckout ? { beganCheckout: 1 } : {}),
          ...(purchased ? { purchased: 1 } : {}),
        },
      }),
    ]);
  } catch (e) {
    // Eyni tabdan iki beacon eyni anda gəlsə unikal indeksdə toqquşur (P2002).
    // Bir dəfə təkrar edirik; yenə alınmasa event-lər onsuz da yazılıb.
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      await prisma.analyticsSession
        .update({
          where: { visitorId_sessionId: { visitorId, sessionId } },
          data: {
            ...(pageViews > 0 ? { pageViews: { increment: pageViews } } : {}),
            ...(sawProduct ? { sawProduct: 1 } : {}),
            ...(addedToCart ? { addedToCart: 1 } : {}),
            ...(beganCheckout ? { beganCheckout: 1 } : {}),
            ...(purchased ? { purchased: 1 } : {}),
          },
        })
        .catch(() => null);
    }
    // Analitika heç vaxt istifadəçi axınını pozmamalıdır — səssiz udulur.
  }

  return noContent();
}

function truncateOrNull(v: string | null | undefined, max: number): string | null {
  if (!v) return null;
  return truncate(v, max);
}
