"use client";

import { Sparkles } from "lucide-react";

/**
 * Sifariş xülasəsi — mövcud dark dizaynda breakdown: məhsulların cəmi, kupon
 * endirimi (varsa), yekun məbləğ. Ödəniş düymələri mövcud <aside>-da qalır.
 */
export default function CartSummary({
  itemCount,
  subtotalAzn,
  discountAzn,
  bonusHint,
}: {
  itemCount: number;
  subtotalAzn: number;
  discountAzn: number;
  /** Növbəti bonus haqqında qısa təşviq mətni (varsa). */
  bonusHint?: string | null;
}) {
  const finalAzn = Math.max(0, subtotalAzn - discountAzn);

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Yekun
          </p>
          <div className="mt-1 flex items-end gap-1.5">
            <span className="text-3xl font-bold tabular-nums text-white">
              {finalAzn.toFixed(2)}
            </span>
            <span className="pb-1 text-sm font-medium text-zinc-400">AZN</span>
          </div>
        </div>

        <span className="rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs font-medium text-zinc-300">
          {itemCount} məhsul
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-2.5">
          <p className="text-zinc-500">Məhsullar</p>
          <p className="mt-1 font-semibold tabular-nums text-zinc-100">
            {subtotalAzn.toFixed(2)} AZN
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-2.5">
          <p className="text-zinc-500">Endirim</p>
          <p
            className={`mt-1 font-semibold tabular-nums ${
              discountAzn > 0 ? "text-emerald-300" : "text-zinc-100"
            }`}
          >
            {discountAzn > 0 ? `−${discountAzn.toFixed(2)} AZN` : "Yoxdur"}
          </p>
        </div>
      </div>

      {bonusHint && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-3 py-2 text-xs text-fuchsia-100/90">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
          <span className="leading-snug">{bonusHint}</span>
        </div>
      )}
    </div>
  );
}
