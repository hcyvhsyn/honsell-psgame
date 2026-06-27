"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Ban,
  Check,
  Globe2,
  Info,
  Minus,
  Monitor,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Star,
  Tablet,
  Trash2,
  Tv as TvIcon,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import {
  STREAMING_SERVICE_LABELS,
  STREAMING_SERVICE_META,
  validateStreamingDetails,
} from "@/lib/streamingCart";
import { getServiceVariantConfig } from "@/lib/streamingVariants";

const DEVICE_META: Record<string, { label: string; Icon: LucideIcon; rank: number }> = {
  tv: { label: "Televizor", Icon: TvIcon, rank: 1 },
  computer: { label: "Kompüter", Icon: Monitor, rank: 2 },
  tablet: { label: "Planşet", Icon: Tablet, rank: 3 },
  phone: { label: "Telefon", Icon: Smartphone, rank: 4 },
};

type ServiceTheme = {
  panelGlow: string;
  logoGradient: string;
  accentText: string;
  accentBorder: string;
  activeCard: string;
  activeBadge: string;
  checkGlow: string;
  cta: string;
};

const DEFAULT_THEME: ServiceTheme = {
  panelGlow: "from-violet-500/20 via-blue-500/10 to-cyan-400/10",
  logoGradient: "from-violet-700 via-indigo-800 to-blue-900",
  accentText: "text-violet-300",
  accentBorder: "border-violet-400/35",
  activeCard: "border-violet-300/80 bg-violet-500/10 shadow-[0_0_34px_rgba(139,92,246,0.42)]",
  activeBadge: "bg-gradient-to-r from-violet-600 to-blue-600 text-white",
  checkGlow: "bg-violet-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.75)]",
  cta: "from-violet-700 via-fuchsia-600 to-blue-600 hover:from-violet-600 hover:via-fuchsia-500 hover:to-blue-500",
};

const SERVICE_THEMES: Record<string, ServiceTheme> = {
  HBO_MAX: DEFAULT_THEME,
  NETFLIX: {
    panelGlow: "from-red-600/18 via-violet-500/10 to-blue-500/10",
    logoGradient: "from-red-700 via-red-950 to-zinc-950",
    accentText: "text-red-200",
    accentBorder: "border-red-400/35",
    activeCard: "border-red-300/80 bg-red-500/10 shadow-[0_0_34px_rgba(239,68,68,0.38)]",
    activeBadge: "bg-gradient-to-r from-red-600 to-violet-600 text-white",
    checkGlow: "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.7)]",
    cta: "from-red-700 via-violet-700 to-blue-600 hover:from-red-600 hover:via-violet-600 hover:to-blue-500",
  },
  NETFLIX_VVIP: {
    panelGlow: "from-red-600/18 via-violet-500/10 to-blue-500/10",
    logoGradient: "from-red-700 via-red-950 to-zinc-950",
    accentText: "text-red-200",
    accentBorder: "border-red-400/35",
    activeCard: "border-red-300/80 bg-red-500/10 shadow-[0_0_34px_rgba(239,68,68,0.38)]",
    activeBadge: "bg-gradient-to-r from-red-600 to-violet-600 text-white",
    checkGlow: "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.7)]",
    cta: "from-red-700 via-violet-700 to-blue-600 hover:from-red-600 hover:via-violet-600 hover:to-blue-500",
  },
  NETFLIX_EVIMD_VIP: {
    panelGlow: "from-red-600/18 via-violet-500/10 to-blue-500/10",
    logoGradient: "from-red-700 via-red-950 to-zinc-950",
    accentText: "text-red-200",
    accentBorder: "border-red-400/35",
    activeCard: "border-red-300/80 bg-red-500/10 shadow-[0_0_34px_rgba(239,68,68,0.38)]",
    activeBadge: "bg-gradient-to-r from-red-600 to-violet-600 text-white",
    checkGlow: "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.7)]",
    cta: "from-red-700 via-violet-700 to-blue-600 hover:from-red-600 hover:via-violet-600 hover:to-blue-500",
  },
  GAIN: {
    panelGlow: "from-rose-500/18 via-orange-500/10 to-violet-500/10",
    logoGradient: "from-rose-700 via-orange-800 to-zinc-950",
    accentText: "text-rose-200",
    accentBorder: "border-rose-400/35",
    activeCard: "border-rose-300/80 bg-rose-500/10 shadow-[0_0_34px_rgba(244,63,94,0.34)]",
    activeBadge: "bg-gradient-to-r from-rose-600 to-orange-500 text-white",
    checkGlow: "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.65)]",
    cta: "from-rose-700 via-orange-600 to-violet-600 hover:from-rose-600 hover:via-orange-500 hover:to-violet-500",
  },
  YOUTUBE_PREMIUM: {
    panelGlow: "from-red-500/18 via-zinc-500/10 to-blue-500/10",
    logoGradient: "from-red-700 via-zinc-900 to-zinc-950",
    accentText: "text-red-200",
    accentBorder: "border-red-400/35",
    activeCard: "border-red-300/80 bg-red-500/10 shadow-[0_0_34px_rgba(239,68,68,0.35)]",
    activeBadge: "bg-gradient-to-r from-red-600 to-zinc-700 text-white",
    checkGlow: "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.65)]",
    cta: "from-red-700 via-zinc-700 to-blue-600 hover:from-red-600 hover:via-zinc-600 hover:to-blue-500",
  },
  PRIME_VIDEO: {
    panelGlow: "from-sky-500/18 via-blue-500/10 to-cyan-400/10",
    logoGradient: "from-sky-600 via-blue-800 to-zinc-950",
    accentText: "text-sky-200",
    accentBorder: "border-sky-400/35",
    activeCard: "border-sky-300/80 bg-sky-500/10 shadow-[0_0_34px_rgba(14,165,233,0.38)]",
    activeBadge: "bg-gradient-to-r from-sky-600 to-blue-600 text-white",
    checkGlow: "bg-sky-500 text-white shadow-[0_0_20px_rgba(14,165,233,0.7)]",
    cta: "from-sky-600 via-blue-600 to-cyan-500 hover:from-sky-500 hover:via-blue-500 hover:to-cyan-400",
  },
};

export type PlanProduct = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  availableStock: number;
};

type FeatureTone = "good" | "bad" | "warn" | "neutral";
type VariantFeature = { text: string; tone: FeatureTone };

type Meta = {
  service: string;
  durationMonths: number;
  seats: number;
  deliveryMode: "CODE" | "GMAIL";
  originalPriceAznCents: number | null;
  inStock: boolean;
  devices: string[];
  vpnRequired: boolean;
  platformImageUrl: string | null;
  /** Paket variantı (tier) adı — məs. "Yanımda", "Evimdə", "Evimdə VIP". */
  variant: string | null;
  /** Variantların sıralanması üçün (kiçik əvvəl). */
  variantRank: number;
  /** Bu varianta xas fərqləndirici xüsusiyyətlər. */
  variantFeatures: VariantFeature[];
  /** Bütün variantlarda ortaq xüsusiyyətlər (eyni dəyər hər məhsulda saxlanılır). */
  commonFeatures: VariantFeature[];
};

type VariantOption = {
  name: string;
  rank: number;
  fromPpm: number;
  features: VariantFeature[];
  devices: string[];
};

type NetflixAccountVariantOption = Omit<VariantOption, "fromPpm"> & {
  fromPpm: number | null;
  available: boolean;
};

function parseFeatures(raw: unknown): VariantFeature[] {
  if (!Array.isArray(raw)) return [];
  const out: VariantFeature[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const text = String((item as Record<string, unknown>).text ?? "").trim();
    if (!text) continue;
    const toneRaw = String((item as Record<string, unknown>).tone ?? "neutral");
    const tone: FeatureTone =
      toneRaw === "good" || toneRaw === "bad" || toneRaw === "warn" ? toneRaw : "neutral";
    out.push({ text, tone });
  }
  return out;
}


type ServiceDisplay = {
  code: string;
  label: string;
  tagline: string;
  description: string;
};

function readMeta(p: PlanProduct): Meta {
  const m = p.metadata ?? {};
  const opc = Number(m.originalPriceAznCents);
  const rawDevices = Array.isArray(m.devices) ? (m.devices as unknown[]) : [];

  return {
    service: String(m.service ?? "").toUpperCase(),
    durationMonths: Number(m.durationMonths ?? 0),
    seats: Number(m.seats ?? 1),
    deliveryMode: String(m.deliveryMode ?? "CODE") === "GMAIL" ? "GMAIL" : "CODE",
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    inStock: m.inStock === undefined ? true : Boolean(m.inStock),
    devices: rawDevices.filter((x): x is string => typeof x === "string"),
    vpnRequired: Boolean(m.vpnRequired),
    platformImageUrl:
      typeof m.platformImageUrl === "string" && m.platformImageUrl.trim()
        ? String(m.platformImageUrl)
        : null,
    variant:
      typeof m.variant === "string" && m.variant.trim() ? String(m.variant).trim() : null,
    variantRank: Number.isFinite(Number(m.variantRank)) ? Number(m.variantRank) : 0,
    variantFeatures: parseFeatures(m.variantFeatures),
    commonFeatures: parseFeatures(m.commonFeatures),
  };
}

function inStock() {
  // Stok sistemi ləğv edildi — sifariş PENDING yaranır, admin təsdiq edir.
  return true;
}

function formatAzn(cents: number) {
  return (cents / 100).toFixed(2);
}

function discountPercent(original: number | null, final: number) {
  if (original == null || original <= final) return null;
  return Math.round(((original - final) / original) * 100);
}

function prettifyService(code: string) {
  const fallback = code.replace(/_/g, " ").trim().toLowerCase();
  return fallback ? fallback.replace(/\b\w/g, (m) => m.toUpperCase()) : "Streaming";
}

function serviceDisplay(code: string): ServiceDisplay {
  const normalized = code.toUpperCase();
  const known = STREAMING_SERVICE_META[normalized as keyof typeof STREAMING_SERVICE_META];

  if (known) {
    return {
      code: normalized,
      label: known.label,
      tagline: known.tagline,
      description: known.description,
    };
  }

  const label = STREAMING_SERVICE_LABELS[normalized] ?? prettifyService(normalized);
  return {
    code: normalized || "STREAMING",
    label,
    tagline: "Premium streaming abunəliyi",
    description:
      "Seçilmiş müddətə uyğun abunəlik aktivləşdirilir, ödənişdən sonra giriş məlumatları sənə göndərilir.",
  };
}

function orderedDevices(devices: string[]) {
  const seen = new Set<string>();
  return devices
    .filter((device) => {
      if (!DEVICE_META[device] || seen.has(device)) return false;
      seen.add(device);
      return true;
    })
    .sort((a, b) => DEVICE_META[a].rank - DEVICE_META[b].rank);
}

const SEAT_INFO: Record<number, { title: string; body: string }> = {
  1: {
    title: "1 nəfərlik nə deməkdir?",
    body: "Abunəlik yalnız bir istifadəçi üçündür. Eyni anda bir cihazda istifadə oluna bilər və hesab paylaşılmır.",
  },
  2: {
    title: "2 nəfərlik nə deməkdir?",
    body: "Abunəlik iki nəfər arasında paylaşılır. Eyni anda iki ayrı cihazda baxış mümkündür və ayrıca profil/slot ayrılır.",
  },
};

type ServiceTerms = {
  rules: string[];
  warning: string;
};

// İstifadə qaydaları paketə görə fərqlənir (məs. Yanımda-da TV qadağandır,
// Evimdə-də icazəlidir). Yanımda həm müstəqil platforma (NETFLIX_YANIMDA), həm də
// NETFLIX xidmətinin "Yanımda" variantı kimi açıla bilər — hər ikisini tuturuq.
const NETFLIX_YANIMDA_TERMS: ServiceTerms = {
  rules: [
    "Televizor, Playstation və ya hər hansı sabit qurğu ilə hesaba daxil olmaq qadağandır.",
    "1 kabinet yalnız 1 nəfərin istifadəsi üçündür. Məlumatlarınızı başqa şəxslə paylaşmaq olmaz.",
    "Hesab şifrəsini dəyişmək qadağandır.",
    "Digər kabinetlərin adlarını və PIN kodlarını dəyişmək qadağandır.",
    "Hesabdan kabinet silmək olmaz.",
    "Yalnız öz kabinetinizin adını və PIN kodunuzu dəyişə bilərsiniz.",
  ],
  warning:
    "Yuxarıda qeyd olunan qaydalar pozulduğu halda, abunəliyiniz dərhal sonlandırılacaq və ödəniş geri qaytarılmayacaq.",
};

// Evimdə paketi — TV icazəli olduğu üçün TV qadağası qaydası yoxdur.
const NETFLIX_EVIMD_TERMS: ServiceTerms = {
  rules: [
    "1 kabinet yalnız 1 nəfərin istifadəsi üçündür. Məlumatlarınızı başqa şəxslə paylaşmaq olmaz.",
    "Hesab şifrəsini dəyişmək qadağandır.",
    "Digər kabinetlərin adlarını və PIN kodlarını dəyişmək qadağandır.",
    "Hesabdan kabinet silmək olmaz.",
    "Yalnız öz kabinetinizin adını və PIN kodunuzu dəyişə bilərsiniz.",
  ],
  warning:
    "Yuxarıda qeyd olunan qaydalar pozulduğu halda, abunəliyiniz dərhal sonlandırılacaq və ödəniş geri qaytarılmayacaq.",
};

// Yalnız bu paketlər üçün checkout-da təsdiq tələb olunur.
const SERVICE_TERMS: Record<string, ServiceTerms> = {
  NETFLIX_YANIMDA: NETFLIX_YANIMDA_TERMS,
  NETFLIX_EVIMD: NETFLIX_EVIMD_TERMS,
  NETFLIX_EVIMD_VIP: NETFLIX_EVIMD_TERMS,
};
const VARIANT_TERMS: Record<string, ServiceTerms> = {
  Yanımda: NETFLIX_YANIMDA_TERMS,
  Evimdə: NETFLIX_EVIMD_TERMS,
  "Evimdə VIP": NETFLIX_EVIMD_TERMS,
};

function resolveTerms(
  serviceCode: string,
  variant: string | null | undefined,
): ServiceTerms | null {
  return SERVICE_TERMS[serviceCode] ?? (variant ? VARIANT_TERMS[variant] ?? null : null);
}

export default function StreamingPlanPicker({
  products,
  productType = "STREAMING",
  authMode,
  platformKind,
  heroImageUrl,
  serviceOverride,
  allowAnyEmail = false,
}: {
  products: PlanProduct[];
  /** Cart-a yazılan məhsul tipi. PLATFORM (music) üçün "PLATFORM" ötürülür. */
  productType?: string;
  /** Gmail/şifrə toplanması. YouTube üçün "GMAIL_PASSWORD". */
  authMode?: "GMAIL" | "GMAIL_PASSWORD";
  platformKind?: string;
  /** Platforma hero şəkli (music platformaları StreamingPlatform-dan oxuyur). */
  heroImageUrl?: string | null;
  /** serviceDisplay-i əvəz edir (music kodları STREAMING_SERVICE_META-da yoxdur). */
  serviceOverride?: { code: string; label: string; tagline: string; description: string };
  /**
   * true: istənilən e-poçt provayderi qəbul olunur (yalnız @gmail.com deyil).
   * Netflix Hesab üçün — müştəri öz Netflix hesab e-poçtunu (hər provayder) verir.
   */
  allowAnyEmail?: boolean;
}) {
  const enriched = useMemo(
    () => products.map((p) => ({ p, m: readMeta(p) })).filter((x) => x.m.durationMonths > 0),
    [products],
  );

  const seatOptions = useMemo(() => {
    const set = new Set<number>();
    for (const x of enriched) set.add(x.m.seats);
    return Array.from(set).sort((a, b) => a - b);
  }, [enriched]);

  const [selectedSeats, setSelectedSeats] = useState<number>(seatOptions[0] ?? 1);
  const [seatInfoOpen, setSeatInfoOpen] = useState<number | null>(null);
  const effectiveSeats = seatOptions.includes(selectedSeats) ? selectedSeats : seatOptions[0] ?? 1;

  // Variant (tier) seçimi — yalnız metadata.variant təyin olunmuş paketlər üçün.
  const variantOptions = useMemo(() => {
    const map = new Map<string, VariantOption>();
    for (const x of enriched) {
      if (!x.m.variant) continue;
      const ppm = x.p.priceAznCents / x.m.durationMonths;
      const existing = map.get(x.m.variant);
      if (!existing) {
        map.set(x.m.variant, {
          name: x.m.variant,
          rank: x.m.variantRank,
          fromPpm: ppm,
          features: x.m.variantFeatures,
          devices: orderedDevices(x.m.devices),
        });
      } else {
        if (ppm < existing.fromPpm) {
          existing.fromPpm = ppm;
          existing.features = x.m.variantFeatures;
        }
        existing.devices = orderedDevices([...existing.devices, ...x.m.devices]);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.rank - b.rank || a.fromPpm - b.fromPpm);
  }, [enriched]);

  const hasVariants = variantOptions.length > 1;
  const [selectedVariant, setSelectedVariant] = useState<string>(variantOptions[0]?.name ?? "");
  const effectiveVariant = variantOptions.some((v) => v.name === selectedVariant)
    ? selectedVariant
    : variantOptions[0]?.name ?? "";

  const durationOptions = useMemo(() => {
    return enriched
      .filter((x) => x.m.seats === effectiveSeats)
      .filter((x) => !hasVariants || x.m.variant === effectiveVariant)
      .sort((a, b) => a.m.durationMonths - b.m.durationMonths);
  }, [effectiveSeats, effectiveVariant, hasVariants, enriched]);

  const cheapestPerMonthId = useMemo(() => {
    if (durationOptions.length === 0) return null;

    let bestId: string | null = null;
    let bestPpm = Infinity;

    for (const x of durationOptions) {
      const ppm = x.p.priceAznCents / x.m.durationMonths;
      if (ppm < bestPpm) {
        bestPpm = ppm;
        bestId = x.p.id;
      }
    }

    return bestId;
  }, [durationOptions]);

  const serviceCode =
    serviceOverride?.code || durationOptions[0]?.m.service || enriched[0]?.m.service || "STREAMING";
  const isNetflixAccountPlans = serviceCode === "NETFLIX_VVIP";
  const netflixAccountVariants = useMemo<NetflixAccountVariantOption[]>(() => {
    if (!isNetflixAccountPlans) return [];

    const config = getServiceVariantConfig(serviceCode);
    if (!config) {
      return variantOptions.map((variant) => ({ ...variant, available: true }));
    }

    const availableByName = new Map(variantOptions.map((variant) => [variant.name, variant]));

    return config.variants
      .map((configured) => {
        const available = availableByName.get(configured.name);

        return {
          name: configured.name,
          rank: configured.rank,
          fromPpm: available?.fromPpm ?? null,
          features: available?.features.length ? available.features : configured.features,
          devices: available?.devices.length ? available.devices : orderedDevices(configured.devices),
          available: Boolean(available),
        };
      })
      .sort((a, b) => a.rank - b.rank);
  }, [isNetflixAccountPlans, serviceCode, variantOptions]);

  // Netflix hesab: hər plan (variant) üzrə müddət variantları — kart öz içində
  // müddət seçimi + səbətə əlavə düyməsi göstərir (ayrıca müddət bölməsi yox).
  const netflixDurationsByVariant = useMemo(() => {
    const map = new Map<string, Array<{ p: PlanProduct; m: Meta }>>();
    if (!isNetflixAccountPlans) return map;
    for (const x of enriched) {
      if (!x.m.variant) continue;
      if (!map.has(x.m.variant)) map.set(x.m.variant, []);
      map.get(x.m.variant)!.push(x);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.m.durationMonths - b.m.durationMonths);
    return map;
  }, [isNetflixAccountPlans, enriched]);

  if (enriched.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-400">
        Aktiv plan yoxdur.
      </div>
    );
  }

  const service = serviceOverride ?? serviceDisplay(serviceCode);
  const theme = SERVICE_THEMES[serviceCode] ?? DEFAULT_THEME;
  const supportedDevices = orderedDevices(durationOptions.flatMap((x) => x.m.devices));
  // Platforma şəkli: əvvəlcə prop (music platformaları StreamingPlatform-dan),
  // sonra streaming metadata, sonra hər hansı paketin öz şəkli.
  const platformImage =
    heroImageUrl ||
    durationOptions.find((x) => x.m.platformImageUrl)?.m.platformImageUrl ||
    durationOptions.find((x) => x.p.imageUrl)?.p.imageUrl ||
    null;
  const vpnRequired = durationOptions.some((x) => x.m.vpnRequired);
  const deliveryLabel = durationOptions.some((x) => x.m.deliveryMode === "GMAIL")
    ? "Gmail aktivləşmə"
    : "Tez çatdırılma";

  return (
    <div className="space-y-5">
      {seatOptions.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-3">
          <p className="text-sm font-semibold text-zinc-300">Nəfər sayı</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-white/10 bg-black/35 p-1">
              {seatOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSelectedSeats(n)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    effectiveSeats === n
                      ? "bg-white text-zinc-950"
                      : "text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  {n} nəfər
                </button>
              ))}
            </div>
            {SEAT_INFO[effectiveSeats] && (
              <button
                type="button"
                onClick={() => setSeatInfoOpen(effectiveSeats)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/20 hover:text-white"
                aria-label="Nəfər sayı haqqında məlumat"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {isNetflixAccountPlans ? (
        <NetflixAccountPlans
          variants={netflixAccountVariants}
          durationsByVariant={netflixDurationsByVariant}
          theme={theme}
          productType={productType}
          authMode={authMode}
          platformKind={platformKind}
          allowAnyEmail={allowAnyEmail}
        />
      ) : (
        <>
          <ServiceOverview
            service={service}
            theme={theme}
            seats={effectiveSeats}
            vpnRequired={vpnRequired}
            deliveryLabel={deliveryLabel}
            devices={supportedDevices}
            imageUrl={platformImage}
            terms={resolveTerms(serviceCode, effectiveVariant)}
          />

          {hasVariants && (
            <section aria-label="Paket seç" className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-zinc-300">Paket seç</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Paketlər arasındakı fərqi oxuyun — sizə uyğununu seçin.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {variantOptions.map((v) => {
                  const active = v.name === effectiveVariant;
                  const isVip = /vip/i.test(v.name);
                  return (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setSelectedVariant(v.name)}
                      aria-pressed={active}
                      className={`group relative flex flex-col rounded-[22px] border p-4 text-left transition duration-200 ${
                        active
                          ? theme.activeCard
                          : "border-white/10 bg-zinc-950/80 hover:border-white/25 hover:bg-zinc-900/70"
                      }`}
                    >
                      <span
                        className={`absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full transition ${
                          active ? theme.checkGlow : "bg-white/5 text-transparent"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>

                      <div className="flex items-center gap-2 pr-8">
                        {isVip && <Star className={`h-4 w-4 ${theme.accentText}`} />}
                        <h4 className="text-lg font-black leading-tight text-white">{v.name}</h4>
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">
                        <span className="text-xl font-black text-white tabular-nums">
                          {(v.fromPpm / 100).toFixed(2)}
                        </span>{" "}
                        ₼ / aydan
                      </p>

                      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                        {v.features.map((f, i) => (
                          <FeatureRow key={i} feature={f} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section aria-label="Müddət" className="space-y-3">
            <p className="text-sm font-semibold text-zinc-300">
              {hasVariants && effectiveVariant ? `${effectiveVariant} — müddət seç` : "Müddət"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {durationOptions.map((x) => {
                const isBest = x.p.id === cheapestPerMonthId && durationOptions.length > 1;
                const stock = inStock();
                const discountPct = discountPercent(x.m.originalPriceAznCents, x.p.priceAznCents);
                const perMonth = x.p.priceAznCents / 100 / x.m.durationMonths;

                return (
                  <div
                    key={x.p.id}
                    className={`group relative flex flex-col overflow-hidden rounded-[22px] border border-white/10 bg-zinc-950/80 p-3 transition duration-200 hover:border-white/25 hover:bg-zinc-900/80 ${
                      !stock ? "opacity-50" : ""
                    }`}
                  >
                    {isBest ? (
                      <span className={`absolute right-0 top-0 z-10 inline-flex items-center gap-1 rounded-bl-xl rounded-tr-[21px] px-3 py-2 text-[11px] font-bold ${theme.activeBadge}`}>
                        <Star className="h-3.5 w-3.5" />
                        Ən sərfəli
                      </span>
                    ) : discountPct != null ? (
                      <span className="absolute right-3 top-3 z-10 rounded-full bg-violet-600/45 px-3 py-1 text-xs font-bold text-violet-50">
                        -%{discountPct}
                      </span>
                    ) : null}

                    <div className="relative aspect-square w-full overflow-hidden rounded-[16px] border border-white/10 bg-black">
                      {x.p.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={x.p.imageUrl}
                          alt={x.p.title}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-br ${theme.logoGradient}`} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                        <span className="text-4xl font-black leading-none text-white drop-shadow">
                          {x.m.durationMonths}
                        </span>
                        <span className="pb-1 text-sm font-medium text-zinc-200">ay</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-1 flex-col">
                      <div className="flex flex-wrap items-baseline gap-2">
                        {x.m.originalPriceAznCents != null && x.m.originalPriceAznCents > x.p.priceAznCents && (
                          <span className="text-sm font-medium text-zinc-500 line-through tabular-nums">
                            {formatAzn(x.m.originalPriceAznCents)}
                          </span>
                        )}
                        <span className="text-2xl font-black text-white tabular-nums">
                          {formatAzn(x.p.priceAznCents)}
                        </span>
                        <span className="text-sm font-semibold text-zinc-300">AZN</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        Aylıq: <span className="font-semibold text-zinc-100 tabular-nums">{perMonth.toFixed(2)} ₼</span>
                      </p>

                      <div className="mt-3 flex">
                        <PlanAddButton
                          product={x.p}
                          meta={x.m}
                          theme={theme}
                          productType={productType}
                          authMode={authMode}
                          platformKind={platformKind}
                          allowAnyEmail={allowAnyEmail}
                          terms={resolveTerms(serviceCode, x.m.variant)}
                          serviceLabel={service.label}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {seatInfoOpen != null && SEAT_INFO[seatInfoOpen] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSeatInfoOpen(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{SEAT_INFO[seatInfoOpen].title}</h3>
              <button
                type="button"
                onClick={() => setSeatInfoOpen(null)}
                className="text-zinc-500 transition hover:text-white"
                aria-label="Bağla"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">{SEAT_INFO[seatInfoOpen].body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function NetflixAccountPlans({
  variants,
  durationsByVariant,
  theme,
  productType,
  authMode,
  platformKind,
  allowAnyEmail,
}: {
  variants: NetflixAccountVariantOption[];
  durationsByVariant: Map<string, Array<{ p: PlanProduct; m: Meta }>>;
  theme: ServiceTheme;
  productType: string;
  authMode?: "GMAIL" | "GMAIL_PASSWORD";
  platformKind?: string;
  allowAnyEmail?: boolean;
}) {
  return (
    <section aria-label="Netflix hesab planını seç" className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-3">
        {variants.map((variant) => (
          <NetflixAccountPlanCard
            key={variant.name}
            variant={variant}
            durations={durationsByVariant.get(variant.name) ?? []}
            theme={theme}
            productType={productType}
            authMode={authMode}
            platformKind={platformKind}
            allowAnyEmail={allowAnyEmail}
          />
        ))}
      </div>
    </section>
  );
}

function NetflixAccountPlanCard({
  variant,
  durations,
  theme,
  productType,
  authMode,
  platformKind,
  allowAnyEmail,
}: {
  variant: NetflixAccountVariantOption;
  durations: Array<{ p: PlanProduct; m: Meta }>;
  theme: ServiceTheme;
  productType: string;
  authMode?: "GMAIL" | "GMAIL_PASSWORD";
  platformKind?: string;
  allowAnyEmail?: boolean;
}) {
  const spec = netflixPlanSpec(variant);
  const available = durations.length > 0;
  const [selectedId, setSelectedId] = useState<string>(durations[0]?.p.id ?? "");
  const selected = durations.find((d) => d.p.id === selectedId) ?? durations[0] ?? null;
  const isPremium = /premium/i.test(variant.name);

  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-[24px] border bg-zinc-950/80 transition duration-200 ${
        available ? "border-white/10 hover:border-white/25" : "border-white/10 opacity-70"
      }`}
    >
      {/* Başlıq — sayt teması (qaranlıq), Netflix-in rəsmi rəngləri deyil. */}
      <div className={`relative overflow-hidden border-b border-white/10 bg-gradient-to-br ${theme.logoGradient} px-5 py-4`}>
        <div className="pointer-events-none absolute inset-0 bg-black/35" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-2xl font-black leading-none text-white">{variant.name}</h4>
            <p className="mt-1.5 text-sm font-bold text-white/80">{spec.resolutionShort}</p>
          </div>
          {isPremium && (
            <span className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-[11px] font-black uppercase tracking-wider text-white">
              Premium
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="divide-y divide-white/10">
          <NetflixSpecRow label="Görüntü və səs" value={spec.quality} />
          <NetflixSpecRow label="Çözünürlük" value={spec.resolution} />
          {spec.spatial && <NetflixSpecRow label="Məkan səsi" value={spec.spatial} />}
          <NetflixSpecRow label="Eyni anda izləmə" value={spec.screens} />
          <NetflixSpecRow label="Endirmə" value={spec.downloads} />
        </div>

        <div className="mt-5 flex flex-1 flex-col justify-end">
          {!available || !selected ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3 py-3 text-center text-sm font-semibold text-zinc-400">
              Tezliklə
            </div>
          ) : (
            <>
              {durations.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {durations.map((d) => {
                    const active = d.p.id === selected.p.id;
                    return (
                      <button
                        key={d.p.id}
                        type="button"
                        onClick={() => setSelectedId(d.p.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          active
                            ? "border-white/30 bg-white text-zinc-950"
                            : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25"
                        }`}
                      >
                        {d.m.durationMonths} ay
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-baseline gap-2">
                {selected.m.originalPriceAznCents != null &&
                  selected.m.originalPriceAznCents > selected.p.priceAznCents && (
                    <span className="text-sm font-medium text-zinc-500 line-through tabular-nums">
                      {formatAzn(selected.m.originalPriceAznCents)}
                    </span>
                  )}
                <span className="text-2xl font-black text-white tabular-nums">
                  {formatAzn(selected.p.priceAznCents)}
                </span>
                <span className="text-sm font-semibold text-zinc-300">AZN</span>
                <span className="text-xs text-zinc-500">/ {selected.m.durationMonths} ay</span>
              </div>

              <div className="mt-3">
                <PlanAddButton
                  product={selected.p}
                  meta={selected.m}
                  theme={theme}
                  productType={productType}
                  authMode={authMode}
                  platformKind={platformKind}
                  allowAnyEmail={allowAnyEmail}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NetflixSpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="text-right text-sm font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function netflixPlanSpec(variant: Pick<NetflixAccountVariantOption, "devices" | "features">) {
  const quality = readFeatureValue(variant.features, "Görüntü və səs keyfiyyəti") ?? "Yaxşı";
  const resolution = readFeatureValue(variant.features, "Çözünürlük") ?? "HD";
  const spatialFeature = variant.features.find((f) => f.text.toLowerCase().includes("məkan səsi"));
  const screensFeature = variant.features.find((f) => f.text.toLowerCase().includes("eyni anda"));
  const downloadsFeature = variant.features.find((f) => f.text.toLowerCase().includes("endirmə"));

  return {
    quality,
    resolution,
    resolutionShort: resolution.replace(" (HD)", "").replace(" (Tam HD)", "").replace("(Ultra HD) ", ""),
    spatial: spatialFeature ? "Daxil" : null,
    devices: variant.devices.length > 0
      ? variant.devices.map((device) => DEVICE_META[device]?.label ?? device).join(", ")
      : "TV, kompüter, telefon, planşet",
    screens: compactFeatureValue(screensFeature?.text) ?? "1 cihaz",
    downloads: compactFeatureValue(downloadsFeature?.text) ?? "1 cihaz",
  };
}

function readFeatureValue(features: VariantFeature[], label: string): string | null {
  const prefix = `${label}:`;
  const feature = features.find((f) => f.text.startsWith(prefix));
  return feature ? feature.text.slice(prefix.length).trim() : null;
}

function compactFeatureValue(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/(\d+)/);
  if (!match) return text;
  return `${match[1]} cihaz`;
}

function TermsModal({
  terms,
  serviceLabel,
  theme,
  mode,
  onClose,
  onConfirm,
}: {
  terms: ServiceTerms;
  serviceLabel: string;
  theme: ServiceTheme;
  mode: "view" | "confirm";
  onClose: () => void;
  onConfirm?: () => void;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-base font-black text-white">
            {serviceLabel} Paketi – İstifadə Qaydaları
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 transition hover:text-white"
            aria-label="Bağla"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="space-y-2.5">
          {terms.rules.map((rule) => (
            <li key={rule} className="flex items-start gap-2.5 text-sm leading-6 text-zinc-300">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <p className="text-sm leading-6 text-amber-100">
            <span className="font-black">Diqqət!</span> {terms.warning}
          </p>
        </div>

        {mode === "confirm" ? (
          <>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
              />
              <span className="text-sm font-semibold text-zinc-200">
                Qaydaları oxudum və qəbul edirəm.
              </span>
            </label>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                type="button"
                disabled={!accepted}
                onClick={() => accepted && onConfirm?.()}
                className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${theme.cta} px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Check className="h-4 w-4" />
                Təsdiq et və davam et
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${theme.cta} px-4 py-2 text-sm font-bold text-white`}
            >
              Bağla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceOverview({
  service,
  theme,
  seats,
  vpnRequired,
  deliveryLabel,
  devices,
  imageUrl,
  terms,
}: {
  service: ServiceDisplay;
  theme: ServiceTheme;
  seats: number;
  vpnRequired: boolean;
  deliveryLabel: string;
  devices: string[];
  imageUrl: string | null;
  terms: ServiceTerms | null;
}) {
  const [termsOpen, setTermsOpen] = useState(false);
  const overviewItems = [
    { Icon: Monitor, label: "HD keyfiyyət", detail: "Təmiz görüntü" },
    { Icon: Zap, label: deliveryLabel, detail: "Sürətli aktivləşmə" },
    { Icon: Users, label: `${seats} nəfər`, detail: "Yalnız sizə aid kabinet" },
    { Icon: ShieldCheck, label: "Təhlükəsiz ödəniş", detail: "Qorunan checkout" },
  ];
  const serviceSummary =
    service.description.trim() || "Ödənişdən sonra giriş məlumatları sənə göndərilir.";
  const serviceTagline = service.tagline.trim() || "Premium streaming abunəliyi";

  return (
    <section
      className={`relative isolate overflow-hidden rounded-[28px] border ${theme.accentBorder} bg-zinc-950 shadow-[0_28px_90px_-52px_rgba(0,0,0,0.95)]`}
      aria-label={`${service.label} plan məlumatı`}
    >
      <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${theme.panelGlow}`} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(120deg,rgba(9,9,11,0.98)_0%,rgba(24,24,27,0.92)_44%,rgba(8,19,23,0.96)_100%)]" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

      <div className="grid gap-0 lg:grid-cols-[minmax(280px,0.92fr)_minmax(0,1.08fr)]">
        <div className="p-3 sm:p-4 lg:p-5">
          <div className="relative aspect-[4/4] w-full overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_24px_70px_-44px_rgba(0,0,0,0.9)]">
            {imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageUrl}
                alt={service.label}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.logoGradient}`} />
            )}
          </div>
        </div>

        <div className="relative flex min-w-0 flex-col justify-center px-5 pb-6 pt-2 sm:px-7 lg:px-10 lg:py-8">
          <div className="pointer-events-none absolute inset-y-10 left-0 hidden w-px bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />
          <div className="relative">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                <div className="min-w-0">
                  <p className={`text-xs font-black uppercase tracking-[0.22em] ${theme.accentText}`}>
                    Premium streaming
                  </p>
                  <h3 className="mt-2 max-w-2xl text-3xl font-black leading-[1.04] text-white sm:text-4xl lg:text-5xl">
                    {service.label}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                    {serviceSummary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-bold text-zinc-300">
                      {serviceTagline}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-black ${
                  vpnRequired
                    ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                    : "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                }`}
              >
                {vpnRequired ? <ShieldAlert className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
                {vpnRequired ? "VPN tələb olunur" : "VPN lazım deyil"}
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {overviewItems.map((item) => (
                <FeatureTile key={item.label} Icon={item.Icon} label={item.label} detail={item.detail} />
              ))}
            </div>

            <p className="mt-4 flex items-start gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-sm leading-6 text-zinc-200">
              <Users className={`mt-0.5 h-4 w-4 shrink-0 ${theme.accentText}`} />
              <span>
                Sizə aid kabinet verilir və bu kabineti yalnız özünüz istifadə edə
                bilərsiniz. Birdən çox nəfər istifadə edəcəksinizsə, ona uyğun sayda alış edin.
              </span>
            </p>

            {devices.length > 0 && (
              <div className="mt-6 rounded-[22px] border border-white/[0.08] bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className={`text-sm font-black ${theme.accentText}`}>Dəstəklənən cihazlar</p>
                  <p className="text-xs font-semibold text-zinc-500">
                    {devices.length} cihaz növündə işləyir
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {devices.map((device) => (
                    <DeviceChip key={device} device={device} theme={theme} />
                  ))}
                </div>
              </div>
            )}

            {terms && (
              <button
                type="button"
                onClick={() => setTermsOpen(true)}
                className="honsell-terms-btn group mt-6 inline-flex w-full items-center justify-between gap-3 rounded-[22px] border border-white/[0.12] bg-black/20 px-4 py-3.5 text-left transition hover:border-white/30 hover:bg-white/[0.05]"
              >
                <span className="flex items-center gap-3">
                  <Info className={`h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110 ${theme.accentText}`} />
                  <span>
                    <span className="block text-sm font-black text-white">İstifadə qaydaları</span>
                    <span className="block text-xs text-zinc-400">
                      Alışdan əvvəl oxuyun — sifariş zamanı təsdiq tələb olunur
                    </span>
                  </span>
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${theme.accentText}`}>
                  Oxu
                  <span className="honsell-terms-arrow inline-block">→</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {terms && termsOpen && (
        <TermsModal
          terms={terms}
          serviceLabel={service.label}
          theme={theme}
          mode="view"
          onClose={() => setTermsOpen(false)}
        />
      )}
    </section>
  );
}

const FEATURE_TONE: Record<FeatureTone, { Icon: LucideIcon; iconClass: string; textClass: string }> = {
  good: { Icon: Check, iconClass: "text-emerald-400", textClass: "text-zinc-200" },
  bad: { Icon: Ban, iconClass: "text-rose-400", textClass: "text-zinc-300" },
  warn: { Icon: AlertTriangle, iconClass: "text-amber-400", textClass: "text-zinc-300" },
  neutral: { Icon: Check, iconClass: "text-zinc-400", textClass: "text-zinc-300" },
};

function FeatureRow({ feature }: { feature: VariantFeature }) {
  const tone = FEATURE_TONE[feature.tone] ?? FEATURE_TONE.neutral;
  const Icon = tone.Icon;
  return (
    <div className="flex items-start gap-2 text-sm leading-snug">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.iconClass}`} />
      <span className={tone.textClass}>{feature.text}</span>
    </div>
  );
}

function FeatureTile({
  Icon,
  label,
  detail,
}: {
  Icon: LucideIcon;
  label: string;
  detail: string;
}) {
  return (
    <div className="group flex min-h-[78px] items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5 transition hover:border-white/18 hover:bg-white/[0.06]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/30 text-violet-200 transition group-hover:text-white">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black leading-tight text-white">{label}</p>
        <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">{detail}</p>
      </div>
    </div>
  );
}

function DeviceChip({ device, theme }: { device: string; theme: ServiceTheme }) {
  const meta = DEVICE_META[device];
  const Icon = meta.Icon;

  return (
    <div className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 text-sm font-bold text-zinc-100">
      <Icon className={`h-[18px] w-[18px] shrink-0 ${theme.accentText}`} />
      <span className="min-w-0 truncate">{meta.label}</span>
    </div>
  );
}

function PlanAddButton({
  product,
  meta,
  theme,
  productType,
  authMode,
  platformKind,
  allowAnyEmail = false,
  terms = null,
  serviceLabel = "",
}: {
  product: PlanProduct;
  meta: Meta;
  theme: ServiceTheme;
  productType: string;
  authMode?: "GMAIL" | "GMAIL_PASSWORD";
  platformKind?: string;
  allowAnyEmail?: boolean;
  terms?: ServiceTerms | null;
  serviceLabel?: string;
}) {
  const cart = useCart();
  const stock = inStock();
  const qty = cart.hydrated ? cart.items.find((i) => i.id === product.id)?.qty ?? 0 : 0;
  const inCart = qty > 0;
  const finalAzn = product.priceAznCents / 100;

  const needsAuth = authMode === "GMAIL" || authMode === "GMAIL_PASSWORD" || meta.deliveryMode === "GMAIL";
  const needsPassword = authMode === "GMAIL_PASSWORD";

  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showGmail, setShowGmail] = useState(false);
  const [gmail, setGmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function addToCart(details?: { gmail: string; password?: string }) {
    const streaming = details
      ? {
          gmail: details.gmail,
          ...(details.password ? { password: details.password } : {}),
          ...(platformKind ? { platformKind } : {}),
        }
      : undefined;
    cart.add({
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      finalAzn,
      productType,
      ...(streaming ? { streaming } : {}),
    });
    if (streaming) cart.updateStreaming(product.id, streaming);
    setShowGmail(false);
    setGmail("");
    setPassword("");
    setErr(null);
  }

  function proceedAfterTerms() {
    if (needsAuth) {
      setShowGmail(true);
      return;
    }
    addToCart();
  }

  function handleAdd() {
    if (!stock) return;
    if (terms && !termsAccepted) {
      setShowTerms(true);
      return;
    }
    proceedAfterTerms();
  }

  function acceptTerms() {
    setTermsAccepted(true);
    setShowTerms(false);
    proceedAfterTerms();
  }

  function increment() {
    if (!stock) return;
    cart.setQty(product.id, qty + 1);
  }

  function decrement() {
    // qty 1-dən aşağı düşəndə məhsul səbətdən çıxarılır (geri alma).
    cart.setQty(product.id, qty - 1);
  }

  function submitGmail(e: FormEvent) {
    e.preventDefault();
    const trimmed = gmail.trim().toLowerCase();
    const v = allowAnyEmail
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
        ? null
        : "Etibarlı e-poçt ünvanı daxil edin."
      : validateStreamingDetails({ gmail: trimmed });
    if (v) {
      setErr(v);
      return;
    }
    if (needsPassword && (!password || password.length < 4)) {
      setErr("Hesab şifrəsini daxil edin (ən az 4 simvol).");
      return;
    }
    addToCart({ gmail: trimmed, password: needsPassword ? password : undefined });
  }

  return (
    <>
      {showTerms && terms && (
        <TermsModal
          terms={terms}
          serviceLabel={serviceLabel}
          theme={theme}
          mode="confirm"
          onClose={() => setShowTerms(false)}
          onConfirm={acceptTerms}
        />
      )}

      {!stock ? (
        <div className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-zinc-800 px-3 text-xs font-black text-zinc-500">
          Stokda yoxdur
        </div>
      ) : inCart ? (
        <div className="inline-flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              decrement();
            }}
            aria-label={qty <= 1 ? `${product.title} səbətdən çıxar` : "Sayı azalt"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-100 transition hover:bg-emerald-500/40"
          >
            {qty <= 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          </button>
          <span className="min-w-0 flex-1 text-center text-sm font-black tabular-nums text-emerald-50">
            {qty}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              increment();
            }}
            aria-label="Sayı artır"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-100 transition hover:bg-emerald-500/40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleAdd();
          }}
          aria-label={`${product.title} səbətə əlavə et`}
          className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-3 text-xs font-black text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.75)] transition bg-gradient-to-r ${theme.cta} hover:shadow-[0_14px_34px_-18px_rgba(168,85,247,0.95)]`}
        >
          <ShoppingCart className="h-4 w-4 shrink-0" />
          <span className="truncate">Səbətə əlavə et</span>
        </button>
      )}

      {showGmail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <form
            onSubmit={submitGmail}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {needsPassword ? "Hesab məlumatları" : allowAnyEmail ? "Netflix hesab e-poçtu" : "Gmail ünvanı"}
              </h3>
              <button
                type="button"
                onClick={() => setShowGmail(false)}
                className="text-zinc-500 transition hover:text-white"
                aria-label="Bağla"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-zinc-400">
              {needsPassword
                ? "Abunəlik bu Gmail hesabına qoşulacaq — admin hesaba giriş edib abunəliyi aktivləşdirir. Sifariş zamanı dəqiqləşdir."
                : allowAnyEmail
                  ? "Plan birbaşa SƏNİN Netflix hesabına aktivləşdiriləcək. Netflix hesabının e-poçt ünvanını yaz (hər provayder olar)."
                  : "Abunəlik bu Gmail hesabına qoşulacaq. Sifariş zamanı dəqiqləşdir."}
            </p>
            <input
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              type="email"
              placeholder={allowAnyEmail ? "netflix-hesabin@nümunə.com" : "ad@gmail.com"}
              autoFocus
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-white outline-none transition focus:border-indigo-500"
            />
            {needsPassword && (
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="text"
                placeholder="Hesab şifrəsi"
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-white outline-none transition focus:border-indigo-500"
              />
            )}
            {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowGmail(false)}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                type="submit"
                className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${theme.cta} px-4 py-2 text-sm font-bold text-white`}
              >
                <ShoppingCart className="h-4 w-4" />
                Səbətə əlavə et
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
