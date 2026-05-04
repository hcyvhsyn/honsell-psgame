"use client";

import { Plus, Trash2 } from "lucide-react";
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-3.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
      >
        <Trash2 className="h-4 w-4" /> Səbətdən sil
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => add(game)}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:bg-[#5B21B6]"
    >
      <Plus className="h-4 w-4" /> Səbətə əlavə et
    </button>
  );
}
