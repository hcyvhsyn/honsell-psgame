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
    <div>
      <h2 className="mb-4 text-lg font-semibold tracking-tight">Xülasə</h2>

      <div className="space-y-2 border-b border-zinc-800/60 pb-4 text-sm">
        <div className="flex items-center justify-between text-zinc-400">
          <span>{itemCount} məhsul</span>
          <span className="tabular-nums text-zinc-200">{subtotalAzn.toFixed(2)} AZN</span>
        </div>

        {discountAzn > 0 && (
          <div className="flex items-center justify-between text-emerald-300">
            <span>Endirim (kupon)</span>
            <span className="tabular-nums font-semibold">−{discountAzn.toFixed(2)} AZN</span>
          </div>
        )}

        <div className="flex items-end justify-between pt-2">
          <span className="text-sm font-medium text-zinc-300">Yekun</span>
          <span className="text-2xl font-bold tabular-nums text-white">
            {finalAzn.toFixed(2)} <span className="text-sm font-medium text-zinc-400">AZN</span>
          </span>
        </div>
      </div>

      {bonusHint && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-fuchsia-200/90">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
          <span className="leading-snug">{bonusHint}</span>
        </p>
      )}
    </div>
  );
}
