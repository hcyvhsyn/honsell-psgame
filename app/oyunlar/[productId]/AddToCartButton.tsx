"use client";

import { Gift, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";

type Props = {
  game: {
    id: string;
    title: string;
    imageUrl: string | null;
    finalAzn: number;
    productType: string;
    store?: string;
  };
  /** Məhsul aktiv endirimdədirsə true — hədiyyə üçün endirim xəbərdarlığı göstərilir. */
  discounted?: boolean;
  /** Aktiv endirimin bitmə tarixi (ISO) — hədiyyə sətrində saxlanır. */
  discountEndAt?: string | null;
};

export default function AddToCartButton({ game, discounted = false, discountEndAt = null }: Props) {
  const { add, addGift, remove, has, hasGift, hydrated } = useCart();
  const inCart = hydrated && has(game.id);
  const giftInCart = hydrated && hasGift(game.id);

  return (
    <div className="flex w-full flex-col gap-2.5">
      {/* Səbət + Hədiyyə yan-yana. Müştəri eyni oyunu həm özünə ala, həm
          dostuna hədiyyə edə bilər — iki düymə müstəqildir. */}
      <div className="flex items-stretch gap-2.5">
        {inCart ? (
          <button
            type="button"
            onClick={() => remove(game.id)}
            className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-base font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
          >
            <Trash2 className="h-5 w-5" /> Səbətdən sil
          </button>
        ) : (
          <button
            type="button"
            onClick={() => add(game)}
            className="inline-flex h-14 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-[#6D28D9] px-4 text-base font-bold text-white shadow-[0_18px_42px_-22px_rgba(109,40,217,0.9)] transition hover:bg-[#5B21B6]"
          >
            <ShoppingCart className="h-5 w-5" /> Səbətə əlavə et
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            giftInCart ? remove(game.id, true) : addGift(game, undefined, discountEndAt)
          }
          className={`inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition ${
            giftInCart
              ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-600 hover:bg-fuchsia-500/25 dark:text-fuchsia-300"
              : "border-fuchsia-400/40 bg-transparent text-fuchsia-600 hover:bg-fuchsia-500/10 dark:text-fuchsia-300"
          }`}
        >
          <Gift className="h-5 w-5" />
          {giftInCart ? "Hədiyyədən sil" : "Dostuna hədiyyə et"}
        </button>
      </div>

      {/* Endirimli məhsul hədiyyə edildikdə xəbərdarlıq. */}
      {giftInCart && discounted && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm font-medium leading-snug text-amber-700 dark:text-amber-300">
          ⚠️ Endirimli hədiyyə: dostunuz oyunu endirim müddəti bitənədək aktivləşdirməlidir.
          Gec aktivləşdirsə, yalnız ödədiyiniz {game.finalAzn.toFixed(2)}₼ məbləğ qədər
          hədiyyə dəyəri keçərli olacaq.
        </p>
      )}
    </div>
  );
}
