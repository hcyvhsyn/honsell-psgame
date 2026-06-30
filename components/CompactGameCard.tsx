"use client";

import Image from "next/image";
import { cdnImageUrl } from "@/lib/cdnImage";
import Link from "next/link";
import { Gamepad2, Plus, Check } from "lucide-react";
import { useCart } from "@/lib/cart";
import type { GameCardData } from "./GameCard";

/**
 * Slim recommendation card used in the cart "Bunları da bəyənə bilərsən"
 * strip. The catalog `GameCard` packs a heart button, platform pills,
 * product-type badge, countdown timer, and oversized title into one tile —
 * great for browsing, but in a 4-up grid at the bottom of the cart it all
 * overlaps. This variant strips those down to just cover + discount + title
 * + price + add button. Same data shape as `GameCardData` so call sites can
 * swap without remapping.
 */
export default function CompactGameCard({ game }: { game: GameCardData }) {
  const { add, has, hydrated } = useCart();
  const inCart = hydrated && has(game.id);

  const detailHref = game.productId ? `/oyunlar/${game.productId}` : null;

  const cover = (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-900">
      {game.imageUrl ? (
        <Image
          src={cdnImageUrl(game.imageUrl)}
          alt={game.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          // CDN keşli — self-hosted Next optimizer növbəsini bypass et.
          unoptimized
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-600">
          <Gamepad2 className="h-8 w-8 opacity-40" />
        </div>
      )}
      {game.discountPct != null && (
        // Smaller, less-intrusive discount tag — top-right of the cover only,
        // no oversized circle that would dominate this narrow card.
        <span className="absolute right-2 top-2 rounded-md bg-violet-600/95 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-lg">
          -{game.discountPct}%
        </span>
      )}
    </div>
  );

  return (
    <li className="group flex flex-col gap-2 rounded-xl border border-white/5 bg-zinc-950/40 p-2 transition hover:border-violet-500/30 hover:bg-zinc-900/60">
      {detailHref ? (
        <Link href={detailHref} aria-label={game.title}>
          {cover}
        </Link>
      ) : (
        cover
      )}

      <div className="flex flex-col gap-1.5 px-1">
        {detailHref ? (
          <Link
            href={detailHref}
            className="line-clamp-2 min-h-[2.4em] text-xs font-medium leading-tight text-zinc-200 transition hover:text-violet-300"
          >
            {game.title}
          </Link>
        ) : (
          <h3 className="line-clamp-2 min-h-[2.4em] text-xs font-medium leading-tight text-zinc-200">
            {game.title}
          </h3>
        )}

        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold tabular-nums text-white">
            {game.finalAzn.toFixed(2)}₼
          </span>
          {game.originalAzn != null && (
            <span className="text-[11px] text-zinc-500 line-through tabular-nums">
              {game.originalAzn.toFixed(2)}₼
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            !inCart &&
            add({
              id: game.id,
              title: game.title,
              imageUrl: game.imageUrl,
              finalAzn: game.finalAzn,
              productType: game.productType,
              store: game.store === "EPIC" || game.platform === "PC" ? "EPIC" : "PS",
            })
          }
          disabled={inCart}
          className={`mt-1 inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg text-xs font-semibold transition ${
            inCart
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
        >
          {inCart ? (
            <>
              <Check className="h-3.5 w-3.5" /> Səbətdə
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> Səbətə
            </>
          )}
        </button>
      </div>
    </li>
  );
}
