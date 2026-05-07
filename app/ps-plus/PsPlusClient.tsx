"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Crown, CheckCircle2, Plus, Sparkles } from "lucide-react";
import { useCart } from "@/lib/cart";

type Plan = {
  id: string;
  title: string;
  imageUrl?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
};

type TierKey = "ESSENTIAL" | "EXTRA" | "DELUXE";

const TIERS: TierKey[] = ["ESSENTIAL", "EXTRA", "DELUXE"];

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
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-1 backdrop-blur">
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_0%,rgba(99,102,241,0.35),transparent_45%),radial-gradient(circle_at_80%_120%,rgba(16,185,129,0.25),transparent_50%)]" />
            <div className="relative grid grid-cols-3 gap-2 p-1">
              {TIERS.map((t) => {
                const active = tier === t;
                const disabled = (tierCounts[t] ?? 0) === 0;
                const accent =
                  t === "ESSENTIAL"
                    ? "from-sky-400/25 to-indigo-500/10 text-sky-100"
                    : t === "EXTRA"
                      ? "from-emerald-400/25 to-emerald-500/10 text-emerald-100"
                      : "from-amber-400/25 to-amber-500/10 text-amber-100";
                return (
                  <button
                    key={t}
                    onClick={() => (!disabled ? setTier(t) : undefined)}
                    disabled={disabled}
                    className={`relative overflow-hidden rounded-2xl px-4 py-3 text-left transition ${
                      active
                        ? `bg-gradient-to-b ${accent} shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/20`
                        : disabled
                          ? "bg-black/10 text-zinc-500 ring-1 ring-white/5 opacity-60 cursor-not-allowed"
                          : "bg-black/20 text-zinc-300 hover:bg-black/30 ring-1 ring-white/5"
                    }`}
                  >
                    {active && (
                      <span className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                    )}
                    <div className="relative flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                          PS Plus
                        </div>
                        <div className="mt-0.5 text-lg font-black tracking-tight">{t}</div>
                      </div>
                      {active ? <Sparkles className="h-4 w-4 text-white/80" /> : <Crown className="h-4 w-4 text-white/30" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
                ? "bg-sky-500/20 text-sky-300"
                : isExtra
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-300";

              // When added: dark green as in screenshot.
              const btnSuccess = "bg-[#0B2A1C] text-emerald-400 border border-emerald-500/20";

              return (
                <article
                  key={selected.id}
                  className={`group relative flex flex-col overflow-hidden rounded-[24px] border border-zinc-800 bg-[#0A0A0A] transition-all duration-300 ${cardHover}`}
                >
                  {/* Subtle top glow line */}
                  <div className={`absolute inset-x-0 top-0 h-[2px] w-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${topGlow}`} />

                  <div className="relative aspect-[4/3] w-full bg-zinc-900 overflow-hidden">
                    {selected.imageUrl ? (
                      <Image
                        src={selected.imageUrl}
                        alt={selected.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800 text-zinc-500">
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
                    <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white">
                      {selected.title}
                    </h3>
                    
                    <div className="mt-4 flex items-end gap-3">
                      <p className="text-[2rem] font-bold tracking-tighter text-white leading-none">
                        {(selected.priceAznCents / 100).toFixed(2)} AZN
                      </p>
                    </div>

                    {hasDiscount ? (
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-base font-medium text-zinc-500 line-through decoration-zinc-600 decoration-1">
                          {(originalPriceCents / 100).toFixed(2)} AZN
                        </p>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${discountTagBg}`}>
                          -{discountPercent}%
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 h-[24px]" /> // Spacer to keep height consistent if no discount
                    )}

                    <div className="mt-6 flex-1 flex flex-col justify-end">
                      <button
                        onClick={() => addToCart(selected)}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                          inCart || addedId === selected.id
                            ? btnSuccess
                            : "bg-white/10 text-white hover:bg-white/20"
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
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center text-sm text-zinc-500">
          Bu tier üçün aktiv paket yoxdur.
        </div>
      )}
    </div>
  );
}
