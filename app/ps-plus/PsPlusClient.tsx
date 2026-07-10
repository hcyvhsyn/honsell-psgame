"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, CheckCircle2, Crown, Plus, Sparkles } from "lucide-react";
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

const TIER_COPY: Record<
  TierKey,
  {
    badge?: string;
    eyebrow: string;
    summary: string;
    bestFor: string[];
    highlights: string[];
  }
> = {
  ESSENTIAL: {
    eyebrow: "Sadə və sərfəli seçim",
    summary:
      "Onlayn oyun, aylıq pulsuz oyunlar və bulud yaddaşı istəyənlər üçün baza paketdir.",
    bestFor: [
      "FIFA, FC, GTA və bənzər multiplayer oyunlar oynayırsansa",
      "Ən aşağı büdcə ilə aktiv PS Plus istəyirsənsə",
      "Aylıq oyunları qaçırmaq istəmirsənsə",
    ],
    highlights: ["Online multiplayer", "Aylıq 2-3 oyun", "Bulud yaddaşı"],
  },
  EXTRA: {
    badge: "Ən çox seçilən",
    eyebrow: "Qiymət və məzmun balansı",
    summary:
      "Essential-in hamısı üstəgəl 400-dən çox PS4/PS5 oyunu açılır. Əksər istifadəçi üçün ən rahat seçim budur.",
    bestFor: [
      "Yeni oyun almaq əvəzinə böyük oyun kataloqu istəyirsənsə",
      "Həm online oynayıb, həm də kitabxanadan seçim etmək istəyirsənsə",
      "Bir paketlə maksimum dəyər almaq istəyirsənsə",
    ],
    highlights: ["400+ oyun kataloqu", "Ubisoft+ Classics", "Online + aylıq oyunlar"],
  },
  DELUXE: {
    badge: "Tam paket",
    eyebrow: "Kolleksiya və nostalji",
    summary:
      "Extra-nın bütün üstünlükləri ilə yanaşı klassik PlayStation oyunları və Game Trials verir.",
    bestFor: [
      "PS1, PS2 və PSP klassiklərini də oynamaq istəyirsənsə",
      "Oyunu almamışdan əvvəl trial ilə yoxlamaq vacibdirsə",
      "PS Plus-un maksimum imkanını istəyirsənsə",
    ],
    highlights: ["Klassiklər kataloqu", "Game Trials", "400+ oyun kataloqu"],
  },
};

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

export default function PsPlusClient({
  plans,
  hideTierSelector = false,
  flatMode = false,
}: {
  plans: Plan[];
  hideTierSelector?: boolean;
  flatMode?: boolean;
}) {
  const [tier, setTier] = useState<TierKey>("EXTRA");
  const [addedId, setAddedId] = useState<string | null>(null);
  const { add, has } = useCart();

  const tierCounts = useMemo(() => {
    const counts: Record<TierKey, number> = { ESSENTIAL: 0, EXTRA: 0, DELUXE: 0 };
    for (const plan of plans) {
      const currentTier = String((plan.metadata ?? {}).tier ?? "") as TierKey;
      if (currentTier === "ESSENTIAL" || currentTier === "EXTRA" || currentTier === "DELUXE") {
        counts[currentTier] += 1;
      }
    }
    return counts;
  }, [plans]);

  useEffect(() => {
    if (tierCounts[tier] > 0) return;
    setTier(getPreferredTier(tierCounts));
  }, [tier, tierCounts]);

  const tierPlans = useMemo(() => {
    if (flatMode) return plans;
    return plans.filter((plan) => String((plan.metadata ?? {}).tier ?? "") === tier);
  }, [flatMode, plans, tier]);

  const availableDurations = useMemo(() => {
    return Array.from(
      new Set(
        tierPlans
          .map((plan) => Number((plan.metadata as Record<string, unknown> | null)?.durationMonths ?? 0))
          .filter((duration) => Number.isFinite(duration) && duration > 0)
      )
    ).sort((a, b) => a - b);
  }, [tierPlans]);

  function addToCart(selected: Plan) {
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? null,
      finalAzn: selected.priceAznCents / 100,
      productType: "PS_PLUS",
    });
    setAddedId(selected.id);
    setTimeout(() => setAddedId((current) => (current === selected.id ? null : current)), 1500);
  }

  return (
    <div className="w-full">
      {!hideTierSelector && !flatMode ? (
        <>
          <TierComparison activeTier={tier} onSelect={setTier} tierCounts={tierCounts} />

          {tierPlans.length > 0 ? (
            <section className="mb-8 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                    Seçilmiş paket
                  </div>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                    PS Plus {tier}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {TIER_COPY[tier].summary} Aşağıdan müddəti seçib səbətə əlavə edə bilərsiniz.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {availableDurations.map((duration) => (
                    <span
                      key={duration}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${TIER_ACCENT[tier].pill}`}
                    >
                      {duration} ay
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

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

              const btnSuccess =
                "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-[#0B2A1C] dark:text-emerald-400";

              return (
                <article
                  key={selected.id}
                  className={`group relative flex flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-[#0A0A0A] dark:shadow-none ${cardHover}`}
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-[2px] w-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${topGlow}`}
                  />

                  <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                    {selected.imageUrl ? (
                      <Image
                        src={selected.imageUrl}
                        alt={selected.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400 dark:from-zinc-900 dark:to-zinc-800 dark:text-zinc-500">
                        <Crown className="h-10 w-10 opacity-30" />
                      </div>
                    )}

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
                      <div className="mt-2 h-[24px]" />
                    )}

                    <div className="mt-2">
                      <ReferralBadge category="psPlus" productName={selected.title} />
                    </div>

                    <div className="mt-6 flex flex-1 flex-col justify-end">
                      <button
                        type="button"
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

function TierComparison({
  activeTier,
  onSelect,
  tierCounts,
}: {
  activeTier: TierKey;
  onSelect: (tier: TierKey) => void;
  tierCounts: Record<TierKey, number>;
}) {
  return (
    <section className="mb-8 rounded-[30px] border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-5 shadow-sm dark:border-white/10 dark:bg-gradient-to-b dark:from-white/[0.03] dark:to-transparent dark:shadow-none sm:p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
            Paket seçimi
          </div>
          <h2 className="mt-2 text-lg font-bold tracking-tight text-zinc-950 dark:text-white sm:text-xl">
            Hansı paketi seçməliyəm?
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Qısa qayda: yalnız online üçün Essential, böyük oyun kataloqu üçün Extra,
            maksimum məzmun üçün Deluxe. Kartlardan birini seçin, aşağıda uyğun müddətlər
            açılacaq.
          </p>
        </div>
      </header>

      <div className="mb-5 grid gap-3 rounded-2xl border border-dashed border-zinc-200 bg-white/70 p-4 dark:border-white/10 dark:bg-black/10 lg:grid-cols-3">
        <QuickRule label="Online və aylıq oyunlar" value="Essential" />
        <QuickRule label="Ən balanslı seçim" value="Extra" />
        <QuickRule label="Klassiklər və full imkanlar" value="Deluxe" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const accent = TIER_ACCENT[tier];
          const active = activeTier === tier;
          const disabled = (tierCounts[tier] ?? 0) === 0;
          const copy = TIER_COPY[tier];

          return (
            <button
              key={tier}
              type="button"
              onClick={() => (!disabled ? onSelect(tier) : undefined)}
              disabled={disabled}
              className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-5 text-left shadow-sm transition dark:bg-zinc-950/60 dark:shadow-none ${
                active
                  ? `border-transparent ring-2 ${accent.ring} ${accent.bg}`
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {active ? (
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${accent.gradient}`}
                />
              ) : null}

              <div className="relative flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    PS Plus
                  </div>
                  <div
                    className={`mt-0.5 text-2xl font-black tracking-tight ${
                      active ? accent.text : "text-zinc-950 dark:text-white"
                    }`}
                  >
                    {tier}
                  </div>
                  <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {copy.eyebrow}
                  </p>
                </div>

                {copy.badge ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${accent.pill}`}
                  >
                    {copy.badge}
                  </span>
                ) : null}
              </div>

              <p className="relative mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {copy.summary}
              </p>

              <div className="relative mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Sənə uyğundur əgər
                </div>

                <ul className="mt-3 space-y-2">
                  {copy.bestFor.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200"
                    >
                      <Check className={`mt-1 h-4 w-4 shrink-0 ${accent.dot}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative mt-5 flex flex-wrap gap-2">
                {copy.highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${accent.pill}`}
                  >
                    {highlight}
                  </span>
                ))}
              </div>

              <div className="relative mt-5 flex items-center justify-between border-t border-zinc-200 pt-3 text-xs dark:border-white/5">
                <span className="text-zinc-500">
                  {disabled
                    ? "Hazırda paket yoxdur"
                    : active
                      ? "Seçildi - aşağıda müddət variantları"
                      : "Bu tier-i seç"}
                </span>

                {active ? (
                  <Sparkles className={`h-3.5 w-3.5 ${accent.dot}`} />
                ) : (
                  <span className="text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-600 dark:group-hover:text-zinc-400">
                    Seç
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function QuickRule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-white/[0.03]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        Tez seçim
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">{label}</div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{value}</div>
    </div>
  );
}

function getPreferredTier(counts: Record<TierKey, number>): TierKey {
  if (counts.EXTRA > 0) return "EXTRA";
  if (counts.ESSENTIAL > 0) return "ESSENTIAL";
  if (counts.DELUXE > 0) return "DELUXE";
  return "EXTRA";
}
