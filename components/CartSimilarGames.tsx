"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import CompactGameCard from "./CompactGameCard";
import type { GameCardData } from "./GameCard";

/**
 * "Bunları da bəyənə bilərsən" recommendation strip rendered at the bottom of
 * the cart. When the cart contains games or DLCs, recommendations are
 * semantically similar to those rows (via precomputed embeddings). When the
 * cart only contains services, or embeddings aren't backfilled yet, falls
 * back to popular discounted games so the slot stays useful.
 */
export default function CartSimilarGames({
  cartGameIds,
}: {
  cartGameIds: string[];
}) {
  const [results, setResults] = useState<GameCardData[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Tracks whether the displayed cards came from semantic matching or from
  // the popular-games fallback — drives the subtitle copy below.
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let alive = true;
    const ids = cartGameIds.slice(0, 10).join(",");
    // Always hit the endpoint — the server decides between semantic and
    // fallback based on whether `ids` is empty or no embeddings match.
    fetch(`/api/cart/similar?ids=${encodeURIComponent(ids)}&limit=4`)
      .then((r) => r.json())
      .then((j: { results: GameCardData[]; fallback?: boolean }) => {
        if (!alive) return;
        setResults(j.results ?? []);
        setUsedFallback(Boolean(j.fallback));
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [cartGameIds.join(",")]);

  if (!loaded || results.length === 0) return null;

  return (
    <section className="mt-10 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-zinc-900/30 to-zinc-900/60 p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500/20 ring-1 ring-violet-400/40">
          <Sparkles className="h-4 w-4 text-violet-200" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white sm:text-lg">
            Bunları da bəyənə bilərsən
          </h2>
          <p className="text-xs text-zinc-400">
            {usedFallback
              ? "Endirimdə olan ən populyar oyunlar"
              : "Səbətindəki oyunlara bənzər AI seçimi"}
          </p>
        </div>
      </div>

      {/* 2 cols on mobile, 4 on desktop. The compact card variant keeps each
          tile readable at this width — the full GameCard's heart/PS-pill/
          countdown stack overlapped when squeezed into 6 columns. */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {results.map((g) => (
          <CompactGameCard key={g.id} game={g} />
        ))}
      </ul>
    </section>
  );
}
