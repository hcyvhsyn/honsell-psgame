// Ana səhifənin Netflix və Spotify vitrinləri — hər plan (× nəfər) bir kart, müddətlər kartın içində.
// Kart qapağı `visual`-dan koddan çəkilir (components/ShowcasePlanCards.tsx); `/streaming/netflix` də işlədir.
//
// SAF modul (DB yoxdur, client-safe): `app/page.tsx` aktiv + satılan paketləri ötürür, nəticə
// serializable-dır (`unstable_cache`-ə düşür).
//
// ⚠️ `metadata.hideFromLanding` burada NƏZƏRƏ ALINMIR. O bayraq köhnə "Abunəlik paketləri"
// matrisinindir (/admin/subscription-packages); Netflix/Spotify o matrisə düşmür. Prod-da
// köhnə bayraq 1 nəfərlik otaqları vitrindən gizlədirdi (2026-11). Paketi satışdan çıxarmaq
// üçün qiymət xanasını boşalt (`isActive=false`).
//
// Kart səbətə atmır, LİNKDİR: Netflix hesab planı və Spotify e-poçt/şifrə tələb edir, Netflix
// otağı isə alışdan əvvəl şərt modalı göstərir. Link `?mehsul=<id>` daşıyır — alış səhifəsi
// (NetflixCabinetPicker / NetflixAccountPlans / SpotifyPlanPicker) həmin paketi seçili açır.

import {
  NETFLIX_ACCOUNT_SERVICE_CODE,
  NETFLIX_STORE_PATH,
  SPOTIFY_STORE_PATH,
  isNetflixProduct,
  isSpotifyProduct,
} from "@/lib/storeScope";
import { STREAMING_VARIANTS, type VariantFeature } from "@/lib/streamingVariants";
import {
  SPOTIFY_PLAN_LABELS,
  SPOTIFY_PLAN_TIERS,
  isValidSpotifyPlanTier,
} from "@/lib/platformSubscriptions";
import { extractYouTubeId } from "@/lib/youtubeUtils";

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

export type ShowcaseDevice = "phone" | "tablet" | "computer" | "tv";

/**
 * Kartın "şəkil" sahəsi (matrisdəki PS Plus qapağı kimi) — şəkil faylı yox, koddan çəkilir.
 * Planın fərqini göstərir: keyfiyyət (720p/4K), cihazlar (Yanımda-da TV üstündən xətlənir), nəfər sayı.
 */
export type ShowcaseVisual = {
  /** Sol-üst nişan ("Otaq", "Öz hesabın", "Spotify"). */
  badge: string;
  /** İri yazı: keyfiyyət ("4K") və ya plan adı ("Evimdə VIP"). */
  headline: string;
  /** İri yazının altındakı qısa izah. */
  tagline: string;
  /** Boşdursa cihaz sırası göstərilmir. `allowed: false` → üstündən xətlənir. */
  devices: Array<{ key: ShowcaseDevice; allowed: boolean }>;
  /** İkonla göstərilən say: nəfər (otaq), ekran (hesab planı), hesab (Spotify). */
  count: { n: number; label: string; kind: "people" | "screens" };
  /** Eyni brendin planlarını rəng tonu ilə ayırır (base → top). */
  tone: "base" | "mid" | "top";
};

export type ShowcaseRow = {
  key: string;
  title: string;
  caption: string;
  visual: ShowcaseVisual;
  offers: ShowcaseOffer[];
};
export type ShowcaseGroup = {
  key: string;
  title: string;
  /** Qrup başlığının yanında bir cümləlik izah ("Hesab bizim, otaq sənin"). */
  hint: string;
  rows: ShowcaseRow[];
};

/** "Aralarındakı fərq nədir?" modalı: video (varsa) + plan müqayisəsi (həmişə). */
export type ShowcaseGuidePlan = { name: string; points: VariantFeature[] };
export type ShowcaseGuideGroup = { title: string; intro: string; plans: ShowcaseGuidePlan[] };
export type ShowcaseGuide = { title: string; videoId: string | null; groups: ShowcaseGuideGroup[] };

export type ShowcaseBrand = {
  key: "netflix" | "spotify";
  title: string;
  subtitle: string;
  href: string;
  fromPerMonthAzn: number;
  offerCount: number;
  groups: ShowcaseGroup[];
  guide: ShowcaseGuide | null;
};

/** Netflix hesab planlarının (Basic/Standart/Premium) alış səhifəsi — `lib/streamingGroups.ts` chooser-i. */
export const NETFLIX_ACCOUNT_STORE_PATH = "/streaming/netflix-hesab";

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

/** Kart vizualı (variant slug-ı üzrə). Hesab planında ekran sayı Netflix-in rəsmi planlarıdır. */
const NETFLIX_ART: Record<string, { headline: string; tagline: string; screens?: number; tone: ShowcaseVisual["tone"] }> = {
  basic: { headline: "720p", tagline: "HD keyfiyyət", screens: 1, tone: "base" },
  standart: { headline: "1080p", tagline: "Tam HD", screens: 2, tone: "mid" },
  premium: { headline: "4K", tagline: "Ultra HD + HDR", screens: 4, tone: "top" },
  yanimda: { headline: "Yanımda", tagline: "TV-siz, hər yerdə", tone: "base" },
  evimde: { headline: "Evimdə", tagline: "TV daxil", tone: "mid" },
  evimdevip: { headline: "Evimdə VIP", tagline: "TV daxil · ən stabil", tone: "top" },
};

const DEVICE_ORDER: ShowcaseDevice[] = ["phone", "tablet", "computer", "tv"];

function netflixVisual(
  slug: string,
  kind: "hesab" | "otaq",
  seatCount: number,
  devices: string[],
): ShowcaseVisual {
  const art = NETFLIX_ART[slug] ?? { headline: slug, tagline: "", tone: "base" as const };
  if (kind === "hesab") {
    const screens = art.screens ?? 1;
    return {
      badge: "Öz hesabın",
      headline: art.headline,
      tagline: art.tagline,
      devices: [],
      count: { n: screens, label: `${screens} ekran`, kind: "screens" },
      tone: art.tone,
    };
  }
  return {
    badge: "Otaq",
    headline: art.headline,
    tagline: art.tagline,
    devices: DEVICE_ORDER.map((key) => ({ key, allowed: devices.includes(key) })),
    count: { n: seatCount, label: `${seatCount} nəfər`, kind: "people" },
    tone: art.tone,
  };
}

/** Bələdçidə hesab planlarının bütün bulletləri yox — fərqi göstərən üçü. */
const ACCOUNT_GUIDE_POINT = /^(Çözünürlük|Eyni anda|Kimlər üçün)/;

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
  if (!isSpotifyProduct(type, metadata)) return false;
  return isValidSpotifyPlanTier(String((metadata as Record<string, unknown>).planTier ?? "").toUpperCase());
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
  visualFor: (seatCount: number) => ShowcaseVisual,
): ShowcaseRow[] {
  const seatCounts = Array.from(new Set(products.map(seats))).sort((a, b) => a - b);
  return seatCounts.flatMap((n) => {
    const offers = buildShowcaseOffers(products.filter((p) => seats(p) === n), hrefFor);
    if (offers.length === 0) return [];
    return [
      {
        key: `${keyBase}-${n}`,
        title: n > 1 ? `${title} · ${n} nəfər` : title,
        caption,
        visual: visualFor(n),
        offers,
      },
    ];
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

export type NetflixShowcaseOptions = {
  /** `StreamingPlatform(NETFLIX).guideVideoUrl` — admin "Ad, təsvir, ünvan" modalından. */
  guideVideoUrl?: string | null;
};

export function buildNetflixShowcase(
  products: ShowcaseInputProduct[],
  options: NetflixShowcaseOptions = {},
): ShowcaseBrand | null {
  const netflix = products.filter((p) => isNetflixProduct(p.type, p.metadata));
  const serviceOf = (p: ShowcaseInputProduct) => String(meta(p).service ?? "").toUpperCase();

  const accountVariants = STREAMING_VARIANTS.NETFLIX_VVIP?.variants ?? [];
  const cabinetVariants = STREAMING_VARIANTS.NETFLIX?.variants ?? [];
  const account = netflix.filter((p) => serviceOf(p) === NETFLIX_ACCOUNT_SERVICE_CODE);
  const cabinetFor = (slug: string) =>
    netflix.filter((p) => NETFLIX_CABINET_SLUG_BY_CODE[serviceOf(p)] === slug);

  const accountByVariant = accountVariants.map((v) => ({
    v,
    rows: seatRows(
      `hesab-${v.slug}`,
      v.name,
      NETFLIX_CAPTIONS[v.slug] ?? "",
      account.filter((p) => String(meta(p).variantSlug ?? "").trim() === v.slug),
      (p) => `${NETFLIX_ACCOUNT_STORE_PATH}?mehsul=${encodeURIComponent(p.id)}`,
      (n) => netflixVisual(v.slug, "hesab", n, v.devices),
    ),
  }));
  const cabinetByVariant = cabinetVariants.map((v) => ({
    v,
    rows: seatRows(
      `otaq-${v.slug}`,
      v.name,
      NETFLIX_CAPTIONS[v.slug] ?? "",
      cabinetFor(v.slug),
      (p) => `${NETFLIX_STORE_PATH}?secim=kabinet&paket=${v.slug}&mehsul=${encodeURIComponent(p.id)}`,
      (n) => netflixVisual(v.slug, "otaq", n, v.devices),
    ),
  }));
  const accountRows = accountByVariant.flatMap((x) => x.rows);
  const cabinetRows = cabinetByVariant.flatMap((x) => x.rows);

  // Bələdçi yalnız vitrində kartı olan planları izah edir (satılmayan planı tanıtmırıq).
  // Mətn `STREAMING_VARIANTS`-dandır — alış səhifəsindəki bulletlərlə eyni qalsın.
  const guideGroups: ShowcaseGuideGroup[] = [
    {
      title: "Öz hesabına plan",
      intro:
        "Plan sənin öz Netflix hesabına aktivləşir — alışda hesabın e-poçtunu və şifrəsini yazırsan. Netflix qaydasına görə hesab bir ev üçündür.",
      plans: accountByVariant
        .filter((x) => x.rows.length > 0)
        .map(({ v }) => ({ name: v.name, points: v.features.filter((f) => ACCOUNT_GUIDE_POINT.test(f.text)) })),
    },
    {
      title: "Sənə aid otaq",
      intro:
        "Bizim Premium hesabımızda yalnız sənə məxsus otaq (profil) verilir, 4K Ultra HD keyfiyyətlə. Mail, şifrə və PIN-i biz göndəririk.",
      plans: cabinetByVariant
        .filter((x) => x.rows.length > 0)
        .map(({ v }) => ({ name: v.name, points: v.features })),
    },
  ].filter((g) => g.plans.length > 0);

  const brand = finishBrand(
    {
      key: "netflix",
      title: "Netflix",
      subtitle: "Öz hesabına plan və ya sənə aid otaq",
      href: NETFLIX_STORE_PATH,
      guide: null,
    },
    [
      { key: "hesab", title: "Öz hesabına plan", hint: "Plan sənin Netflix hesabına aktivləşir", rows: accountRows },
      { key: "otaq", title: "Sənə aid otaq", hint: "Hesab bizim, ayrıca profil (otaq) sənin", rows: cabinetRows },
    ],
  );
  if (!brand) return null;
  return {
    ...brand,
    guide: {
      title: "Netflix planları arasında fərq nədir?",
      videoId: extractYouTubeId(options.guideVideoUrl),
      groups: guideGroups,
    },
  };
}

export function buildSpotifyShowcase(products: ShowcaseInputProduct[]): ShowcaseBrand | null {
  const spotify = products.filter((p) => isShowcaseSpotifyProduct(p.type, p.metadata));
  const tones: ShowcaseVisual["tone"][] = ["base", "mid", "top"];
  const rows = SPOTIFY_PLAN_TIERS.flatMap((tier, i) => {
    const tierProducts = spotify.filter((p) => String(meta(p).planTier ?? "").toUpperCase() === tier);
    const slots = Math.max(1, ...tierProducts.map((p) => Number(meta(p).accountSlots) || 1));
    const offers = buildShowcaseOffers(
      tierProducts,
      (p) => `${SPOTIFY_STORE_PATH}?mehsul=${encodeURIComponent(p.id)}`,
    );
    if (offers.length === 0) return [];
    const visual: ShowcaseVisual = {
      badge: "Spotify",
      headline: SPOTIFY_PLAN_LABELS[tier],
      tagline: "Premium",
      devices: [],
      count: { n: slots, label: `${slots} hesab`, kind: "people" },
      tone: tones[Math.min(i, tones.length - 1)],
    };
    return [{ key: `spotify-${tier.toLowerCase()}`, title: SPOTIFY_PLAN_LABELS[tier], caption: `${slots} hesab`, visual, offers }];
  });

  return finishBrand(
    {
      key: "spotify",
      title: "Spotify Premium",
      subtitle: "Premium öz Spotify hesabına qoşulur",
      href: SPOTIFY_STORE_PATH,
      guide: null,
    },
    [{ key: "planlar", title: "", hint: "", rows }],
  );
}

/** Ana səhifə sırası: Netflix, sonra Spotify. Paketi olmayan brend göstərilmir. */
export function buildHomeSubscriptionShowcase(
  products: ShowcaseInputProduct[],
  options: { netflix?: NetflixShowcaseOptions } = {},
): ShowcaseBrand[] {
  return [buildNetflixShowcase(products, options.netflix), buildSpotifyShowcase(products)].filter(
    (b): b is ShowcaseBrand => b !== null,
  );
}
