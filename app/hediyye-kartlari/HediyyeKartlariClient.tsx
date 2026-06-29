"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Gift, Plus, Check, TrendingDown } from "lucide-react";
import { useCart } from "@/lib/cart";
import ReferralBadge from "@/components/ReferralBadge";

type Plan = {
  id: string;
  title: string;
  imageUrl?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  _count: { codes: number };
};

function tryAmountOf(c: Plan): number {
  const n = Number((c.metadata as Record<string, unknown> | null)?.tryAmount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function HediyyeKartlariClient({ cards }: { cards: Plan[] }) {
  const { add, has, hydrated } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);

  // Baseline = the worst AZN-per-TRY rate among cards (usually the smallest pack).
  // Savings % on each card is measured against this baseline.
  const baselineAznPerTry = useMemo(() => {
    let max = 0;
    for (const c of cards) {
      const t = tryAmountOf(c);
      if (!t) continue;
      const rate = c.priceAznCents / 100 / t;
      if (rate > max) max = rate;
    }
    return max;
  }, [cards]);

  function addToCart(selected: Plan) {
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? null,
      finalAzn: selected.priceAznCents / 100,
      productType: "TRY_BALANCE",
    });
    setAddedId(selected.id);
    setTimeout(() => setAddedId((cur) => (cur === selected.id ? null : cur)), 1500);
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => {
        const inCart = hydrated && has(c.id);
        const isAdded = addedId === c.id;

        const tryAmt = tryAmountOf(c);
        const azn = c.priceAznCents / 100;
        let savingsPct = 0;
        let savingsAzn = 0;
        if (baselineAznPerTry > 0 && tryAmt > 0) {
          const expected = baselineAznPerTry * tryAmt;
          savingsAzn = expected - azn;
          savingsPct = (savingsAzn / expected) * 100;
        }
        const showSavings = savingsPct >= 1;

        return (
          <li
            key={c.id}
            className="group flex flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-400/55 hover:shadow-xl dark:border-zinc-800 dark:bg-[#0A0A0A] dark:shadow-none dark:hover:border-emerald-500/50 dark:hover:shadow-[0_8px_30px_-10px_rgba(16,185,129,0.15)]"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt={c.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400 dark:from-zinc-900 dark:to-zinc-800 dark:text-zinc-600">
                  <Gift className="h-10 w-10 opacity-30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-80" />
              
              <div className="absolute left-4 top-4 flex gap-1">
                {showSavings && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg shadow-emerald-500/30">
                    <TrendingDown className="h-3 w-3" />
                    {Math.round(savingsPct)}% sərfəli
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="line-clamp-2 text-lg font-bold leading-tight text-zinc-950 dark:text-white">
                {c.title}
              </h3>

              <div className="mt-4 flex items-end gap-3">
                <span className="text-[2rem] font-bold leading-none tracking-tighter text-zinc-950 dark:text-white">
                  {azn.toFixed(2)} AZN
                </span>
              </div>
              <div className="mt-2">
                <ReferralBadge category="giftCards" productName={c.title} />
              </div>
              <div className="mt-2 h-[24px]">
                {showSavings && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {savingsAzn.toFixed(2)} AZN qənaət
                  </span>
                )}
              </div>

              <div className="mt-6 flex-1 flex flex-col justify-end">
                <button
                  type="button"
                  disabled={inCart}
                  onClick={() => addToCart(c)}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                    inCart || isAdded
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-[#0B2A1C] dark:text-emerald-400"
                        : "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white/10 dark:hover:bg-white/20"
                  }`}
                >
                  {inCart || isAdded ? (
                    <>
                      <Check className="h-4 w-4" /> Səbətdə
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Səbətə əlavə et
                    </>
                  )}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
