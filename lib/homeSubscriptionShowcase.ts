// Ana səhifənin Netflix və Spotify vitrinləri — hər plan × müddət (× nəfər) AYRICA kart.
//
// SAF modul (DB yoxdur, client-safe): `app/page.tsx` aktiv + satılan + landing-dən gizlədilməmiş
// paketləri ötürür, nəticə serializable-dır (`unstable_cache`-ə düşür).
//
// Kart səbətə atmır, LİNKDİR: Netflix hesab planı və Spotify e-poçt/şifrə tələb edir, Netflix
// otağı isə alışdan əvvəl şərt modalı göstərir. Link `?mehsul=<id>` daşıyır — alış səhifəsi
// (NetflixCabinetPicker / NetflixAccountPlans / SpotifyPlanPicker) həmin paketi seçili açır.

import { NETFLIX_ACCOUNT_SERVICE_CODE, NETFLIX_STORE_PATH, isNetflixProduct } from "@/lib/storeScope";
import { STREAMING_VARIANTS } from "@/lib/streamingVariants";
import {
  SPOTIFY_PLAN_LABELS,
  SPOTIFY_PLAN_TIERS,
  isValidSpotifyPlanTier,
} from "@/lib/platformSubscriptions";

export type ShowcaseInputProduct = {
  id: string;
  type: string;
  priceAznCents: number;
  metadata: unknown;
};

export type ShowcaseOffer = {
  id: string;
  months: number;
  priceAzn: number;
  perMonthAzn: number;
  /** Eyni sətrin 1 aylıq qiymətinə nisbətən qənaət (%). */
  savingPct: number;
  /** `metadata.originalPriceAznCents` (qiymətdən bahadırsa) — üstündən xətlənir. */
  originalAzn: number | null;
  /** Sətirdə ayda ən ucuz düşən müddət (yalnız qənaət varsa). */
  best: boolean;
  href: string;
};

export type ShowcaseRow = { key: string; title: string; caption: string; offers: ShowcaseOffer[] };
export type ShowcaseGroup = { key: string; title: string; rows: ShowcaseRow[] };
export type ShowcaseBrand = {
  key: "netflix" | "spotify";
  title: string;
  subtitle: string;
  href: string;
  fromPerMonthAzn: number;
  offerCount: number;
  groups: ShowcaseGroup[];
};

/** Netflix hesab planlarının (Basic/Standart/Premium) alış səhifəsi — `lib/streamingGroups.ts` chooser-i. */
export const NETFLIX_ACCOUNT_STORE_PATH = "/streaming/netflix-hesab";
export const SPOTIFY_STORE_PATH = "/music/spotify-premium";

/** Otaq kodu → `STREAMING_VARIANTS.NETFLIX` slug-ı (`?paket=` dəyəri). */
const NETFLIX_CABINET_SLUG_BY_CODE: Record<string, string> = {
  NETFLIX_YANIMDA: "yanimda",
  NETFLIX_EVIMD: "evimde",
  NETFLIX_EVIMD_VIP: "evimdevip",
};

/** Kart sətrinin altındakı qısa izah (variant slug-ı üzrə). */
const NETFLIX_CAPTIONS: Record<string, string> = {
  basic: "720p · 1 ekran",
  standart: "1080p · 2 ekran",
  premium: "4K + HDR · 4 ekran",
  yanimda: "Telefon, planşet, kompüter",
  evimde: "TV daxil bütün cihazlar",
  evimdevip: "TV daxil · ən stabil",
};

function meta(p: ShowcaseInputProduct): Record<string, unknown> {
  return p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
    ? (p.metadata as Record<string, unknown>)
    : {};
}

function months(p: ShowcaseInputProduct): number {
  const n = Number(meta(p).durationMonths);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function seats(p: ShowcaseInputProduct): number {
  const n = Number(meta(p).seats);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

/** Spotify plan paketi (Individual/Duo/Family) — ana səhifədə öz vitrinindədir, matrisdə yox. */
export function isShowcaseSpotifyProduct(type: string, metadata: unknown): boolean {
  if (type !== "PLATFORM" || !metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  return (
    String(m.musicBrand ?? "").toUpperCase() === "SPOTIFY" &&
    isValidSpotifyPlanTier(String(m.planTier ?? "").toUpperCase())
  );
}

/**
 * Bir sətrin müddət kartları. Eyni müddətə iki paket düşərsə ucuzu götürülür. Qənaət
 * `NetflixCabinetPicker`-dəki kimi 1 aylığa nisbətəndir (1 aylıq yoxdursa ən baha aylıq).
 */
export function buildShowcaseOffers(
  products: ShowcaseInputProduct[],
  hrefFor: (p: ShowcaseInputProduct) => string,
): ShowcaseOffer[] {
  const byMonths = new Map<number, ShowcaseInputProduct>();
  for (const p of products) {
    const m = months(p);
    if (!m) continue;
    const current = byMonths.get(m);
    if (!current || p.priceAznCents < current.priceAznCents) byMonths.set(m, p);
  }
  const rows = Array.from(byMonths.entries()).sort((a, b) => a[0] - b[0]);
  if (rows.length === 0) return [];

  const one = byMonths.get(1);
  const basePpm = one ? one.priceAznCents : Math.max(...rows.map(([m, p]) => p.priceAznCents / m));
  const offers = rows.map(([m, p]) => {
    const fullCents = basePpm * m;
    const original = Number(meta(p).originalPriceAznCents);
    return {
      id: p.id,
      months: m,
      priceAzn: p.priceAznCents / 100,
      perMonthAzn: Math.round(p.priceAznCents / m) / 100,
      savingPct: fullCents > 0 ? Math.max(0, Math.round((1 - p.priceAznCents / fullCents) * 100)) : 0,
      originalAzn: Number.isFinite(original) && original > p.priceAznCents ? original / 100 : null,
      best: false,
      href: hrefFor(p),
    };
  });

  if (offers.length > 1) {
    const cheapest = offers.reduce((min, o) => (o.priceAzn / o.months < min.priceAzn / min.months ? o : min));
    if (cheapest.savingPct > 0) cheapest.best = true;
  }
  return offers;
}

function seatRows(
  keyBase: string,
  title: string,
  caption: string,
  products: ShowcaseInputProduct[],
  hrefFor: (p: ShowcaseInputProduct) => string,
): ShowcaseRow[] {
  const seatCounts = Array.from(new Set(products.map(seats))).sort((a, b) => a - b);
  return seatCounts.flatMap((n) => {
    const offers = buildShowcaseOffers(products.filter((p) => seats(p) === n), hrefFor);
    if (offers.length === 0) return [];
    return [{ key: `${keyBase}-${n}`, title: n > 1 ? `${title} · ${n} nəfər` : title, caption, offers }];
  });
}

function finishBrand(
  base: Omit<ShowcaseBrand, "fromPerMonthAzn" | "offerCount" | "groups">,
  groups: ShowcaseGroup[],
): ShowcaseBrand | null {
  const live = groups.filter((g) => g.rows.length > 0);
  const offers = live.flatMap((g) => g.rows.flatMap((r) => r.offers));
  if (offers.length === 0) return null;
  // Başlıqdakı "ayda X ₼-dan" nəfərə bölünmür — otaq seçimindəki rəqəmlə eynidir.
  const fromPerMonthAzn = Math.min(...offers.map((o) => o.perMonthAzn));
  return { ...base, fromPerMonthAzn, offerCount: offers.length, groups: live };
}

export function buildNetflixShowcase(products: ShowcaseInputProduct[]): ShowcaseBrand | null {
  const netflix = products.filter((p) => isNetflixProduct(p.type, p.metadata));
  const serviceOf = (p: ShowcaseInputProduct) => String(meta(p).service ?? "").toUpperCase();

  const account = netflix.filter((p) => serviceOf(p) === NETFLIX_ACCOUNT_SERVICE_CODE);
  const accountRows = (STREAMING_VARIANTS.NETFLIX_VVIP?.variants ?? []).flatMap((v) =>
    seatRows(
      `hesab-${v.slug}`,
      v.name,
      NETFLIX_CAPTIONS[v.slug] ?? "",
      account.filter((p) => String(meta(p).variantSlug ?? "").trim() === v.slug),
      (p) => `${NETFLIX_ACCOUNT_STORE_PATH}?mehsul=${encodeURIComponent(p.id)}`,
    ),
  );

  const cabinetRows = (STREAMING_VARIANTS.NETFLIX?.variants ?? []).flatMap((v) => {
    const codes = Object.keys(NETFLIX_CABINET_SLUG_BY_CODE).filter((c) => NETFLIX_CABINET_SLUG_BY_CODE[c] === v.slug);
    return seatRows(
      `otaq-${v.slug}`,
      v.name,
      NETFLIX_CAPTIONS[v.slug] ?? "",
      netflix.filter((p) => codes.includes(serviceOf(p))),
      (p) =>
        `${NETFLIX_STORE_PATH}?secim=kabinet&paket=${v.slug}&mehsul=${encodeURIComponent(p.id)}`,
    );
  });

  return finishBrand(
    {
      key: "netflix",
      title: "Netflix",
      subtitle: "Öz hesabına plan və ya sənə aid otaq",
      href: NETFLIX_STORE_PATH,
    },
    [
      { key: "hesab", title: "Öz hesabına plan", rows: accountRows },
      { key: "otaq", title: "Sənə aid otaq", rows: cabinetRows },
    ],
  );
}

export function buildSpotifyShowcase(products: ShowcaseInputProduct[]): ShowcaseBrand | null {
  const spotify = products.filter((p) => isShowcaseSpotifyProduct(p.type, p.metadata));
  const rows = SPOTIFY_PLAN_TIERS.flatMap((tier) => {
    const tierProducts = spotify.filter((p) => String(meta(p).planTier ?? "").toUpperCase() === tier);
    const slots = Math.max(1, ...tierProducts.map((p) => Number(meta(p).accountSlots) || 1));
    const offers = buildShowcaseOffers(
      tierProducts,
      (p) => `${SPOTIFY_STORE_PATH}?mehsul=${encodeURIComponent(p.id)}`,
    );
    return offers.length > 0
      ? [{ key: `spotify-${tier.toLowerCase()}`, title: SPOTIFY_PLAN_LABELS[tier], caption: `${slots} hesab`, offers }]
      : [];
  });

  return finishBrand(
    {
      key: "spotify",
      title: "Spotify Premium",
      subtitle: "Premium öz Spotify hesabına qoşulur",
      href: SPOTIFY_STORE_PATH,
    },
    [{ key: "planlar", title: "", rows }],
  );
}

/** Ana səhifə sırası: Netflix, sonra Spotify. Paketi olmayan brend göstərilmir. */
export function buildHomeSubscriptionShowcase(products: ShowcaseInputProduct[]): ShowcaseBrand[] {
  return [buildNetflixShowcase(products), buildSpotifyShowcase(products)].filter(
    (b): b is ShowcaseBrand => b !== null,
  );
}
