"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useModals } from "@/lib/modals";
import { MIN_ORDER_AZN, minOrderProgress } from "@/lib/cartLimits";

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

export default function CartIndicator() {
  const { count, hydrated, totalAzn } = useCart();
  const { open } = useModals();

  const showRing = hydrated && count > 0;
  const progress = minOrderProgress(totalAzn);

  return (
    <button
      type="button"
      onClick={() => open("cart")}
      title={
        showRing && !progress.reached
          ? `Minimum sifariş: ${totalAzn.toFixed(2)} / ${MIN_ORDER_AZN} ₼`
          : undefined
      }
      className="group honsell-nav-action relative inline-flex h-10 items-center justify-center gap-2 rounded-[18px] border border-zinc-200 bg-white/70 px-3 text-sm font-semibold text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:border-violet-400/35 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:bg-white/[0.075]"
    >
      <span className="relative grid h-8 w-8 place-items-center">
        {/* Minimum sifariş halqası — səbət doldugca bağlanır, minimumda yaşıla dönür. */}
        {showRing ? (
          <svg
            aria-hidden
            viewBox="0 0 36 36"
            className="pointer-events-none absolute inset-0 h-8 w-8 -rotate-90"
          >
            <circle
              cx="18"
              cy="18"
              r={RING_R}
              fill="none"
              strokeWidth="2.5"
              className="stroke-zinc-200 dark:stroke-white/10"
            />
            <circle
              cx="18"
              cy="18"
              r={RING_R}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - progress.ratio)}
              className={`transition-[stroke-dashoffset] duration-700 ease-out ${
                progress.reached ? "stroke-emerald-500" : "stroke-violet-500"
              }`}
            />
          </svg>
        ) : null}
        <ShoppingCart className="honsell-nav-icon-motion honsell-nav-cart-icon h-[18px] w-[18px] text-violet-600 dark:text-violet-200" />
      </span>
      <span className="hidden sm:inline">Səbət</span>
      {hydrated && count > 0 && (
        <span className="honsell-nav-active-glow absolute -top-2 right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-b from-violet-500 to-purple-700 px-1.5 text-[11px] font-black text-white shadow-[0_10px_24px_-10px_rgba(124,58,237,0.95)]">
          {count}
        </span>
      )}
    </button>
  );
}
