"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Package } from "lucide-react";

import ProductImage from "./ProductImage";
import { formatAzn, type PublicOddsRow } from "@/lib/lootBoxShared";

export type LootBoxCardData = {
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  minPrizeCents: number;
  maxPrizeCents: number;
  sellBackPct: number;
  odds: PublicOddsRow[];
  /** Rulet lentini dolduran real oyun nümunələri (hovuzdan). */
  showcase?: ShowcasePrizeData[];
};

export type ShowcasePrizeData = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  valueAznCents: number;
};

/** Qutu kartı — ana səhifə bölməsi və /qutular siyahısı paylaşır. */
export default function LootBoxCard({
  box,
  index = 0,
  isVisible = true,
  isOpening = false,
  onOpen,
}: {
  box: LootBoxCardData;
  index?: number;
  isVisible?: boolean;
  isOpening?: boolean;
  onOpen?: () => void;
}) {
  const topOdds = box.odds[0];
  const cardStyle = { "--loot-delay": `${index * 85}ms` } as CSSProperties;
  const shellClass = `loot-card-shell group relative flex flex-col overflow-hidden rounded-3xl bg-slate-200 p-px shadow-[0_18px_45px_-34px_rgba(124,58,237,0.65)] transition-transform hover:scale-[1.015] hover:bg-gradient-to-br hover:from-amber-400/80 hover:via-fuchsia-500/70 hover:to-violet-500/80 dark:bg-slate-800 dark:shadow-[0_18px_45px_-30px_rgba(217,70,239,0.55)] ${
    isVisible ? "is-visible" : ""
  }`;

  const cardBody = (
    <div className="loot-card-inner flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-[23px] bg-white dark:bg-slate-950">
        <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-[#11101a] via-[#21122f] to-[#120d20]">
          <div aria-hidden className="loot-ring absolute h-36 w-36 rounded-full" />
          <div aria-hidden className="loot-ring loot-ring-small absolute h-24 w-24 rounded-full" />
          <span aria-hidden className="loot-spark loot-spark-one absolute text-amber-300">✦</span>
          <span aria-hidden className="loot-spark loot-spark-two absolute text-fuchsia-300">✦</span>
          <span aria-hidden className="loot-spark loot-spark-three absolute text-white/70">✦</span>
          <span aria-hidden className="loot-spark loot-spark-four absolute text-amber-200">✦</span>

          <div className="loot-box-art relative z-10 h-28 w-32 overflow-hidden rounded-2xl">
            {box.imageUrl ? (
              <ProductImage
                src={box.imageUrl}
                alt={box.title}
                className="h-full w-full object-cover"
                sizes="(max-width: 640px) 70vw, (max-width: 1024px) 35vw, 260px"
                priority={index === 0}
              />
            ) : (
              <div className="grid h-full w-full place-items-center rounded-2xl border border-white/10 bg-white/[0.06]">
                <Package className="h-16 w-16 text-white/60" />
              </div>
            )}
          </div>

          <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-3 py-1 text-sm font-black text-white shadow-lg shadow-fuchsia-950/30">
            {formatAzn(box.priceAznCents)}
          </span>
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-bold text-white/80">
            <SparkleMark /> Açmağa hazırsan?
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-black text-slate-900 dark:text-white">{box.title}</h3>
          {box.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-400">{box.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {formatAzn(box.minPrizeCents)} – {formatAzn(box.maxPrizeCents)}
            </span>
            {topOdds && (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-bold text-amber-700 dark:text-amber-300">
                {formatAzn(topOdds.valueAznCents)} — {topOdds.pct.toFixed(1)}%
              </span>
            )}
          </div>

          <div className="mt-4 flex-1" />
          <span className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform group-hover:-translate-y-0.5">
            {isOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            {isOpening ? "Açılır…" : "Qutunu aç"}
          </span>

          {/* Açmadan ÖNCƏ nə çıxa biləcəyini görmək müştərinin əsas sualıdır.
              `relative z-20` — üstündəki tam ölçülü açma düyməsindən yuxarıda
              qalsın deyə (aşağıdaki overlay pattern). */}
          {onOpen && (
            <Link
              href={`/qutu/${box.slug}`}
              className="relative z-20 mt-2 self-center text-[11px] font-bold text-slate-500 underline underline-offset-4 hover:text-fuchsia-600 dark:text-slate-400 dark:hover:text-fuchsia-400"
            >
              Hansı oyunlar çıxa bilər?
            </Link>
          )}
        </div>
      </div>
  );

  return (
    <>
      {onOpen ? (
        /*
          Kart artıq TAM ölçülü düymə deyil: içində ayrıca keçid ("Hansı oyunlar
          çıxa bilər?") var və düymə içində düymə/keçid HTML-də etibarsızdır.
          Ona görə klik sahəsi kartı örtən mütləq düymədir, keçid isə onun
          üstündə (z-20) qalır.
        */
        <div style={cardStyle} className={`${shellClass} relative w-full text-left`}>
          <button
            type="button"
            onClick={onOpen}
            disabled={isOpening}
            aria-busy={isOpening}
            aria-label={`${box.title} qutusunu aç`}
            className="absolute inset-0 z-10 cursor-pointer rounded-3xl disabled:cursor-wait"
          />
          {cardBody}
        </div>
      ) : (
        <Link href={`/qutu/${box.slug}`} style={cardStyle} className={shellClass}>
          {cardBody}
        </Link>
      )}

      <style jsx>{`
        .loot-card-shell {
          opacity: 0;
        }
        .loot-card-shell.is-visible {
          animation: loot-card-fade 620ms cubic-bezier(0.22, 1, 0.36, 1) var(--loot-delay) both;
        }
        .loot-card-shell.is-visible .loot-card-inner {
          animation: loot-card-lift 620ms cubic-bezier(0.22, 1, 0.36, 1) var(--loot-delay) both;
        }
        .loot-ring {
          border: 1px solid rgba(251, 191, 36, 0.32);
          background: conic-gradient(from 30deg, transparent, rgba(217, 70, 239, 0.5), transparent 35%, rgba(251, 191, 36, 0.35), transparent 72%);
          opacity: 0.72;
          animation: loot-ring-spin 10s linear infinite;
        }
        .loot-ring-small {
          border-color: rgba(255, 255, 255, 0.16);
          opacity: 0.45;
          animation-direction: reverse;
          animation-duration: 7s;
        }
        .loot-box-art {
          animation: loot-box-breathe 3.2s ease-in-out infinite;
          will-change: transform;
        }
        .group:hover .loot-box-art {
          transform: translateY(-4px) scale(1.035);
        }
        .loot-spark {
          z-index: 5;
          font-size: 15px;
          line-height: 1;
          animation: loot-spark-float 4.8s ease-in-out infinite;
          will-change: transform, opacity;
        }
        .loot-spark-one { left: 22%; top: 25%; animation-delay: -1.1s; }
        .loot-spark-two { right: 21%; top: 19%; animation-delay: -2.8s; }
        .loot-spark-three { left: 18%; bottom: 23%; font-size: 10px; animation-delay: -3.6s; }
        .loot-spark-four { right: 19%; bottom: 27%; font-size: 11px; animation-delay: -0.5s; }

        @keyframes loot-card-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes loot-card-lift {
          from { transform: translateY(14px); }
          to { transform: translateY(0); }
        }
        @keyframes loot-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes loot-box-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.018); }
        }
        @keyframes loot-spark-float {
          0%, 100% { opacity: 0.35; transform: translateY(2px) scale(0.86) rotate(0deg); }
          50% { opacity: 0.95; transform: translateY(-7px) scale(1) rotate(10deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .loot-card-shell,
          .loot-card-shell.is-visible {
            opacity: 1;
            animation: none;
          }
          .loot-card-shell.is-visible .loot-card-inner,
          .loot-ring,
          .loot-box-art,
          .loot-spark {
            animation: none;
          }
          .group:hover .loot-box-art {
            transform: none;
          }
        }
      `}</style>
    </>
  );
}

function SparkleMark() {
  return <span aria-hidden className="text-amber-300">✦</span>;
}
