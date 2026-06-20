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
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { useCart, type PlatformAccountCredential } from "@/lib/cart";
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
    ring: "border-[#1ed760]/50",
    badge: "bg-[#1ed760] text-[#031007]",
    text: "text-[#7dffa9]",
    glow: "shadow-[0_20px_70px_-45px_rgba(30,215,96,0.8)]",
  },
  DUO: {
    ring: "border-[#8ef0ff]/40",
    badge: "bg-[#8ef0ff] text-[#061016]",
    text: "text-[#a9f5ff]",
    glow: "shadow-[0_20px_70px_-45px_rgba(142,240,255,0.75)]",
  },
  FAMILY: {
    ring: "border-[#ffd166]/50",
    badge: "bg-[#ffd166] text-[#171002]",
    text: "text-[#ffe3a0]",
    glow: "shadow-[0_20px_70px_-45px_rgba(255,209,102,0.75)]",
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
      <div className="rounded-lg border border-dashed border-[#1ed760]/30 bg-[#07120b] px-4 py-16 text-center text-sm text-[#8fa99a]">
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

  function add(accounts: PlatformAccountCredential[]) {
    if (!selected) return;
    const { product } = selected;
    cart.add({
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl ?? heroImage,
      finalAzn: product.priceAznCents / 100,
      productType: "PLATFORM",
      streaming: { accounts, platformKind: "SPOTIFY" },
    });
    cart.updateStreaming(product.id, { accounts, platformKind: "SPOTIFY" });
    setJustAdded(product.id);
    setSelected(null);
    setTimeout(() => setJustAdded((prev) => (prev === product.id ? null : prev)), 2000);
    router.refresh();
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-lg border border-[#1ed760]/20 bg-[#031007] shadow-[0_24px_90px_-60px_rgba(30,215,96,0.85)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(30,215,96,0.18),transparent_38%,rgba(142,240,255,0.08)_68%,rgba(255,209,102,0.08))]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[repeating-linear-gradient(90deg,transparent_0,transparent_24px,#ffffff_25px,#ffffff_26px)]" />

        <div className="relative grid gap-8 p-4 sm:p-6 lg:grid-cols-[1.04fr_0.96fr] lg:p-8">
          <div className="flex min-w-0 flex-col justify-between gap-7 py-2 lg:py-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#1ed760]/30 bg-[#1ed760]/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8dffb2]">
                <Headphones className="h-4 w-4" />
                Premium music
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.96] text-[#f5fff7] sm:text-6xl lg:text-7xl">
                {seoHeading ?? service.label}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#b8c8bd] sm:text-lg">
                {seoIntro ?? serviceCopy(service)}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={scrollToPlans}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1ed760] px-5 text-sm font-black text-[#031007] transition hover:bg-[#38ef7d]"
              >
                Plan seç
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openTerms}
                className="relative inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-amber-300/70 bg-amber-300/10 px-5 text-sm font-black text-[#ffe8a9] shadow-[0_0_0_3px_rgba(251,191,36,0.13),0_0_28px_rgba(251,191,36,0.24)] transition hover:bg-amber-300/20"
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

          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-[#1ed760]/25 bg-[#06140b] lg:mr-10 xl:mr-14">
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
              <div className="absolute inset-0 bg-[linear-gradient(145deg,#123b20,#031007_52%,#0a1a12)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(2,5,4,0.92),rgba(2,5,4,0.25)_55%,rgba(2,5,4,0.12))]" />
            <div className="absolute bottom-5 left-5 right-5 sm:right-24">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7dffa9]">
                    {compactServiceLabel(service.label)}
                  </p>
                  <p className="mt-2 text-3xl font-black leading-none text-[#f7fff9] sm:text-4xl">
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
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7dffa9]">
              Planlar
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#f5fff7] sm:text-3xl">
              Özünə uyğun Spotify paketini seç
            </h2>
            {currentTier && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#95aa9b]">
                {PLAN_BLURB[currentTier]}
              </p>
            )}
          </div>

          <div className="inline-flex w-full rounded-lg border border-[#23452f] bg-[#06120a] p-1 sm:w-auto">
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
                      ? "bg-[#1ed760] text-[#031007]"
                      : "text-[#a4b7aa] hover:bg-[#102418] hover:text-[#f5fff7]"
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
                className={`group relative flex min-h-[430px] flex-col overflow-hidden rounded-lg border ${accent.ring} bg-[#06120a] ${accent.glow} transition duration-200 hover:-translate-y-0.5 hover:border-[#1ed760]`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-[#020504]">
                  {productImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={productImage}
                      alt={product.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,#1ed760,#063d1b_46%,#020504)]" />
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(2,5,4,0.86),rgba(2,5,4,0.18))]" />
                  <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-black ${accent.badge}`}>
                    {SPOTIFY_PLAN_LABELS[meta.planTier]}
                  </span>
                  {meta.discountPct > 0 && (
                    <span className="absolute right-3 top-3 rounded-md bg-[#f8ff7a] px-2.5 py-1 text-xs font-black text-[#121406]">
                      -{meta.discountPct}%
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                    <span className="text-4xl font-black leading-none text-[#f7fff9]">
                      {meta.durationMonths ?? "P"}
                    </span>
                    <span className="pb-1 text-sm font-bold text-[#cfe9d5]">
                      {meta.durationMonths ? "ay" : "remium"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xl font-black leading-tight text-[#f5fff7]">
                        {product.title}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-[#9eb2a5]">
                        {planSubtitle(meta)}
                      </p>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#1ed760]/25 bg-[#1ed760]/10">
                      <Disc3 className={`h-5 w-5 ${accent.text}`} />
                    </div>
                  </div>

                  {product.description && (
                    <p className="mt-3 text-sm leading-relaxed text-[#839489]">
                      {product.description}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-[#b9cec0]">
                    <PlanFact icon={<CalendarDays className="h-4 w-4" />} label={monthLabel(meta.durationMonths)} />
                    <PlanFact icon={<KeyRound className="h-4 w-4" />} label={`${meta.accountSlots} hesab`} />
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        {meta.originalPriceAznCents && meta.originalPriceAznCents > product.priceAznCents && (
                          <p className="text-sm font-semibold text-[#6c7f72] line-through">
                            {fmtAzn(meta.originalPriceAznCents)}
                          </p>
                        )}
                        <p className="text-3xl font-black tabular-nums text-[#f7fff9]">
                          {fmtAzn(product.priceAznCents)}
                        </p>
                        {perMonth != null && (
                          <p className="mt-1 text-xs font-semibold text-[#8ea294]">
                            Aylıq {perMonth.toFixed(2)} AZN
                          </p>
                        )}
                      </div>
                      {meta.terms && (
                        <button
                          type="button"
                          onClick={openTerms}
                          className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 text-xs font-black text-[#ffe8a9] transition hover:bg-amber-300/20"
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
                          ? "border border-[#1ed760]/30 bg-[#1ed760]/10 text-[#9dffbd]"
                          : "bg-[#1ed760] text-[#031007] hover:bg-[#38ef7d]"
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
        <AccountsModal
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
    <div className="flex min-h-16 items-center gap-3 rounded-lg border border-[#1ed760]/20 bg-[#06120a]/90 px-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1ed760]/10 text-[#8dffb2]">
        {icon}
      </span>
      <span className="text-sm font-bold leading-tight text-[#d9f5df]">{label}</span>
    </div>
  );
}

function EqualizerMark() {
  return (
    <div className="flex h-16 w-24 items-end justify-end gap-1.5" aria-hidden="true">
      {[34, 52, 42, 64, 30, 56].map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="w-2 rounded-t-sm bg-[#1ed760] opacity-90"
          style={{ height }}
        />
      ))}
    </div>
  );
}

function PlanFact({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-lg border border-[#1ed760]/10 bg-[#0a1a10] px-3">
      <span className="text-[#7dffa9]">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function TermsContent({ rows }: { rows: TermRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="mt-5 rounded-lg border border-amber-300/25 bg-[#0e120c] p-5 text-sm leading-relaxed text-[#e0d5b5]">
        Bu paketlər üçün admin paneldə şərt mətni əlavə edilməyib. Sifarişdən əvvəl dəqiqləşdirmək üçün dəstək komandası ilə əlaqə saxla.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {rows.map((row, index) => (
        <article
          key={row.id}
          className="relative overflow-hidden rounded-lg border border-[#2d3f26] bg-[#0a100b] p-4 shadow-[0_20px_55px_-48px_rgba(30,215,96,0.85)]"
        >
          <span className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#fbbf24,#1ed760)]" />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#1ed760] px-2.5 py-1 text-xs font-black text-[#031007]">
                  {row.planLabel}
                </span>
                <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-xs font-black text-[#ffe4a3]">
                  {row.durationLabel}
                </span>
              </div>
              <h3 className="mt-3 text-base font-black leading-snug text-[#f8fff9]">
                {row.title}
              </h3>
            </div>
            <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md border border-amber-300/25 bg-amber-300/10 px-2 text-xs font-black text-[#ffe4a3]">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-line rounded-lg border border-white/5 bg-black/20 p-3 text-sm leading-relaxed text-[#d9e4d5]">
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
        className="max-h-[min(90vh,780px)] w-full max-w-4xl overflow-hidden rounded-lg border border-amber-300/35 bg-[#050806] shadow-[0_36px_110px_-55px_rgba(251,191,36,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-[linear-gradient(90deg,#fbbf24,#1ed760_46%,#8ef0ff)]" />
        <div className="relative max-h-[calc(min(90vh,780px)_-_6px)] overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-amber-300/15 bg-[#050806]/95 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
              <div className="flex min-w-0 gap-3 sm:gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-amber-300/45 bg-[linear-gradient(145deg,rgba(251,191,36,0.22),rgba(30,215,96,0.12))] text-[#ffe08a] shadow-[0_0_30px_rgba(251,191,36,0.18)]">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#ffe4a3]">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.85)]" />
                    Vacib xəbərdarlıq
                  </div>
                  <p className="mt-2 text-xl font-black leading-tight text-[#f8fff9] sm:text-2xl">
                    Sifarişdən əvvəl şərtləri oxu
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#9fb1a3]">{serviceLabel}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Bağla"
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 text-[#b9c7ba] transition hover:bg-white/10 hover:text-[#f8fff9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="rounded-lg border border-amber-300/25 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(30,215,96,0.08)_58%,rgba(142,240,255,0.08))] p-4">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-300 text-[#181000]">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black text-[#fff1bd]">
                    Premium aktivləşdirməsində region və Spotify qərarları risk yarada bilər.
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#d7e1d4]">
                    Planı seçməzdən əvvəl aşağıdakı mətnləri tam oxu. Bu şərtlər sifarişə davam edəndə qəbul edilmiş sayılır.
                  </p>
                </div>
              </div>
            </div>

            <TermsContent rows={rows} />

            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold leading-relaxed text-[#8fa296]">
                Səbətə əlavə edərkən bu şərtləri oxuduğunu ayrıca təsdiqləyəcəksən.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1ed760] px-5 text-sm font-black text-[#031007] transition hover:bg-[#38ef7d]"
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

function AccountsModal({
  title,
  slots,
  hasTerms,
  onClose,
  onOpenTerms,
  onSubmit,
}: {
  title: string;
  slots: number;
  hasTerms: boolean;
  onClose: () => void;
  onOpenTerms: () => void;
  onSubmit: (accounts: PlatformAccountCredential[]) => void;
}) {
  const [rows, setRows] = useState<PlatformAccountCredential[]>(
    Array.from({ length: slots }, () => ({ email: "", password: "" })),
  );
  const [show, setShow] = useState<boolean[]>(Array.from({ length: slots }, () => false));
  const [acceptedTerms, setAcceptedTerms] = useState(!hasTerms);
  const [err, setErr] = useState<string | null>(null);

  function patch(i: number, key: keyof PlatformAccountCredential, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
    if (err) setErr(null);
  }

  function submit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleaned: PlatformAccountCredential[] = [];
    for (let i = 0; i < rows.length; i++) {
      const email = rows[i].email.trim().toLowerCase();
      const password = rows[i].password;
      if (!email || !emailRegex.test(email)) {
        setErr(`${i + 1}-ci hesab üçün düzgün email daxil et.`);
        return;
      }
      if (!password || password.length < 4) {
        setErr(`${i + 1}-ci hesab üçün şifrə daxil et (ən az 4 simvol).`);
        return;
      }
      cleaned.push({ email, password });
    }
    if (hasTerms && !acceptedTerms) {
      setErr("Səbətə əlavə etməzdən əvvəl şərtləri qəbul et.");
      return;
    }
    onSubmit(cleaned);
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[min(92vh,760px)] w-full max-w-xl overflow-y-auto rounded-lg border border-[#1ed760]/30 bg-[#030806] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#1ed760]/10 p-5">
          <div>
            <p className="text-lg font-black text-[#f5fff7]">Hesab məlumatları</p>
            <p className="mt-0.5 text-sm text-[#9bad9f]">{title}</p>
            <p className="mt-1 text-xs font-semibold text-[#7dffa9]">
              {slots} hesab üçün email və şifrə daxil et.
            </p>
          </div>
          <button
            type="button"
            aria-label="Bağla"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#8ea294] transition hover:bg-white/10 hover:text-[#f5fff7]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-[#1ed760]/20 bg-[#06120a] p-3 text-xs leading-relaxed text-[#9db3a4]">
            Məlumatlar yalnız Premium aktivləşdirməsi üçün istifadə olunur və ödəniş mərhələsində
            sifarişlə birlikdə göndərilir.
          </div>

          {rows.map((row, i) => (
            <div key={i} className="rounded-lg border border-[#1ed760]/10 bg-[#06120a] p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#7dffa9]">
                Hesab {i + 1}
              </p>
              <label className="block text-sm font-semibold text-[#cce6d3]">
                Email
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7dffa9]" />
                  <input
                    type="email"
                    autoComplete="off"
                    value={row.email}
                    onChange={(e) => patch(i, "email", e.target.value)}
                    placeholder="hesab@example.com"
                    className="h-12 w-full rounded-lg border border-[#23452f] bg-[#030806] pl-12 pr-4 text-sm text-[#f5fff7] outline-none placeholder:text-[#506455] transition focus:border-[#1ed760]"
                  />
                </div>
              </label>
              <label className="mt-3 block text-sm font-semibold text-[#cce6d3]">
                Şifrə
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7dffa9]" />
                  <input
                    type={show[i] ? "text" : "password"}
                    autoComplete="off"
                    value={row.password}
                    onChange={(e) => patch(i, "password", e.target.value)}
                    placeholder="Hesab şifrəsi"
                    className="h-12 w-full rounded-lg border border-[#23452f] bg-[#030806] pl-12 pr-12 text-sm text-[#f5fff7] outline-none placeholder:text-[#506455] transition focus:border-[#1ed760]"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#819284] transition hover:bg-white/10 hover:text-[#f5fff7]"
                    aria-label={show[i] ? "Şifrəni gizlət" : "Şifrəni göstər"}
                  >
                    {show[i] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            </div>
          ))}

          {hasTerms && (
            <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex min-w-0 items-center gap-3 text-sm font-bold text-[#ffe8a9]">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (err) setErr(null);
                    }}
                    className="h-4 w-4 accent-[#1ed760]"
                  />
                  Şərtləri oxudum və qəbul edirəm.
                </label>
                <button
                  type="button"
                  onClick={onOpenTerms}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300/40 px-3 text-xs font-black text-[#ffe8a9] transition hover:bg-amber-300/10"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Şərtlər
                </button>
              </div>
            </div>
          )}

          {err && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
              {err}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-lg border border-[#2d4234] text-sm font-bold text-[#b8c8bd] transition hover:bg-white/10"
            >
              Ləğv et
            </button>
            <button
              type="button"
              onClick={submit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1ed760] text-sm font-black text-[#031007] transition hover:bg-[#38ef7d]"
            >
              <ShoppingCart className="h-5 w-5" />
              Səbətə əlavə et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
