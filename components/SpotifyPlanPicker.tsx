"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  Disc3,
  Headphones,
  KeyRound,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { useCart, type PlatformAccountCredential } from "@/lib/cart";
import SpotifyAccountsModal from "@/components/SpotifyAccountsModal";
import {
  SPOTIFY_PLAN_LABELS,
  SPOTIFY_PLAN_TIERS,
  type SpotifyPlanTier,
} from "@/lib/platformSubscriptions";

type Product = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
};

type ServiceInfo = {
  code: string;
  slug: string;
  label: string;
  tagline: string;
  description: string;
  heroImageUrl: string | null;
};

type Props = {
  products: Product[];
  service: ServiceInfo;
  /** SEO üçün H1 mətnini override edir (səhifədə yalnız bir H1 olsun). */
  seoHeading?: string;
  /** Hero altındakı təsviri (açar söz zəngin) mətni override edir. */
  seoIntro?: string;
  /** Hero görselinin alt text-i (generic deyil, açar söz zəngin olsun). */
  heroAlt?: string;
};

type PlanMeta = {
  durationMonths: number | null;
  originalPriceAznCents: number | null;
  accountSlots: number;
  planTier: SpotifyPlanTier;
  terms: string | null;
  discountPct: number;
};

type PlanItem = {
  product: Product;
  meta: PlanMeta;
};

type TermRow = {
  id: string;
  title: string;
  planLabel: string;
  durationLabel: string;
  terms: string;
};

const PLAN_BLURB: Record<SpotifyPlanTier, string> = {
  INDIVIDUAL: "Fərdi hesab üçün Premium aktivləşdirmə.",
  DUO: "İki ayrı Spotify hesabı üçün birlikdə daha sərfəli plan.",
  FAMILY: "Ailə və qrup istifadəsi üçün çoxhesablı Premium plan.",
};

const PLAN_ACCENT: Record<
  SpotifyPlanTier,
  { ring: string; badge: string; text: string; glow: string }
> = {
  INDIVIDUAL: {
    ring: "border-violet-500/50",
    badge: "bg-violet-600 text-white",
    text: "text-violet-700 dark:text-violet-300",
    glow: "shadow-[0_20px_70px_-45px_rgba(139,92,246,0.8)]",
  },
  DUO: {
    ring: "border-violet-300/40",
    badge: "bg-violet-300 text-zinc-950",
    text: "text-violet-700 dark:text-violet-300",
    glow: "shadow-[0_20px_70px_-45px_rgba(167,139,250,0.75)]",
  },
  FAMILY: {
    ring: "border-amber-300/50",
    badge: "bg-amber-300 text-zinc-950",
    text: "text-amber-700 dark:text-amber-200",
    glow: "shadow-[0_20px_70px_-45px_rgba(251,191,36,0.75)]",
  },
};

function readMeta(p: Product): PlanMeta | null {
  const m =
    p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
      ? (p.metadata as Record<string, unknown>)
      : {};
  const tierRaw = String(m.planTier ?? "").toUpperCase();
  if (!SPOTIFY_PLAN_TIERS.includes(tierRaw as SpotifyPlanTier)) return null;

  const planTier = tierRaw as SpotifyPlanTier;
  const opc = Number(m.originalPriceAznCents);
  const durationMonths = Number(m.durationMonths);
  const slots = Number(m.accountSlots);
  const originalPriceAznCents = Number.isFinite(opc) && opc > 0 ? opc : null;
  const terms = typeof m.terms === "string" && m.terms.trim() ? m.terms.trim() : null;

  return {
    durationMonths: Number.isInteger(durationMonths) && durationMonths > 0 ? durationMonths : null,
    originalPriceAznCents,
    accountSlots: Number.isInteger(slots) && slots >= 1 ? slots : 1,
    planTier,
    terms,
    discountPct:
      originalPriceAznCents && originalPriceAznCents > p.priceAznCents
        ? Math.round(((originalPriceAznCents - p.priceAznCents) / originalPriceAznCents) * 100)
        : 0,
  };
}

function fmtAzn(cents: number) {
  return `${(cents / 100).toFixed(2)} AZN`;
}

function monthLabel(months: number | null) {
  return months ? `${months} ay` : "Abunəlik";
}

function planSubtitle(meta: PlanMeta) {
  return `${monthLabel(meta.durationMonths)} · ${meta.accountSlots} hesab`;
}

function compactServiceLabel(label: string) {
  return label.replace(/\s+Premium$/i, "").trim() || label;
}

function serviceCopy(service: ServiceInfo) {
  return (
    service.description ||
    (service.tagline && service.tagline !== service.label ? service.tagline : "") ||
    "Premium planını seç, hesab məlumatlarını daxil et və sifarişdən sonra aktivləşdirməni admin tamamlasın."
  );
}

export default function SpotifyPlanPicker({
  products,
  service,
  seoHeading,
  seoIntro,
  heroAlt,
}: Props) {
  const cart = useCart();
  const router = useRouter();
  const [activeTier, setActiveTier] = useState<SpotifyPlanTier | null>(null);
  const [selected, setSelected] = useState<PlanItem | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const groups = useMemo(() => {
    const byTier = new Map<SpotifyPlanTier, PlanItem[]>();
    for (const p of products) {
      const meta = readMeta(p);
      if (!meta) continue;
      const arr = byTier.get(meta.planTier) ?? [];
      arr.push({ product: p, meta });
      byTier.set(meta.planTier, arr);
    }
    for (const arr of byTier.values()) {
      arr.sort((a, b) => (a.meta.durationMonths ?? 0) - (b.meta.durationMonths ?? 0));
    }
    return SPOTIFY_PLAN_TIERS.filter((t) => byTier.has(t)).map((tier) => ({
      tier,
      items: byTier.get(tier)!,
    }));
  }, [products]);

  const currentTier = activeTier && groups.some((g) => g.tier === activeTier)
    ? activeTier
    : groups[0]?.tier ?? null;
  const currentItems = groups.find((g) => g.tier === currentTier)?.items ?? [];

  const heroImage =
    service.heroImageUrl ||
    currentItems.find((x) => x.product.imageUrl)?.product.imageUrl ||
    products.find((p) => p.imageUrl)?.imageUrl ||
    null;

  const termRows = useMemo<TermRow[]>(() => {
    return products
      .map((p) => {
        const meta = readMeta(p);
        if (!meta?.terms) return null;
        return {
          id: p.id,
          title: p.title,
          planLabel: SPOTIFY_PLAN_LABELS[meta.planTier],
          durationLabel: monthLabel(meta.durationMonths),
          terms: meta.terms,
        };
      })
      .filter((row): row is TermRow => row !== null);
  }, [products]);

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-violet-500/30 bg-zinc-900 px-4 py-16 text-center text-sm text-zinc-400">
        Spotify Premium üçün hələ aktiv paket yoxdur.
      </div>
    );
  }

  function openTerms() {
    setShowTermsModal(true);
  }

  function scrollToPlans() {
    document.getElementById("spotify-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function add(accounts: PlatformAccountCredential[], hasAccount: boolean) {
    if (!selected) return;
    const { product } = selected;
    cart.add({
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl ?? heroImage,
      finalAzn: product.priceAznCents / 100,
      productType: "PLATFORM",
      streaming: { accounts, platformKind: "SPOTIFY", hasAccount },
    });
    cart.updateStreaming(product.id, { accounts, platformKind: "SPOTIFY", hasAccount });
    setJustAdded(product.id);
    setSelected(null);
    setTimeout(() => setJustAdded((prev) => (prev === product.id ? null : prev)), 2000);
    router.refresh();
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-lg border border-violet-500/20 bg-zinc-950 shadow-[0_24px_90px_-60px_rgba(139,92,246,0.85)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(139,92,246,0.18),transparent_38%,rgba(167,139,250,0.08)_68%,rgba(251,191,36,0.08))]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[repeating-linear-gradient(90deg,transparent_0,transparent_24px,#ffffff_25px,#ffffff_26px)]" />

        <div className="relative grid gap-8 p-4 sm:p-6 lg:grid-cols-[1.04fr_0.96fr] lg:p-8">
          <div className="flex min-w-0 flex-col justify-between gap-7 py-2 lg:py-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-600/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
                <Headphones className="h-4 w-4" />
                Premium music
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.96] text-white sm:text-6xl lg:text-7xl">
                {seoHeading ?? service.label}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                {seoIntro ?? serviceCopy(service)}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={scrollToPlans}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"
              >
                Plan seç
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openTerms}
                className="relative inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-amber-300/70 bg-amber-300/10 px-5 text-sm font-black text-amber-700 dark:text-amber-200 shadow-[0_0_0_3px_rgba(251,191,36,0.13),0_0_28px_rgba(251,191,36,0.24)] transition hover:bg-amber-300/20"
              >
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_0_6px_rgba(251,191,36,0.24)]" />
                <AlertTriangle className="h-4 w-4" />
                Şərtlər
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <HeroMetric icon={<BadgeCheck className="h-5 w-5" />} label="Premium aktivləşmə" />
              <HeroMetric icon={<Clock3 className="h-5 w-5" />} label="Admin təsdiqi" />
              <HeroMetric icon={<ShieldCheck className="h-5 w-5" />} label="Təhlükəsiz ödəniş" />
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-violet-500/25 bg-zinc-900 lg:mr-10 xl:mr-14">
            {heroImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={heroImage}
                alt={heroAlt ?? service.label}
                loading="eager"
                fetchPriority="high"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(145deg,#2e1065,#09090b_52%,#18181b)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(9,9,11,0.92),rgba(9,9,11,0.25)_55%,rgba(9,9,11,0.12))]" />
            <div className="absolute bottom-5 left-5 right-5 sm:right-24">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">
                    {compactServiceLabel(service.label)}
                  </p>
                  {/* Qaranlıq şəkil üstündədir: text-zinc-50 açıq temada qaralmır. */}
                  <p className="mt-2 text-3xl font-black leading-none text-zinc-50 sm:text-4xl">
                    Premium
                  </p>
                </div>
                <EqualizerMark />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="spotify-plans"
        aria-label="Spotify Premium planları"
        className="mt-8 scroll-mt-24 space-y-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
              Planlar
            </p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              Özünə uyğun Spotify paketini seç
            </h2>
            {currentTier && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                {PLAN_BLURB[currentTier]}
              </p>
            )}
          </div>

          <div className="inline-flex w-full rounded-lg border border-zinc-800 bg-zinc-900 p-1 sm:w-auto">
            {groups.map(({ tier }) => {
              const isActive = tier === currentTier;
              return (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveTier(tier)}
                  className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-black transition sm:flex-none ${
                    isActive
                      ? "bg-violet-600 text-white"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  {SPOTIFY_PLAN_LABELS[tier]}
                </button>
              );
            })}
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {currentItems.map((item) => {
            const { product, meta } = item;
            const added = justAdded === product.id || cart.has(product.id);
            const accent = PLAN_ACCENT[meta.planTier];
            const productImage = product.imageUrl ?? heroImage;
            const perMonth =
              meta.durationMonths && meta.durationMonths > 0
                ? product.priceAznCents / 100 / meta.durationMonths
                : null;

            return (
              <li
                key={product.id}
                className={`group relative flex min-h-[430px] flex-col overflow-hidden rounded-lg border ${accent.ring} bg-zinc-900 ${accent.glow} transition duration-200 hover:-translate-y-0.5 hover:border-violet-500`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-zinc-950">
                  {productImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={productImage}
                      alt={product.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,#8b5cf6,#2e1065_46%,#09090b)]" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(9,9,11,0.86),rgba(9,9,11,0.18))]" />
                  <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-black ${accent.badge}`}>
                    {SPOTIFY_PLAN_LABELS[meta.planTier]}
                  </span>
                  {meta.discountPct > 0 && (
                    <span className="absolute right-3 top-3 rounded-md bg-amber-200 px-2.5 py-1 text-xs font-black text-zinc-950">
                      -{meta.discountPct}%
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                    <span className="text-4xl font-black leading-none text-zinc-50">
                      {meta.durationMonths ?? "P"}
                    </span>
                    <span className="pb-1 text-sm font-bold text-zinc-50/80">
                      {meta.durationMonths ? "ay" : "remium"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xl font-black leading-tight text-white">
                        {product.title}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-zinc-400">
                        {planSubtitle(meta)}
                      </p>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-violet-500/25 bg-violet-600/10">
                      <Disc3 className={`h-5 w-5 ${accent.text}`} />
                    </div>
                  </div>

                  {product.description && (
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                      {product.description}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-zinc-400">
                    <PlanFact icon={<CalendarDays className="h-4 w-4" />} label={monthLabel(meta.durationMonths)} />
                    <PlanFact icon={<KeyRound className="h-4 w-4" />} label={`${meta.accountSlots} hesab`} />
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        {meta.originalPriceAznCents && meta.originalPriceAznCents > product.priceAznCents && (
                          <p className="text-sm font-semibold text-zinc-500 line-through">
                            {fmtAzn(meta.originalPriceAznCents)}
                          </p>
                        )}
                        <p className="text-3xl font-black tabular-nums text-white">
                          {fmtAzn(product.priceAznCents)}
                        </p>
                        {perMonth != null && (
                          <p className="mt-1 text-xs font-semibold text-zinc-400">
                            Aylıq {perMonth.toFixed(2)} AZN
                          </p>
                        )}
                      </div>
                      {meta.terms && (
                        <button
                          type="button"
                          onClick={openTerms}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 text-xs font-black text-amber-700 dark:text-amber-200 transition hover:bg-amber-300/20"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Şərtlər
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      disabled={added}
                      className={`mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition disabled:cursor-not-allowed ${
                        added
                          ? "border border-violet-500/30 bg-violet-600/10 text-violet-700 dark:text-violet-300"
                          : "bg-violet-600 text-white hover:bg-violet-500"
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="h-5 w-5" /> Səbətdədir
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-5 w-5" /> Səbətə əlavə et
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {selected && (
        <SpotifyAccountsModal
          title={selected.product.title}
          slots={selected.meta.accountSlots}
          hasTerms={termRows.length > 0}
          onClose={() => setSelected(null)}
          onOpenTerms={openTerms}
          onSubmit={add}
        />
      )}

      {showTermsModal && (
        <TermsModal rows={termRows} serviceLabel={service.label} onClose={() => setShowTermsModal(false)} />
      )}
    </>
  );
}

function HeroMetric({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-lg border border-violet-500/20 bg-zinc-900/90 px-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-600/10 text-violet-700 dark:text-violet-300">
        {icon}
      </span>
      <span className="text-sm font-bold leading-tight text-zinc-200">{label}</span>
    </div>
  );
}

function EqualizerMark() {
  return (
    <div className="flex h-16 w-24 items-end justify-end gap-1.5" aria-hidden="true">
      {[34, 52, 42, 64, 30, 56].map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="w-2 rounded-t-sm bg-violet-600 opacity-90"
          style={{ height }}
        />
      ))}
    </div>
  );
}

function PlanFact({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-lg border border-violet-500/10 bg-zinc-800 px-3">
      <span className="text-violet-700 dark:text-violet-300">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function TermsContent({ rows }: { rows: TermRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mt-5 rounded-lg border border-amber-300/25 bg-zinc-900 p-5 text-sm leading-relaxed text-amber-700 dark:text-amber-100">
        Bu paketlər üçün admin paneldə şərt mətni əlavə edilməyib. Sifarişdən əvvəl dəqiqləşdirmək üçün dəstək komandası ilə əlaqə saxla.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {rows.map((row, index) => (
        <article
          key={row.id}
          className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-[0_20px_55px_-48px_rgba(139,92,246,0.85)]"
        >
          <span className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#fbbf24,#8b5cf6)]" />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-black text-white">
                  {row.planLabel}
                </span>
                <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-xs font-black text-amber-700 dark:text-amber-200">
                  {row.durationLabel}
                </span>
              </div>
              <h3 className="mt-3 text-base font-black leading-snug text-white">
                {row.title}
              </h3>
            </div>
            <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md border border-amber-300/25 bg-amber-300/10 px-2 text-xs font-black text-amber-700 dark:text-amber-200">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-line rounded-lg border border-zinc-200 dark:border-white/5 bg-black/20 p-3 text-sm leading-relaxed text-zinc-200">
            {row.terms}
          </p>
        </article>
      ))}
    </div>
  );
}

function TermsModal({
  rows,
  serviceLabel,
  onClose,
}: {
  rows: TermRow[];
  serviceLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${serviceLabel} şərtləri`}
        className="max-h-[min(90vh,780px)] w-full max-w-4xl overflow-hidden rounded-lg border border-amber-300/35 bg-zinc-950 shadow-[0_36px_110px_-55px_rgba(251,191,36,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-[linear-gradient(90deg,#fbbf24,#8b5cf6_46%,#a78bfa)]" />
        <div className="relative max-h-[calc(min(90vh,780px)_-_6px)] overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-amber-300/15 bg-zinc-950/95 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
              <div className="flex min-w-0 gap-3 sm:gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-amber-300/45 bg-[linear-gradient(145deg,rgba(251,191,36,0.22),rgba(139,92,246,0.12))] text-amber-700 dark:text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.18)]">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.85)]" />
                    Vacib xəbərdarlıq
                  </div>
                  <p className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">
                    Sifarişdən əvvəl şərtləri oxu
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-400">{serviceLabel}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Bağla"
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="rounded-lg border border-amber-300/25 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(139,92,246,0.08)_58%,rgba(167,139,250,0.08))] p-4">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-300 text-zinc-950">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-amber-700 dark:text-amber-200">
                    Premium aktivləşdirməsində region və Spotify qərarları risk yarada bilər.
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-200">
                    Planı seçməzdən əvvəl aşağıdakı mətnləri tam oxu. Bu şərtlər sifarişə davam edəndə qəbul edilmiş sayılır.
                  </p>
                </div>
              </div>
            </div>

            <TermsContent rows={rows} />

            <div className="mt-5 flex flex-col gap-3 border-t border-zinc-200 dark:border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold leading-relaxed text-zinc-400">
                Səbətə əlavə edərkən bu şərtləri oxuduğunu ayrıca təsdiqləyəcəksən.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"
              >
                <Check className="h-5 w-5" />
                Başa düşdüm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
