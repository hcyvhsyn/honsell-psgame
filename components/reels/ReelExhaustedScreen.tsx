"use client";

import { RotateCcw, PartyPopper } from "lucide-react";
import type { ReelCategory } from "./types";

/**
 * "Hamısını gördün" — kataloqdakı bütün videolar izlənilib.
 *
 * ⚠️ Feed client-indəki `EmptyState` ilə QARIŞDIRMA: o, "heç video yoxdur"
 * halıdır (admin hələ heç nə yayımlamayıb). Bu isə əksi — istifadəçi hamısına
 * baxıb. Mesajlar fərqli olmalıdır, yoxsa istifadəçi saytda video olmadığını düşünür.
 */
export default function ReelExhaustedScreen({
  category,
  onRestart,
  onSwitchCategory,
}: {
  category: ReelCategory;
  onRestart: () => void;
  onSwitchCategory: (c: ReelCategory) => void;
}) {
  const other: ReelCategory = category === "GAME" ? "STREAMING" : "GAME";

  return (
    <div className="grid h-full w-full place-items-center bg-black px-6 text-center">
      <div className="max-w-xs">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-xl">
          <PartyPopper className="h-8 w-8" />
        </span>

        <h2 className="mt-4 text-xl font-black text-white">Hamısını gördün 🎉</h2>
        <p className="mt-2 text-sm text-white/60">
          Bu kateqoriyadakı bütün videolara baxdın. Tezliklə yeniləri əlavə olunacaq.
        </p>

        <button
          onClick={onRestart}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-zinc-900 transition hover:bg-zinc-100 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          Əvvəldən başla
        </button>

        {category !== "ALL" && (
          <button
            onClick={() => onSwitchCategory(other)}
            className="mt-2 w-full rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-white/85 transition hover:bg-white/10"
          >
            {other === "GAME" ? "🎮 Oyun videolarına keç" : "🎬 Film & serial videolarına keç"}
          </button>
        )}
      </div>
    </div>
  );
}
