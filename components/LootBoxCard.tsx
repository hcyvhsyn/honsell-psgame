"use client";

import Link from "next/link";
import { Package } from "lucide-react";

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
};

/** Qutu kartı — ana səhifə bölməsi və /qutular siyahısı paylaşır. */
export default function LootBoxCard({ box }: { box: LootBoxCardData }) {
  const topOdds = box.odds[0];

  return (
    <Link
      href={`/qutu/${box.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950">
        {box.imageUrl ? (
          <ProductImage
            src={box.imageUrl}
            alt={box.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <Package className="h-16 w-16 text-white/20 transition group-hover:scale-110" />
        )}
        <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-3 py-1 text-sm font-black text-white shadow">
          {formatAzn(box.priceAznCents)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-black text-slate-900 dark:text-white">{box.title}</h3>
        {box.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{box.description}</p>
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
        <span className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-slate-800 dark:bg-white dark:text-slate-900">
          Qutunu aç
        </span>
      </div>
    </Link>
  );
}
