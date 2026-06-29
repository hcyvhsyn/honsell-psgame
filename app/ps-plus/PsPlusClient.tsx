"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Crown, CheckCircle2, Plus, Sparkles, Check, Minus } from "lucide-react";
import { useCart } from "@/lib/cart";
import ReferralBadge from "@/components/ReferralBadge";

type Plan = {
  id: string;
  title: string;
  imageUrl?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
};

type TierKey = "ESSENTIAL" | "EXTRA" | "DELUXE";

const TIERS: TierKey[] = ["ESSENTIAL", "EXTRA", "DELUXE"];

// Üç tier arasındakı fərqlər tək siyahıda — hər tier üzrə hansılar daxildir.
// Sıra önəmlidir: oxşar imkanlar yan-yana görsənir.
const FEATURE_ROWS: { label: string; tiers: Record<TierKey, boolean> }[] = [
  { label: "Onlayn multiplayer", tiers: { ESSENTIAL: true, EXTRA: true, DELUXE: true } },
  { label: "Hər ay pulsuz oyunlar (2–3 oyun)", tiers: { ESSENTIAL: true, EXTRA: true, DELUXE: true } },
  { label: "Bulud yaddaşı (100 GB save)", tiers: { ESSENTIAL: true, EXTRA: true, DELUXE: true } },
  { label: "Eksklüziv mağaza endirimləri", tiers: { ESSENTIAL: true, EXTRA: true, DELUXE: true } },
  { label: "Share Play (dostla birgə oyun)", tiers: { ESSENTIAL: true, EXTRA: true, DELUXE: true } },
  { label: "Game Catalog — 400+ PS4/PS5 oyunu", tiers: { ESSENTIAL: false, EXTRA: true, DELUXE: true } },
  { label: "Ubisoft+ Classics kataloqu", tiers: { ESSENTIAL: false, EXTRA: true, DELUXE: true } },
  { label: "Klassiklər kataloqu (PS1, PS2, PSP)", tiers: { ESSENTIAL: false, EXTRA: false, DELUXE: true } },
  { label: "Game Trials (oyunun 2 saatlıq demo-su)", tiers: { ESSENTIAL: false, EXTRA: false, DELUXE: true } },
];

const TIER_TAGLINE: Record<TierKey, string> = {
  ESSENTIAL: "Onlayn oyunun və hər ay pulsuz oyunların əsas paketi.",
  EXTRA: "Essential-in hamısı + 400-dən çox PS4/PS5 oyununa giriş.",
  DELUXE: "Extra-nın hamısı + PS1, PS2, PSP klassikləri və Game Trials.",
};

const TIER_BADGE: Partial<Record<TierKey, string>> = {
  EXTRA: "Ən populyar",
  DELUXE: "Tam kolleksiya",
};

export default function PsPlusClient({ plans, hideTierSelector = false, flatMode = false }: { plans: Plan[]; hideTierSelector?: boolean; flatMode?: boolean }) {
  const [tier, setTier] = useState<TierKey>("EXTRA");
  const [addedId, setAddedId] = useState<string | null>(null);
  const { add, has } = useCart();

  const tierCounts = useMemo(() => {
    const counts: Record<TierKey, number> = { ESSENTIAL: 0, EXTRA: 0, DELUXE: 0 };
    for (const p of plans) {
      const t = String((p.metadata ?? {}).tier ?? "") as TierKey;
      if (t === "ESSENTIAL" || t === "EXTRA" || t === "DELUXE") counts[t] += 1;
    }
    return counts;
  }, [plans]);

  useEffect(() => {
    if (tierCounts.EXTRA > 0) {
      setTier("EXTRA");
      return;
    }
    if (tierCounts.ESSENTIAL > 0) {
      setTier("ESSENTIAL");
      return;
    }
    if (tierCounts.DELUXE > 0) setTier("DELUXE");
  }, [tierCounts.EXTRA, tierCounts.ESSENTIAL, tierCounts.DELUXE]);

  const tierPlans = useMemo(() => {
    if (flatMode) return plans;
    return plans.filter((p) => String((p.metadata ?? {}).tier ?? "") === tier);
  }, [plans, tier, flatMode]);

  function addToCart(selected: Plan) {
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? null,
      finalAzn: selected.priceAznCents / 100,
      productType: "PS_PLUS",
    });
    setAddedId(selected.id);
    setTimeout(() => setAddedId((cur) => (cur === selected.id ? null : cur)), 1500);
  }

  return (
    <div className="w-full">
      {/* Luxury tier selector */}
      {!hideTierSelector && (
        <div className="mb-8">
          <div className="relative rounded-2xl border border-zinc-200 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gradient-to-b dark:from-white/10 dark:to-white/5 dark:shadow-none">
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_0%,rgba(99,102,241,0.14),transparent_45%),radial-gradient(circle_at_80%_120%,rgba(16,185,129,0.12),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_0%,rgba(99,102,241,0.35),transparent_45%),radial-gradient(circle_at_80%_120%,rgba(16,185,129,0.25),transparent_50%)]" />
            <div className="relative grid grid-cols-3 gap-2 p-1">
              {TIERS.map((t) => {
                const active = tier === t;
                const disabled = (tierCounts[t] ?? 0) === 0;
                const accent =
                  t === "ESSENTIAL"
                    ? "from-sky-100 to-indigo-50 text-sky-700 dark:from-sky-400/25 dark:to-indigo-500/10 dark:text-sky-100"
                    : t === "EXTRA"
                      ? "from-emerald-100 to-emerald-50 text-emerald-700 dark:from-emerald-400/25 dark:to-emerald-500/10 dark:text-emerald-100"
                      : "from-amber-100 to-amber-50 text-amber-700 dark:from-amber-400/25 dark:to-amber-500/10 dark:text-amber-100";
                return (
                  <button
                    key={t}
                    onClick={() => (!disabled ? setTier(t) : undefined)}
                    disabled={disabled}
                    className={`relative overflow-hidden rounded-2xl px-4 py-3 text-left transition ${
                      active
                        ? `bg-gradient-to-b ${accent} shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)] ring-1 ring-zinc-200 dark:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] dark:ring-white/20`
                        : disabled
                          ? "cursor-not-allowed bg-zinc-100 text-zinc-400 opacity-60 ring-1 ring-zinc-200 dark:bg-black/10 dark:text-zinc-500 dark:ring-white/5"
                          : "bg-white/75 text-zinc-600 ring-1 ring-zinc-200 hover:bg-white hover:text-zinc-950 dark:bg-black/20 dark:text-zinc-300 dark:ring-white/5 dark:hover:bg-black/30"
                    }`}
                  >
                    {active && (
                      <span className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/70 blur-2xl dark:bg-white/10" />
                    )}
                    <div className="relative flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-white/70">
                          PS Plus
                        </div>
                        <div className="mt-0.5 text-lg font-black tracking-tight">{t}</div>
                      </div>
                      {active ? <Sparkles className="h-4 w-4 text-zinc-700 dark:text-white/80" /> : <Crown className="h-4 w-4 text-zinc-400 dark:text-white/30" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tier comparison — yalnız 3-lü seçici görünəndə (əsas /ps-plus səhifəsi). */}
      {!hideTierSelector && !flatMode && (
        <TierComparison activeTier={tier} onSelect={(t) => setTier(t)} tierCounts={tierCounts} />
      )}

      {/* Cards only */}
      {tierPlans.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tierPlans
            .slice()
            .sort((a, b) => {
              if (flatMode) {
                const order: Record<string, number> = { ESSENTIAL: 0, EXTRA: 1, DELUXE: 2 };
                return (
                  (order[String((a.metadata ?? {}).tier ?? "")] ?? 99) -
                  (order[String((b.metadata ?? {}).tier ?? "")] ?? 99)
                );
              }
              return (
                Number((a.metadata ?? {}).durationMonths ?? 0) -
                Number((b.metadata ?? {}).durationMonths ?? 0)
              );
            })
            .map((selected) => {
              const inCart = has(selected.id);
              const originalPriceCents = Number(
                (selected.metadata as Record<string, unknown> | null)?.originalPriceAznCents ?? 0
              );
              const hasDiscount =
                Number.isFinite(originalPriceCents) &&
                originalPriceCents > selected.priceAznCents;
              const durationMonths = Number(
                (selected.metadata as Record<string, unknown> | null)?.durationMonths ?? 0
              );

              let discountPercent = 0;
              if (hasDiscount && originalPriceCents > 0) {
                discountPercent = Math.round(
                  ((originalPriceCents - selected.priceAznCents) / originalPriceCents) * 100
                );
              }

              const cardTier = flatMode
                ? (String((selected.metadata ?? {}).tier ?? "") as TierKey)
                : tier;
              const isEssential = cardTier === "ESSENTIAL";
              const isExtra = cardTier === "EXTRA";

              const cardHover = isEssential
                ? "hover:border-sky-500/50 hover:shadow-[0_8px_30px_-10px_rgba(14,165,233,0.15)]"
                : isExtra
                ? "hover:border-emerald-500/50 hover:shadow-[0_8px_30px_-10px_rgba(16,185,129,0.15)]"
                : "hover:border-amber-500/50 hover:shadow-[0_8px_30px_-10px_rgba(245,158,11,0.15)]";

              const topGlow = isEssential
                ? "bg-gradient-to-r from-transparent via-sky-500 to-transparent"
                : isExtra
                ? "bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
                : "bg-gradient-to-r from-transparent via-amber-500 to-transparent";

              const discountTagBg = isEssential
                ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-0"
                : isExtra
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-0"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-0";

              // When added: dark green as in screenshot.
              const btnSuccess = "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-[#0B2A1C] dark:text-emerald-400";

              return (
                <article
                  key={selected.id}
                  className={`group relative flex flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-[#0A0A0A] dark:shadow-none ${cardHover}`}
                >
                  {/* Subtle top glow line */}
                  <div className={`absolute inset-x-0 top-0 h-[2px] w-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${topGlow}`} />

                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                    {selected.imageUrl ? (
                      <Image
                        src={selected.imageUrl}
                        alt={selected.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400 dark:from-zinc-900 dark:to-zinc-800 dark:text-zinc-500">
                        <Crown className="h-10 w-10 opacity-30" />
                      </div>
                    )}
                    {/* Inner shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-80" />
                    
                    <div className="absolute left-4 top-4 flex items-center gap-2">
                      <div className="rounded-full bg-black/50 px-3 py-1.5 text-[12px] font-semibold tracking-wide text-zinc-200 backdrop-blur-md">
                        PS Plus • {durationMonths} ay
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-2 text-lg font-bold leading-tight text-zinc-950 dark:text-white">
                      {selected.title}
                    </h3>
                    
                    <div className="mt-4 flex items-end gap-3">
                      <p className="text-[2rem] font-bold leading-none tracking-tighter text-zinc-950 dark:text-white">
                        {(selected.priceAznCents / 100).toFixed(2)} AZN
                      </p>
                    </div>

                    {hasDiscount ? (
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-base font-medium text-zinc-500 line-through decoration-zinc-400 decoration-1 dark:decoration-zinc-600">
                          {(originalPriceCents / 100).toFixed(2)} AZN
                        </p>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${discountTagBg}`}>
                          -{discountPercent}%
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 h-[24px]" /> // Spacer to keep height consistent if no discount
                    )}

                    <div className="mt-2">
                      <ReferralBadge category="psPlus" productName={selected.title} />
                    </div>

                    <div className="mt-6 flex-1 flex flex-col justify-end">
                      <button
                        onClick={() => addToCart(selected)}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                          inCart || addedId === selected.id
                            ? btnSuccess
                            : "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white/10 dark:hover:bg-white/20"
                        }`}
                      >
                        {inCart || addedId === selected.id ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Səbətə əlavə edildi
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Səbətə əlavə et
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white/70 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/20">
          Bu tier üçün aktiv paket yoxdur.
        </div>
      )}
    </div>
  );
}

const TIER_ACCENT: Record<
  TierKey,
  { ring: string; bg: string; text: string; dot: string; pill: string; gradient: string }
> = {
  ESSENTIAL: {
    ring: "ring-sky-300 dark:ring-sky-500/40",
    bg: "bg-sky-50 dark:bg-sky-500/[0.06]",
    text: "text-sky-700 dark:text-sky-200",
    dot: "text-sky-600 dark:text-sky-300",
    pill: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/30",
    gradient: "from-sky-100 via-transparent to-transparent dark:from-sky-500/10",
  },
  EXTRA: {
    ring: "ring-emerald-300 dark:ring-emerald-500/40",
    bg: "bg-emerald-50 dark:bg-emerald-500/[0.06]",
    text: "text-emerald-700 dark:text-emerald-200",
    dot: "text-emerald-600 dark:text-emerald-300",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
    gradient: "from-emerald-100 via-transparent to-transparent dark:from-emerald-500/10",
  },
  DELUXE: {
    ring: "ring-amber-300 dark:ring-amber-500/40",
    bg: "bg-amber-50 dark:bg-amber-500/[0.06]",
    text: "text-amber-700 dark:text-amber-200",
    dot: "text-amber-600 dark:text-amber-300",
    pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
    gradient: "from-amber-100 via-transparent to-transparent dark:from-amber-500/10",
  },
};

function TierComparison({
  activeTier,
  onSelect,
  tierCounts,
}: {
  activeTier: TierKey;
  onSelect: (t: TierKey) => void;
  tierCounts: Record<TierKey, number>;
}) {
  return (
    <section className="mb-10 rounded-3xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-5 shadow-sm dark:border-white/10 dark:bg-gradient-to-b dark:from-white/[0.03] dark:to-transparent dark:shadow-none sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white sm:text-xl">
            Hansı paketi seçməliyəm?
          </h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Üç paket arasındakı fərqlər. Bir tier-ə klik etsəniz, aşağıda həmin tier üzrə müddət variantları görsənəcək.
          </p>
        </div>
      </header>

      {/* Tier columns */}
      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((t) => {
          const accent = TIER_ACCENT[t];
          const active = activeTier === t;
          const disabled = (tierCounts[t] ?? 0) === 0;
          return (
            <button
              key={t}
              type="button"
              onClick={() => (!disabled ? onSelect(t) : undefined)}
              disabled={disabled}
              className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition dark:bg-zinc-950/60 dark:shadow-none ${
                active
                  ? `border-transparent ring-2 ${accent.ring} ${accent.bg}`
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {active && (
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${accent.gradient}`}
                />
              )}

              <div className="relative flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    PS Plus
                  </div>
                  <div className={`mt-0.5 text-2xl font-black tracking-tight ${active ? accent.text : "text-zinc-950 dark:text-white"}`}>
                    {t}
                  </div>
                </div>
                {TIER_BADGE[t] && (
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${accent.pill}`}>
                    {TIER_BADGE[t]}
                  </span>
                )}
              </div>

              <p className="relative mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {TIER_TAGLINE[t]}
              </p>

              <ul className="relative mt-4 space-y-2">
                {FEATURE_ROWS.map((row) => {
                  const included = row.tiers[t];
                  return (
                    <li key={row.label} className="flex items-start gap-2 text-[12.5px] leading-snug">
                      {included ? (
                        <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent.dot}`} />
                      ) : (
                        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-700" />
                      )}
                      <span className={included ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-600 dark:decoration-zinc-800"}>
                        {row.label}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="relative mt-5 flex items-center justify-between border-t border-zinc-200 pt-3 text-xs dark:border-white/5">
                <span className="text-zinc-500">
                  {disabled
                    ? "Hazırda paket yoxdur"
                    : active
                      ? "Seçildi — aşağıda müddət variantları"
                      : "Bu tier-i seç"}
                </span>
                {active ? (
                  <Sparkles className={`h-3.5 w-3.5 ${accent.dot}`} />
                ) : (
                  <span className="text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-600 dark:group-hover:text-zinc-400">→</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
