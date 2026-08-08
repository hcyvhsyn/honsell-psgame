/**
 * Analitika event növbəsi (client).
 *
 * ⚠️ BU FAYL YALNIZ `lib/analyticsShared.ts`-dən import edir. Səbəb: onu
 * `lib/cart.tsx` çağırır, `lib/cart.tsx`-i isə `app/layout.tsx` — yəni HƏR
 * səhifə. Tranzitiv `lib/prisma` import-u `next build`-i sındırır (`tsc` təmiz
 * keçdiyi üçün xəta yalnız build-də görünür).
 *
 * Dizayn: event-lər yaddaşda yığılır və partiya halında göndərilir. Hər event
 * üçün ayrıca sorğu göndərmək səhifə naviqasiyasında onlarla request yaradardı.
 */

import {
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  MAX_EVENTS_PER_BEACON,
  SESSION_COOKIE,
  VISITOR_COOKIE,
  normalizePath,
  type EventName,
} from "@/lib/analyticsShared";

const ENDPOINT = "/api/t";
const FLUSH_DEBOUNCE_MS = 2000;

type QueuedEvent = {
  id: string;
  name: EventName;
  path: string;
  productId?: string;
  productType?: string;
  valueAznCents?: number;
  query?: string;
};

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Köhnə brauzer / güvənsiz kontekst (http://) üçün ehtiyat variant.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]!) : null;
}

export function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}` +
    `; SameSite=Lax${secure}`;
}

/**
 * Checkout POST-una qoşulan atributsiya yükü.
 *
 * Server əvvəlcə cookie-yə baxır, bu isə EHTİYATdır: cookie itibsə (ITP, üçüncü
 * tərəf bloker, gizli rejim), amma `localStorage` sağdırsa sifariş yenə də öz
 * kanalına yazılır. Boş obyekt qaytara bilər — server onu problem saymır.
 */
export function attributionPayload(): Record<string, string> {
  const out: Record<string, string> = {};
  const vid = readCookie(VISITOR_COOKIE);
  const sid = readCookie(SESSION_COOKIE);
  const ft = readCookie(FIRST_TOUCH_COOKIE);
  const lt = readCookie(LAST_TOUCH_COOKIE);
  if (vid) out.vid = vid;
  if (sid) out.sid = sid;
  if (ft) out.ft = ft;
  if (lt) out.lt = lt;
  return out;
}

function bindFlushListeners() {
  if (listenersBound || typeof document === "undefined") return;
  listenersBound = true;

  // `visibilitychange → hidden` mobil brauzerlərdə səhifənin bağlanmasını
  // tutan YEGANƏ etibarlı hadisədir (`beforeunload` iOS-da atəşlənmir).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", () => flush());
}

/**
 * Növbəni serverə göndərir. `sendBeacon` səhifə bağlanarkən də çatdırılmanı
 * davam etdirir; olmayan brauzerlərdə `keepalive: true` ilə `fetch`
 * (`lib/cart.tsx`-dəki cart-sync ilə eyni nümunə).
 */
export function flush() {
  if (typeof window === "undefined" || queue.length === 0) return;

  const events = queue.slice(0, MAX_EVENTS_PER_BEACON);
  queue = queue.slice(MAX_EVENTS_PER_BEACON);

  const vid = readCookie(VISITOR_COOKIE);
  const sid = readCookie(SESSION_COOKIE);
  // Kimlik hələ qurulmayıbsa (VisitorTracker mount olmayıb) event atılır —
  // sessiyasız sətir hesabatda heç nəyə qoşula bilməz.
  if (!vid || !sid) return;

  const payload = JSON.stringify({
    v: 1,
    vid,
    sid,
    ft: readCookie(FIRST_TOUCH_COOKIE),
    lt: readCookie(LAST_TOUCH_COOKIE),
    land: normalizePath(location.pathname),
    events,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analitika heç vaxt səhifəni sındırmamalıdır.
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * Event növbəyə əlavə edir. Heç vaxt xəta atmır — çağıran yerlərdə (səbətə
 * əlavə, checkout) try/catch yazmağa ehtiyac yoxdur.
 *
 * Ödənişli reklam başlayanda Meta/TikTok Pixel qarmağı MƏHZ BURAYA qoyulur:
 * bir `if` ilə eyni event həm bizim bazaya, həm pixel-ə gedər. Ayrıca
 * instrumentasiya lazım deyil.
 */
export function trackEvent(
  name: EventName,
  props: Omit<QueuedEvent, "id" | "name" | "path"> & { path?: string } = {},
) {
  if (typeof window === "undefined") return;
  try {
    bindFlushListeners();
    queue.push({
      id: randomId(),
      name,
      path: normalizePath(props.path ?? location.pathname),
      ...(props.productId ? { productId: props.productId } : {}),
      ...(props.productType ? { productType: props.productType } : {}),
      ...(typeof props.valueAznCents === "number"
        ? { valueAznCents: props.valueAznCents }
        : {}),
      ...(props.query ? { query: props.query } : {}),
    });

    // Pul hadisələri gözləmir — səhifə dərhal bağlana bilər.
    if (name === "purchase" || name === "begin_checkout") flush();
    else scheduleFlush();
  } catch {
    // səssiz
  }
}
