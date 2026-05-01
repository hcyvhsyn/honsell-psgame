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
    <li className="group flex flex-col overflow-hidden rounded-[24px] border border-zinc-800 bg-[#0A0A0A] transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-[0_8px_30px_-10px_rgba(99,102,241,0.15)]">
      <div className="relative aspect-[4/3] w-full bg-zinc-900 overflow-hidden">
        {game.imageUrl ? (
          <Image
            src={game.imageUrl}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600 bg-gradient-to-br from-zinc-900 to-zinc-800">
            <Gamepad2 className="h-10 w-10 opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-80" />

        {game.discountPct != null && (
          <span className="absolute left-4 top-4 rounded-full bg-indigo-500/20 px-3 py-1.5 text-[12px] font-bold text-indigo-300 backdrop-blur-md">
            -{game.discountPct}%
          </span>
        )}

        {platforms.length > 0 && (
          <div className="absolute right-4 top-4 flex gap-1">
            {platforms.map((p) => (
              <span
                key={p}
                className="rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-zinc-200 backdrop-blur-md"
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-lg font-bold leading-tight text-white">
          {game.title}
        </h3>

        <div className="mt-4 flex items-end gap-3">
          <span className="text-[2rem] font-bold tracking-tighter text-white leading-none">
            {game.finalAzn.toFixed(2)} AZN
          </span>
        </div>
        
        {game.originalAzn != null ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-base font-medium text-zinc-500 line-through decoration-zinc-600 decoration-1">
              {game.originalAzn.toFixed(2)} AZN
            </span>
          </div>
        ) : (
          <div className="mt-2 h-[24px]" />
        )}

        <div className="mt-6 flex-1 flex flex-col justify-end">
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
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
              inCart
                ? "bg-[#0B2A1C] text-emerald-400 border border-emerald-500/20"
                : "bg-[#6D28D9] text-white hover:bg-[#5B21B6] shadow-lg shadow-purple-500/20"
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
