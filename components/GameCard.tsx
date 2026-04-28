"use client";

import Image from "next/image";
import { Gamepad2, Plus, Check } from "lucide-react";
import { useCart } from "@/lib/cart";

export type GameCardData = {
  id: string;
  title: string;
  imageUrl: string | null;
  /** "PS5", "PS4", or "PS5,PS4" for cross-gen titles. NULL for concepts. */
  platform: string | null;
  productType: string;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
};

export default function GameCard({ game }: { game: GameCardData }) {
  const { add, has, hydrated } = useCart();
  const inCart = hydrated && has(game.id);

  const platforms = game.platform ? game.platform.split(",") : [];

  return (
    <li className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-500/5">
      <div className="relative aspect-square w-full bg-zinc-900">
        {game.imageUrl ? (
          <Image
            src={game.imageUrl}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <Gamepad2 className="h-10 w-10" />
          </div>
        )}

        {game.discountPct != null && (
          <span className="absolute left-3 top-3 rounded-lg bg-emerald-500 px-3 py-1.5 text-base font-bold text-white shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-400/40">
            -{game.discountPct}%
          </span>
        )}

        {platforms.length > 0 && (
          <div className="absolute right-3 top-3 flex gap-1">
            {platforms.map((p) => (
              <span
                key={p}
                className="rounded-md bg-zinc-950/85 px-2 py-1 text-[11px] font-bold tracking-wide text-zinc-100 ring-1 ring-zinc-700/60 backdrop-blur"
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug">
          {game.title}
        </h3>

        <div>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-xl font-bold text-white">
              {game.finalAzn.toFixed(2)} AZN
            </span>
            {game.originalAzn != null && (
              <span className="text-lg font-medium text-zinc-400 line-through decoration-zinc-500/70">
                {game.originalAzn.toFixed(2)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={inCart}
            onClick={() =>
              add({
                id: game.id,
                title: game.title,
                imageUrl: game.imageUrl,
                finalAzn: game.finalAzn,
                productType: game.productType,
              })
            }
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
              inCart
                ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "bg-indigo-500 text-white hover:bg-indigo-400"
            }`}
          >
            {inCart ? (
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
}
