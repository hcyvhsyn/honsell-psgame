"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
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
};


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

function compactLogoText(label: string) {
  if (label.length <= 9) return label;
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("");
  return initials ? initials.toUpperCase().slice(0, 3) : label.slice(0, 3).toUpperCase();
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

export default function StreamingPlanPicker({
  products,
  productType = "STREAMING",
  authMode,
  platformKind,
  heroImageUrl,
  serviceOverride,
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

  const durationOptions = useMemo(() => {
    return enriched
      .filter((x) => x.m.seats === effectiveSeats)
      .sort((a, b) => a.m.durationMonths - b.m.durationMonths);
  }, [effectiveSeats, enriched]);

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

  if (enriched.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-400">
        Aktiv plan yoxdur.
      </div>
    );
  }

  const serviceCode =
    serviceOverride?.code || durationOptions[0]?.m.service || enriched[0]?.m.service || "STREAMING";
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

      <ServiceOverview
        service={service}
        theme={theme}
        seats={effectiveSeats}
        vpnRequired={vpnRequired}
        deliveryLabel={deliveryLabel}
        devices={supportedDevices}
        imageUrl={platformImage}
      />

      <section aria-label="Müddət" className="space-y-3">
        <p className="text-sm font-semibold text-zinc-300">Müddət</p>
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
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

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

function ServiceOverview({
  service,
  theme,
  seats,
  vpnRequired,
  deliveryLabel,
  devices,
  imageUrl,
}: {
  service: ServiceDisplay;
  theme: ServiceTheme;
  seats: number;
  vpnRequired: boolean;
  deliveryLabel: string;
  devices: string[];
  imageUrl: string | null;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[28px] border ${theme.accentBorder} bg-zinc-950/85 p-4 shadow-2xl sm:p-5 lg:p-6`}
      aria-label={`${service.label} plan məlumatı`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.panelGlow}`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="relative grid gap-6 lg:grid-cols-[minmax(280px,0.85fr)_1.15fr] lg:items-center">
        <div className="relative aspect-square overflow-hidden rounded-[22px] border border-white/10 bg-black">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_100%,rgba(168,85,247,0.36),transparent_48%)]" />
          <div className="absolute left-5 top-5 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-2xl font-black leading-none text-white shadow-2xl backdrop-blur-md sm:left-7 sm:top-7 sm:text-3xl">
            {service.label}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br ${theme.logoGradient} p-2 text-center text-sm font-black leading-none text-white shadow-[0_0_26px_rgba(124,58,237,0.35)]`}>
                {compactLogoText(service.label)}
              </div>
              <div className="min-w-0">
                <h3 className="text-3xl font-black leading-tight text-white sm:text-4xl">{service.label}</h3>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-400">{service.tagline}</p>
                <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-zinc-500">{service.description}</p>
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                vpnRequired
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-100"
                  : "border-blue-400/40 bg-blue-500/10 text-blue-50"
              }`}
            >
              {vpnRequired ? <ShieldAlert className="h-5 w-5" /> : <Globe2 className="h-5 w-5" />}
              {vpnRequired ? "VPN tələb olunur" : "VPN lazım deyil"}
            </div>
          </div>

          <div className="grid rounded-2xl border border-white/10 bg-black/30 sm:grid-cols-4">
            <FeatureTile Icon={Monitor} label="HD keyfiyyət" />
            <FeatureTile Icon={Zap} label={deliveryLabel} />
            <FeatureTile Icon={Users} label={`${seats} nəfər`} />
            <FeatureTile Icon={ShieldCheck} label="Təhlükəsiz ödəniş" />
          </div>

          {devices.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className={`text-sm font-bold ${theme.accentText}`}>Dəstəklənən cihazlar</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {devices.map((device) => {
                  const meta = DEVICE_META[device];
                  const Icon = meta.Icon;
                  return (
                    <div
                      key={device}
                      className="flex items-center gap-3 border-white/10 text-sm font-medium text-zinc-100 sm:border-r sm:last:border-r-0"
                    >
                      <Icon className="h-7 w-7 text-violet-200" />
                      {meta.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FeatureTile({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3 border-white/10 px-4 py-4 text-sm text-zinc-200 sm:border-r sm:last:border-r-0">
      <Icon className="h-6 w-6 text-violet-300" />
      <span>{label}</span>
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
}: {
  product: PlanProduct;
  meta: Meta;
  theme: ServiceTheme;
  productType: string;
  authMode?: "GMAIL" | "GMAIL_PASSWORD";
  platformKind?: string;
}) {
  const cart = useCart();
  const stock = inStock();
  const qty = cart.hydrated ? cart.items.find((i) => i.id === product.id)?.qty ?? 0 : 0;
  const inCart = qty > 0;
  const finalAzn = product.priceAznCents / 100;

  const needsAuth = authMode === "GMAIL" || authMode === "GMAIL_PASSWORD" || meta.deliveryMode === "GMAIL";
  const needsPassword = authMode === "GMAIL_PASSWORD";

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

  function handleAdd() {
    if (!stock) return;
    if (needsAuth) {
      setShowGmail(true);
      return;
    }
    addToCart();
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
    const v = validateStreamingDetails({ gmail: trimmed });
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
                {needsPassword ? "Hesab məlumatları" : "Gmail ünvanı"}
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
                : "Abunəlik bu Gmail hesabına qoşulacaq. Sifariş zamanı dəqiqləşdir."}
            </p>
            <input
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              type="email"
              placeholder="ad@gmail.com"
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
