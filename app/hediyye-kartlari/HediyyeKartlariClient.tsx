"use client";

import { useState } from "react";
import Image from "next/image";
import { Gift, Plus, Check } from "lucide-react";
import { useCart } from "@/lib/cart";

type Plan = {
  id: string;
  title: string;
  imageUrl?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  _count: { codes: number };
};

export default function HediyyeKartlariClient({ cards }: { cards: Plan[] }) {
  const { add, has, hydrated } = useCart();
  const [addedId, setAddedId] = useState<string | null>(null);

  function addToCart(selected: Plan) {
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? null,
      finalAzn: selected.priceAznCents / 100,
      productType: "TRY_BALANCE",
    });
    setAddedId(selected.id);
    setTimeout(() => setAddedId((cur) => (cur === selected.id ? null : cur)), 1500);
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => {
        const inCart = hydrated && has(c.id);
        const isAdded = addedId === c.id;

        return (
          <li
            key={c.id}
            className="group flex flex-col overflow-hidden rounded-[24px] border border-zinc-800 bg-[#0A0A0A] transition hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-[0_8px_30px_-10px_rgba(16,185,129,0.15)]"
          >
            <div className="relative aspect-[4/3] w-full bg-zinc-900 overflow-hidden">
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt={c.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600 bg-gradient-to-br from-zinc-900 to-zinc-800">
                  <Gift className="h-10 w-10 opacity-30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-80" />
              
              <div className="absolute left-4 top-4 flex gap-1">
             
              </div>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white">
                {c.title}
              </h3>

              <div className="mt-4 flex items-end gap-3">
                <span className="text-[2rem] font-bold tracking-tighter text-white leading-none">
                  {(c.priceAznCents / 100).toFixed(2)} AZN
                </span>
              </div>
              <div className="mt-2 h-[24px]" /> {/* Spacer for height consistency with PS Plus */}

              <div className="mt-6 flex-1 flex flex-col justify-end">
                <button
                  type="button"
                  disabled={inCart}
                  onClick={() => addToCart(c)}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                    inCart || isAdded
                        ? "bg-[#0B2A1C] text-emerald-400 border border-emerald-500/20"
                        : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {inCart || isAdded ? (
                    <>
                      <Check className="h-4 w-4" /> Səbətdə
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Səbətə əlavə et
                    </>
                  )}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
