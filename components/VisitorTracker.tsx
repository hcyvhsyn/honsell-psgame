"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  SESSION_COOKIE,
  SESSION_IDLE_MS,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  encodeTouch,
  normalizeHost,
  normalizePath,
  type Touch,
} from "@/lib/analyticsShared";
import { readCookie, trackEvent, writeCookie } from "@/lib/track";

/**
 * Ziyarətçi kimliyi + mənbə (first/last touch) + page_view.
 *
 * NİYƏ MIDDLEWARE-DƏ DEYİL (ən vacib qərar):
 * Cloudflare HTML-i edge-də keşləyir (bax: docs/PERFORMANCE.md). Keş HIT olanda
 * origin ÇAĞIRILMIR — yəni middleware işləmir və yeni ziyarətçi heç bir cookie
 * almazdı. Üstəlik `Set-Cookie` qaytaran cavab CF-də keşlənməz olur, yəni
 * matcher-i `/`-ə genişlətsək anasayfa edge keşi ölərdi.
 *
 * Ona görə kimlik YALNIZ brauzerdə qurulur. Server tərəfdə bu cookie-lər
 * yalnız route handler-lərdə (`/api/t`, `/api/cart/checkout`) oxunur — onlar
 * onsuz da keşlənmir. Beləcə "statik səhifə ağacına `cookies()` qoyma" qaydası
 * pozulmur.
 */

const SESSION_STORAGE_KEY = "hs_session";
const VISITOR_STORAGE_KEY = "hs_visitor";

const CLIENT_BOT_PATTERN =
  /bot|crawl|spider|headless|phantomjs|puppeteer|playwright|selenium|lighthouse/i;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Safari private mode / storage bloklanıb.
    return null;
  }
}

function safeLocalSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // səssiz
  }
}

/** Cookie → localStorage → yeni. Hər ikisinə geri yazılır (biri silinsə digəri qalır). */
function resolveVisitorId(): string {
  const id =
    readCookie(VISITOR_COOKIE) ?? safeLocalGet(VISITOR_STORAGE_KEY) ?? randomId();
  writeCookie(VISITOR_COOKIE, id, VISITOR_COOKIE_MAX_AGE);
  safeLocalSet(VISITOR_STORAGE_KEY, id);
  return id;
}

/** 30 dəqiqəlik sürüşən pəncərə — hunidə məxrəci bu təyin edir. */
function resolveSessionId(now: number): string {
  let sid: string | null = null;
  const stored = safeLocalGet(SESSION_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { sid?: string; exp?: number };
      if (parsed.sid && typeof parsed.exp === "number" && parsed.exp > now) {
        sid = parsed.sid;
      }
    } catch {
      sid = null;
    }
  }
  if (!sid) sid = randomId();

  const exp = now + SESSION_IDLE_MS;
  safeLocalSet(SESSION_STORAGE_KEY, JSON.stringify({ sid, exp }));
  // Cookie də yazılır ki, checkout route-u seansı görə bilsin.
  writeCookie(SESSION_COOKIE, sid, Math.ceil(SESSION_IDLE_MS / 1000));
  return sid;
}

/**
 * Cari ziyarətin mənbəyi. `null` qaytarırsa bu, YENİ bir toxunuş deyil (daxili
 * naviqasiya və ya birbaşa giriş) — son toxunuş SAXLANILIR.
 *
 * ⚠️ Bu funksiyanın `null` qaytarması ən vacib davranışdır: əks halda
 * Instagram-dan gələn müştəri sayt içində bir səhifə keçən kimi "birbaşa"ya
 * çevrilər və gəlir yanlış kanala yazılardı.
 */
function currentTouch(params: URLSearchParams, now: number): Touch | null {
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");

  const referrerHost = normalizeHost(document.referrer || null);
  const selfHost = normalizeHost(location.hostname);
  const isExternal = Boolean(
    referrerHost && selfHost && referrerHost !== selfHost,
  );

  if (!utmSource && !utmMedium && !isExternal) return null;

  return {
    source: utmSource,
    medium: utmMedium,
    campaign: utmCampaign,
    referrerHost: isExternal ? referrerHost : null,
    landingPath: normalizePath(location.pathname),
    at: now,
  };
}

export default function VisitorTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const identityReady = useRef(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Bot filtri, birinci qat. Server tərəfdə də yoxlanılır (isLikelyBot) —
    // bu, sadəcə lazımsız request-i qabaqlayır.
    if (navigator.webdriver) return;
    if (CLIENT_BOT_PATTERN.test(navigator.userAgent)) return;

    const now = Date.now();

    if (!identityReady.current) {
      resolveVisitorId();
      resolveSessionId(now);

      const touch = currentTouch(
        new URLSearchParams(searchParams?.toString() ?? ""),
        now,
      );
      if (touch) {
        const encoded = encodeTouch(touch);
        // İlk toxunuş bir dəfə yazılır və HEÇ VAXT üzərinə yazılmır.
        if (!readCookie(FIRST_TOUCH_COOKIE)) {
          writeCookie(FIRST_TOUCH_COOKIE, encoded, VISITOR_COOKIE_MAX_AGE);
        }
        writeCookie(LAST_TOUCH_COOKIE, encoded, VISITOR_COOKIE_MAX_AGE);
      }

      identityReady.current = true;
    } else {
      // Naviqasiyada yalnız seansın müddəti uzadılır.
      resolveSessionId(now);
    }

    // Eyni yol üçün təkrar page_view göndərilmir (searchParams dəyişikliyi
    // filtr/səhifələmə ola bilər).
    const path = normalizePath(pathname);
    if (lastPath.current === path) return;
    lastPath.current = path;

    trackEvent("page_view", { path });
  }, [pathname, searchParams]);

  return null;
}
