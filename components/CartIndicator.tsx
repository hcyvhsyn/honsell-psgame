"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

export default function CartIndicator() {
  const { count, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 transition hover:border-indigo-500/60 hover:text-white"
    >
      <ShoppingCart className="h-4 w-4" />
      <span className="hidden sm:inline">Səbət</span>
      {hydrated && count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
