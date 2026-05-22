"use client";

import { ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";

type Props = {
  game: {
    id: string;
    title: string;
    imageUrl: string | null;
    finalAzn: number;
    productType: string;
  };
};

export default function AddToCartButton({ game }: Props) {
  const { add, remove, has, hydrated } = useCart();
  const inCart = hydrated && has(game.id);

  if (inCart) {
    return (
      <button
        type="button"
        onClick={() => remove(game.id)}
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 text-base font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
      >
        <Trash2 className="h-5 w-5" /> Səbətdən sil
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => add(game)}
      className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#6D28D9] px-5 text-base font-bold text-white shadow-[0_18px_42px_-22px_rgba(109,40,217,0.9)] transition hover:bg-[#5B21B6]"
    >
      <ShoppingCart className="h-5 w-5" /> Səbətə əlavə et
    </button>
  );
}
