"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";
import { useModals } from "@/lib/modals";
import MinOrderMeter from "./MinOrderMeter";

const VISIBLE_MS = 4500;

function lineKey(i: CartItem): string {
  return `${i.id}:${i.gift ? "g" : "n"}`;
}

/**
 * Məhsul səbətə düşəndə qısa toast — "Səbətə əlavə olundu" + minimum sifariş
 * sayğacı ("2.30 / 20 ₼"). Add-yolları çoxdur (kart, detal, reels, banner,
 * axtarış, AI paneli), ona görə hər birinə ayrıca çağırış əvəzinə səbət
 * vəziyyətini izləyir: YENİ sətir və ya ARTAN say = əlavə.
 *
 * Qiymət refresh-i (`/api/cart/refresh`) və replace-budaqlı add (qty dəyişmir)
 * toast açmır — yalnız say/sətir artımı sayılır. localStorage hidrasiyası da
 * əlavə sayılmır.
 */
export default function CartAddedToast() {
  const { items, hydrated, totalAzn } = useCart();
  const { active, open } = useModals();
  const pathname = usePathname();

  const prevRef = useRef<Map<string, number> | null>(null);
  const prevTotalRef = useRef(0);
  const [added, setAdded] = useState<CartItem | null>(null);
  const [fromAzn, setFromAzn] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    const next = new Map(items.map((i) => [lineKey(i), i.qty]));
    const prev = prevRef.current;
    const prevTotal = prevTotalRef.current;
    prevRef.current = next;
    prevTotalRef.current = totalAzn;
    if (!prev) return; // ilk hidrasiya

    const grown = items.find((i) => (prev.get(lineKey(i)) ?? 0) < i.qty);
    if (grown) {
      setAdded(grown);
      setFromAzn(prevTotal);
      setNonce((n) => n + 1);
    }
  }, [items, hydrated, totalAzn]);

  // Avtomatik bağlanma — hər yeni əlavə taymeri sıfırlayır.
  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(null), VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [added, nonce]);

  // Səbət özü açıqdırsa toast lazımsızdır.
  const cartVisible = active === "cart" || pathname === "/cart";
  useEffect(() => {
    if (cartVisible) setAdded(null);
  }, [cartVisible]);

  if (!added || cartVisible) return null;

  return (
    <div
      key={nonce}
      role="status"
      className="honsell-cart-toast fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[130] mx-auto max-w-sm rounded-[22px] border border-zinc-200 bg-white/95 p-3.5 shadow-2xl shadow-violet-900/15 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95 dark:shadow-black/50 xl:inset-x-auto xl:bottom-auto xl:right-6 xl:top-24 xl:w-[360px]"
    >
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/5">
          {added.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={added.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
            Səbətə əlavə olundu
          </p>
          <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
            {added.title}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdded(null)}
          aria-label="Bağla"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <MinOrderMeter totalAzn={totalAzn} fromAzn={fromAzn} variant="compact" />
      </div>

      <button
        type="button"
        onClick={() => {
          setAdded(null);
          open("cart");
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Səbətə bax <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
