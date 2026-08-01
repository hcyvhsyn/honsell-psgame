"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";

import LootBoxCard, { type LootBoxCardData } from "./LootBoxCard";

/**
 * Ana səhifə "Qutu açılışı" bölməsi.
 *
 * Data client-də `/api/loot-boxes`-dan gəlir ki, ana səhifə HTML-i statik/ISR
 * qalsın (çəkilişlər bölməsi ilə eyni yanaşma). Qutu yoxdursa heç nə göstərmir.
 */
export default function HomeLootBoxes() {
  const [boxes, setBoxes] = useState<LootBoxCardData[] | null>(null);

  useEffect(() => {
    fetch("/api/loot-boxes")
      .then((r) => (r.ok ? r.json() : { boxes: [] }))
      .then((d: { boxes?: LootBoxCardData[] }) => setBoxes(d.boxes ?? []))
      .catch(() => setBoxes([]));
  }, []);

  if (boxes != null && boxes.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900 dark:text-white">
            <Package className="h-6 w-6 text-amber-500" /> Qutu açılışı
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Qutunu aç, təsadüfi oyun qazan. Bütün şanslar açıq göstərilir.
          </p>
        </div>
        <Link
          href="/qutular"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-slate-700 hover:underline dark:text-slate-300"
        >
          Hamısı <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {boxes == null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {boxes.slice(0, 4).map((box) => (
            <LootBoxCard key={box.slug} box={box} />
          ))}
        </div>
      )}
    </section>
  );
}
