"use client";

import { useState } from "react";
import Image from "next/image";
import { Gamepad2, CheckCircle2, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";

type Plan = {
  id: string;
  title: string;
  imageUrl?: string | null;
  description?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
};

export default function EaPlayClient({ plans }: { plans: Plan[] }) {
  const [addedId, setAddedId] = useState<string | null>(null);
  const { add, has } = useCart();

  function addToCart(selected: Plan) {
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? null,
      finalAzn: selected.priceAznCents / 100,
      productType: "EA_PLAY",
    });
    setAddedId(selected.id);
    setTimeout(() => setAddedId((cur) => (cur === selected.id ? null : cur)), 1500);
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center text-sm text-zinc-500">
        Hələ aktiv EA Play paketi yoxdur.
      </div>
    );
  }

  const sorted = plans
    .slice()
    .sort(
      (a, b) =>
        Number((a.metadata ?? {}).durationMonths ?? 0) -
        Number((b.metadata ?? {}).durationMonths ?? 0)
    );

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {sorted.map((selected) => {
        const inCart = has(selected.id);
        const durationMonths = Number(
          (selected.metadata as Record<string, unknown> | null)?.durationMonths ?? 0
        );

        return (
          <article
            key={selected.id}
            className="group relative flex flex-col overflow-hidden rounded-[24px] border border-zinc-800 bg-[#0A0A0A] transition-all duration-300 hover:border-orange-500/50 hover:shadow-[0_8px_30px_-10px_rgba(249,115,22,0.18)]"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative aspect-[4/3] w-full bg-zinc-900 overflow-hidden">
              {selected.imageUrl ? (
                <Image
                  src={selected.imageUrl}
                  alt={selected.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800 text-zinc-500">
                  <Gamepad2 className="h-10 w-10 opacity-30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-80" />

              <div className="absolute left-4 top-4 flex items-center gap-2">
                <div className="rounded-full bg-black/50 px-3 py-1.5 text-[12px] font-semibold tracking-wide text-zinc-200 backdrop-blur-md">
                  EA Play • {durationMonths} ay
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white">
                {selected.title}
              </h3>

              {selected.description ? (
                <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{selected.description}</p>
              ) : null}

              <div className="mt-4 flex items-end gap-3">
                <p className="text-[2rem] font-bold tracking-tighter text-white leading-none">
                  {(selected.priceAznCents / 100).toFixed(2)} AZN
                </p>
              </div>

              <div className="mt-6 flex-1 flex flex-col justify-end">
                <button
                  onClick={() => addToCart(selected)}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                    inCart || addedId === selected.id
                      ? "bg-[#0B2A1C] text-emerald-400 border border-emerald-500/20"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {inCart || addedId === selected.id ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Səbətə əlavə edildi
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Səbətə əlavə et
                    </>
                  )}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
