/**
 * Mağaza əhatəsi — hazırda YALNIZ PlayStation məhsulları satılır.
 *
 * Qeyri-PS kateqoriyaların (Epic, streaming, musiqi, AI, PUBG UC, Point Blank,
 * LinkedIn, Honsell gift card, website xidməti) səhifələri SİLİNMİR — sadəcə:
 *   - landing/naviqasiya/axtarışdan onlara keçid verilmir,
 *   - səbətə düşmüş qeyri-PS sətir `/api/cart/refresh`-də `missing` olur,
 *   - checkout həmin sətirləri tanımır ("artıq mövcud deyil" cavabı).
 *
 * Client-safe SAF modul (prisma import ETMƏ — "use client" komponentlər oxuyur).
 *
 * Geri qaytarmaq: `NEXT_PUBLIC_STORE_SCOPE=ALL` (build-time env, `next build`
 * yenidən lazımdır) — bütün süzgəclər no-op olur.
 */

export const STORE_SCOPE: "PLAYSTATION" | "ALL" =
  process.env.NEXT_PUBLIC_STORE_SCOPE?.trim().toUpperCase() === "ALL" ? "ALL" : "PLAYSTATION";

export const PLAYSTATION_ONLY = STORE_SCOPE === "PLAYSTATION";

/** Satılan `ServiceProduct.type`-lar. `ACCOUNT_CREATION` = Türkiyə PSN hesabı. */
export const PLAYSTATION_SERVICE_TYPES: readonly string[] = [
  "PS_PLUS",
  "EA_PLAY",
  "TRY_BALANCE",
  "ACCOUNT_CREATION",
];

/** Naviqasiyada qalan kateqoriyalar (`lib/categoryAssets.ts` açarları). */
export const PLAYSTATION_CATEGORY_KEYS: readonly string[] = [
  "PLAYSTATION_GAMES",
  "PS_PLUS",
  "PS_TRY_GIFT_CARD",
  "PSN_TURKEY_ACCOUNT",
  "EA_PLAY",
];

const SERVICE_TYPE_SET = new Set(PLAYSTATION_SERVICE_TYPES);
const CATEGORY_KEY_SET = new Set(PLAYSTATION_CATEGORY_KEYS);

export function isSellableServiceType(type: string | null | undefined): boolean {
  if (!PLAYSTATION_ONLY) return true;
  return SERVICE_TYPE_SET.has(String(type ?? ""));
}

/** `Game.store` NOT NULL, default "PS". Epic oyunları satılmır. */
export function isSellableGameStore(store: string | null | undefined): boolean {
  if (!PLAYSTATION_ONLY) return true;
  return (store ?? "PS") === "PS";
}

export function isVisibleCategoryKey(key: string): boolean {
  if (!PLAYSTATION_ONLY) return true;
  return CATEGORY_KEY_SET.has(key);
}

/** Prisma `where` fraqmenti — oyun sorğularına yayılır: `{ ...sellableGameWhere() }`. */
export function sellableGameWhere(): { store?: string } {
  return PLAYSTATION_ONLY ? { store: "PS" } : {};
}

/**
 * Daxili keçid PS əhatəsindədirmi (banner `linkUrl` kimi sərbəst linklər üçün).
 * Xarici linklərə və məhsul olmayan səhifələrə (faq, icma, profil) toxunmur —
 * yalnız bağlanmış kateqoriyaların path prefikslərini rədd edir.
 */
const CLOSED_PATH_PREFIXES = [
  "/epic-games",
  "/streaming",
  "/music",
  "/ai",
  "/work",
  "/pubg-uc",
  "/point-blank",
  "/hediyye-kartlari/honsell",
  "/xidmetler",
  "/xidmet-paket",
];

export function isOpenStorePath(href: string | null | undefined): boolean {
  if (!PLAYSTATION_ONLY || !href) return true;
  let path = href.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      // Yalnız öz domenimizin linklərini yoxlayırıq.
      if (!/(^|\.)honsell\.(site|store)$/i.test(u.hostname)) return true;
      path = u.pathname;
    } catch {
      return true;
    }
  }
  if (!path.startsWith("/")) return true;
  return !CLOSED_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}
