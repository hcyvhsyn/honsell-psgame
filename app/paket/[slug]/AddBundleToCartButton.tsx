"use client";

import { ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { buildBundleCartPayload, type BundleCardData } from "@/lib/gameBundleShared";

/**
 * Paketi səbətə ATOMİK tək sətir kimi atır. Hədiyyə düyməsi qəsdən yoxdur —
 * paketdəki hər oyun ayrıca hədiyyə kodu tələb edərdi, checkout isə paketi
 * hədiyyə sətri kimi qəbul etmir.
 */
export default function AddBundleToCartButton({ bundle }: { bundle: BundleCardData }) {
  const { add, remove, has, hydrated } = useCart();
  const inCart = hydrated && has(bundle.id);

  return (
    <button
      type="button"
      onClick={() => (inCart ? remove(bundle.id) : add(buildBundleCartPayload(bundle)))}
      className={`mt-4 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl px-4 text-base font-bold transition ${
        inCart
          ? "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
          : "bg-emerald-600 text-white shadow-[0_18px_42px_-22px_rgba(5,150,105,0.9)] hover:bg-emerald-500"
      }`}
    >
      {inCart ? (
        <>
          <Trash2 className="h-5 w-5" /> Səbətdən sil
        </>
      ) : (
        <>
          <ShoppingCart className="h-5 w-5" /> Səbətə əlavə et
        </>
      )}
    </button>
  );
}
