"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useModals } from "@/lib/modals";

export default function CartIndicator() {
  const { count, hydrated } = useCart();
  const { open } = useModals();

  return (
    <button
      type="button"
      onClick={() => open("cart")}
      className="relative inline-flex h-10 items-center justify-center gap-2 rounded-[18px] border border-zinc-200 bg-white/70 px-3 text-sm font-semibold text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:border-violet-400/35 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:bg-white/[0.075]"
    >
      <ShoppingCart className="h-5 w-5" />
      <span className="hidden sm:inline">Səbət</span>
      {hydrated && count > 0 && (
        <span className="absolute -top-2 right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-b from-violet-500 to-purple-700 px-1.5 text-[11px] font-black text-white shadow-[0_10px_24px_-10px_rgba(124,58,237,0.95)]">
          {count}
        </span>
      )}
    </button>
  );
}
