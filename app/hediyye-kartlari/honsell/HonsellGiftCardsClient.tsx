"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Gift, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import ReferralBadge from "@/components/ReferralBadge";

type Card = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
  denominationAzn: number;
};

export default function HonsellGiftCardsClient({ cards }: { cards: Card[] }) {
  const { add, has, hydrated } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);

  function addToCart(card: Card) {
    add({
      id: card.id,
      title: card.title,
      imageUrl: card.imageUrl ?? null,
      finalAzn: card.priceAznCents / 100,
      productType: "HONSELL_GIFT_CARD",
    });
    setAddedId(card.id);
    setTimeout(() => setAddedId((cur) => (cur === card.id ? null : cur)), 1500);
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((c) => {
        const inCart = hydrated && has(c.id);
        const isAdded = addedId === c.id;

        return (
          <li
            key={c.id}
            className="group relative overflow-hidden rounded-[20px] border border-violet-300/15 bg-gradient-to-br from-violet-900/40 via-zinc-900 to-zinc-950 transition hover:-translate-y-1 hover:border-violet-400/40 hover:shadow-[0_18px_50px_-24px_rgba(168,85,247,0.5)]"
          >
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-violet-500/15 blur-2xl transition group-hover:bg-violet-500/25" />

            {c.imageUrl ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900">
                <Image
                  src={c.imageUrl}
                  alt={c.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 to-transparent" />
                <div className="absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
                  Honsell
                </div>
              </div>
            ) : (
              <div className="relative flex items-center justify-between px-5 pt-5">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30">
                  <Gift className="h-4 w-4" />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/70">
                  Honsell
                </div>
              </div>
            )}

            <div className={`relative ${c.imageUrl ? "px-5 pt-3" : "mt-5 px-5"}`}>
              <div className="text-[2.4rem] font-black leading-none tracking-tighter text-white">
                {c.denominationAzn}
              </div>
              <div className="mt-1 text-xs font-semibold text-violet-300/80">AZN nominal</div>
            </div>

            <div className="relative mt-4 px-5 text-[11px] text-zinc-400">
              Alış üçün ödəniş: {(c.priceAznCents / 100).toFixed(2)} AZN
            </div>
            <div className="relative mt-2 px-5">
              <ReferralBadge category="giftCards" productName={c.title} />
            </div>

            <div className="relative mt-5 px-5 pb-5">
              <button
                type="button"
                disabled={inCart}
                onClick={() => addToCart(c)}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  inCart || isAdded
                    ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {inCart || isAdded ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Səbətdə
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Səbətə əlavə et
                  </>
                )}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
