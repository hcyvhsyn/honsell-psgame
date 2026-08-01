"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ProductImage from "./ProductImage";
import { formatAzn, PRIZE_TIER_LABELS, prizeTierFor, type PrizeTier } from "@/lib/lootBoxShared";

/**
 * Qutu açılışı reveal animasiyası — üfüqi "rulet lenti".
 *
 * Bu repoda animasiya kitabxanası (framer-motion) yoxdur, ona görə lent
 * `styled-jsx` + CSS `transform` ilə sürüşdürülür. Lentin son kartı qazanılan
 * hədiyyədir; qalan kartlar yalnız vizual doldurucudur (ehtimalları əks
 * etdirmir — nəticə serverdə artıq müəyyən olunub).
 */

export type RevealPrize = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  valueAznCents: number;
};

const TIER_STYLES: Record<PrizeTier, { ring: string; glow: string; chip: string }> = {
  COMMON: {
    ring: "ring-slate-300 dark:ring-slate-600",
    glow: "shadow-slate-400/30",
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  },
  STANDARD: {
    ring: "ring-sky-400",
    glow: "shadow-sky-400/40",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  RARE: {
    ring: "ring-violet-400",
    glow: "shadow-violet-500/50",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  LEGENDARY: {
    ring: "ring-amber-400",
    glow: "shadow-amber-400/60",
    chip: "bg-gradient-to-r from-amber-500 to-fuchsia-600 text-white",
  },
};

const CARD_WIDTH = 132; // px — lentdəki hər kartın eni + boşluq
const STRIP_LENGTH = 34; // qazanan kart bu indeksdə dayanır
const SPIN_MS = 3600;

export default function LootBoxReveal({
  prize,
  fillers,
  priceAznCents,
  onDone,
}: {
  prize: RevealPrize;
  /** Lenti doldurmaq üçün nümunə hədiyyələr (vizual). */
  fillers: RevealPrize[];
  priceAznCents: number;
  onDone: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Lent: son kart qazanan hədiyyədir, qalanları doldurucu.
  const strip = useMemo(() => {
    const pool = fillers.length > 0 ? fillers : [prize];
    const items: RevealPrize[] = [];
    for (let i = 0; i < STRIP_LENGTH; i++) {
      items.push(pool[i % pool.length]);
    }
    items[STRIP_LENGTH - 1] = prize;
    return items;
  }, [fillers, prize]);

  useEffect(() => {
    // İki kadr gözləyirik ki, başlanğıc transform tətbiq olunsun və keçid işləsin.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setOffset((STRIP_LENGTH - 1) * CARD_WIDTH))
    );
    const timer = setTimeout(() => {
      setSettled(true);
      doneRef.current();
    }, SPIN_MS + 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  const tier = prizeTierFor(prize.valueAznCents, priceAznCents);
  const styles = TIER_STYLES[tier];

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 py-6">
        {/* Mərkəz göstəricisi */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-400 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-950 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-950 to-transparent" />

        <div className="loot-strip-window">
          <div className="loot-strip" style={{ transform: `translateX(-${offset}px)` }}>
            {strip.map((item, i) => {
              const isWinner = i === STRIP_LENGTH - 1;
              return (
                <div
                  key={i}
                  className={`loot-card ${
                    isWinner && settled ? `ring-4 ${styles.ring} shadow-2xl ${styles.glow}` : "ring-1 ring-white/10"
                  }`}
                >
                  <div className="h-20 w-full overflow-hidden rounded-lg">
                    <ProductImage src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-white/80">{item.title}</div>
                  <div className="text-xs font-black text-amber-300">{formatAzn(item.valueAznCents)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {settled && (
        <div className="loot-result mt-4 text-center">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${styles.chip}`}>
            {PRIZE_TIER_LABELS[tier]}
          </span>
          <div className="mt-2 text-lg font-black text-slate-900 dark:text-white">{prize.title}</div>
          <div className="text-2xl font-black text-amber-500">{formatAzn(prize.valueAznCents)}</div>
        </div>
      )}

      <style jsx>{`
        .loot-strip-window {
          overflow: hidden;
          /* Qazanan kart mərkəzdə dayansın deyə lenti yarım ekran sağa sürüşdürürük. */
          padding-left: calc(50% - ${CARD_WIDTH / 2}px);
        }
        .loot-strip {
          display: flex;
          gap: 12px;
          will-change: transform;
          transition: transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.12, 1);
        }
        .loot-card {
          flex: 0 0 ${CARD_WIDTH - 12}px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
          padding: 8px;
          transition: box-shadow 240ms ease;
        }
        .loot-result {
          animation: loot-pop 420ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
        }
        @keyframes loot-pop {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .loot-strip {
            transition-duration: 400ms;
          }
          .loot-result {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
