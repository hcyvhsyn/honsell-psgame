"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useModals } from "@/lib/modals";

export default function CartIndicator() {
  const { count, hydrated } = useCart();
  const { open } = useModals();

  return (
    <button
      type="button"
      onClick={() => open("cart")}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-transparent text-zinc-300 transition hover:bg-white/5 hover:text-white"
    >
      <ShoppingBag className="h-4 w-4" />
      {hydrated && count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5a189a] px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
