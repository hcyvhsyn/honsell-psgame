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
 *
 * İstisna — **Spotify** (2026-10): `PLATFORM` tipindən YALNIZ `metadata.musicBrand = "SPOTIFY"`
 * olan məhsullar satılır (sifariş ödənişdən sonra CRM-ə gedir, `lib/crmSpotify.ts`).
 * Qalan PLATFORM məhsulları (YouTube, AI, LinkedIn) bağlı qalır. Ona görə məhsul
 * səviyyəli yoxlama lazımdır: `isSellableServiceProduct` / `sellableServiceWhere()` —
 * yalnız `type`-a baxan `isSellableServiceType` Spotify-ı tanımır.
 *
 * İstisna — **Netflix** (2026-11): `STREAMING` tipindən YALNIZ `NETFLIX_SERVICE_CODES`
 * (`metadata.service`) satılır: öz hesabına plan (Basic/Standart/Premium) və bizim hesabda otaq
 * (Yanımda/Evimdə/Evimdə VIP). Sifariş ödənişdən sonra CRM-ə gedir (`lib/crmNetflix.ts`).
 * HBO, Gain, Prime və `/streaming` kataloqu bağlı qalır.
 *
 * İstisna — **admin-dən açılan streaming xidmətləri** (2026-11): `/admin/streaming`-də xidmətin
 * "Saytda satılır" açarı (`StreamingPlatform.storeSellable`) paketlərin metadata-sına
 * `storeSellable: true` kimi köçürülür (lib/streamingAccess.ts). Netflix bu bayraqdan asılı deyil.
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
  "SPOTIFY",
  "NETFLIX",
];

/** Spotify Premium məhsulu: `PLATFORM` + `metadata.musicBrand = "SPOTIFY"`. */
export const SPOTIFY_MUSIC_BRAND = "SPOTIFY";
export const SPOTIFY_STORE_PATH = "/music/spotify-premium";

export function isSpotifyProduct(type: string | null | undefined, metadata: unknown): boolean {
  if (type !== "PLATFORM" || !metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).musicBrand === SPOTIFY_MUSIC_BRAND;
}

/** Netflix giriş səhifəsi: 2 seçimli ekran (öz hesabın / bizim hesabda otaq). */
export const NETFLIX_STORE_PATH = "/streaming/netflix";

/** Müştərinin öz hesabına qoşulan plan (Basic/Standart/Premium). */
export const NETFLIX_ACCOUNT_SERVICE_CODE = "NETFLIX_VVIP";
/** Bizim hesabda müştəriyə ayrılan otaq. */
export const NETFLIX_CABINET_SERVICE_CODES: readonly string[] = [
  "NETFLIX_YANIMDA",
  "NETFLIX_EVIMD",
  "NETFLIX_EVIMD_VIP",
];
/** Satılan Netflix məhsulları (`metadata.service`). Köhnə `NETFLIX` kodu qəsdən daxil deyil. */
export const NETFLIX_SERVICE_CODES: readonly string[] = [
  NETFLIX_ACCOUNT_SERVICE_CODE,
  ...NETFLIX_CABINET_SERVICE_CODES,
];

/** Admin API `service`-i böyük hərflə yazır — SQL qarşılığı (`sellableServiceWhere`) da belə müqayisə edir. */
export function isNetflixProduct(type: string | null | undefined, metadata: unknown): boolean {
  if (type !== "STREAMING" || !metadata || typeof metadata !== "object") return false;
  return NETFLIX_SERVICE_CODES.includes(String((metadata as Record<string, unknown>).service ?? ""));
}

/** Paket metadata-sında admin "Saytda satılır" bayrağı — üst xidmətin `StreamingPlatform.storeSellable`-ından köçürülür. */
export const STORE_SELLABLE_META_KEY = "storeSellable";

/** Admin-dən satışa açılmış (Netflix olmayan) streaming paketi. */
export function isStoreSellableStreaming(type: string | null | undefined, metadata: unknown): boolean {
  if (type !== "STREAMING" || !metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>)[STORE_SELLABLE_META_KEY] === true;
}

const SERVICE_TYPE_SET = new Set(PLAYSTATION_SERVICE_TYPES);
const CATEGORY_KEY_SET = new Set(PLAYSTATION_CATEGORY_KEYS);

export function isSellableServiceType(type: string | null | undefined): boolean {
  if (!PLAYSTATION_ONLY) return true;
  return SERVICE_TYPE_SET.has(String(type ?? ""));
}

/** Məhsul səviyyəli yoxlama: PS tipləri + Spotify + Netflix + admin-dən açılan streaming. */
export function isSellableServiceProduct(product: { type: string; metadata?: unknown }): boolean {
  if (!PLAYSTATION_ONLY) return true;
  return (
    SERVICE_TYPE_SET.has(product.type) ||
    isSpotifyProduct(product.type, product.metadata) ||
    isNetflixProduct(product.type, product.metadata) ||
    isStoreSellableStreaming(product.type, product.metadata)
  );
}

/**
 * `ServiceProduct` sorğuları üçün Prisma `where` fraqmenti — `isSellableServiceProduct`-un SQL
 * qarşılığı. `AND` içində qaytarılır ki, sorğunun öz `OR`-u ilə toqquşmasın:
 * `where: { isActive: true, ...sellableServiceWhere() }`. (Client-safe — Prisma tipi import olunmur.)
 */
export function sellableServiceWhere(): { AND?: Record<string, unknown>[] } {
  if (!PLAYSTATION_ONLY) return {};
  return {
    AND: [
      {
        OR: [
          { type: { in: [...PLAYSTATION_SERVICE_TYPES] } },
          { type: "PLATFORM", metadata: { path: ["musicBrand"], equals: SPOTIFY_MUSIC_BRAND } },
          ...NETFLIX_SERVICE_CODES.map((code) => ({
            type: "STREAMING",
            metadata: { path: ["service"], equals: code },
          })),
          { type: "STREAMING", metadata: { path: [STORE_SELLABLE_META_KEY], equals: true } },
        ],
      },
    ],
  };
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

/**
 * `openStreamingSlugs` — admin-dən satışa açılmış streaming xidmətlərinin slug-ları (server DB-dən
 * oxuyub ötürür; bu modul sinxron qalmalıdır). `/streaming/<slug>` və alt yolları açıq sayılır.
 */
export function isOpenStorePath(
  href: string | null | undefined,
  openStreamingSlugs?: ReadonlySet<string>,
): boolean {
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
  // Bağlı `/music` altında yalnız Spotify açıqdır.
  if (path === SPOTIFY_STORE_PATH || path.startsWith(`${SPOTIFY_STORE_PATH}/`) || path.startsWith(`${SPOTIFY_STORE_PATH}?`)) {
    return true;
  }
  // Bağlı `/streaming` altında yalnız Netflix səhifələri açıqdır (netflix, netflix-hesab, netflix-yanimda…).
  if (/^\/streaming\/netflix(-[a-z-]+)?([/?]|$)/.test(path)) {
    return true;
  }
  const streamingSlug = /^\/streaming\/([a-z0-9-]+)([/?]|$)/.exec(path)?.[1];
  if (streamingSlug && openStreamingSlugs?.has(streamingSlug)) {
    return true;
  }
  return !CLOSED_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}
