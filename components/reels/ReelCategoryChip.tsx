"use client";

import { ChevronDown } from "lucide-react";
import { REEL_CATEGORY_LABELS } from "./reelCategory";
import type { ReelCategory, ReelPlatformChip } from "./types";

/**
 * Üst sətirdəki TƏK çip — əvvəlki 4 tab-lıq sətri əvəz edir.
 *
 * Kateqoriya gündəlik dəyişilən şey deyil (bir dəfə seçilir və `localStorage`-da
 * qalır), ona görə daimi tab sətri ekranın ən qiymətli hissəsini boş yerə tuturdu.
 * İndi hazırkı seçim göstərilir, dəyişmək üçün toxunulur → `ReelCategoryGate` açılır.
 *
 * Aktiv platforma süzgəci də burada görünür ki, süzgəcin vərəqdə gizlənməsi
 * "niyə az video var?" sualı yaratmasın.
 */
export default function ReelCategoryChip({
  category,
  platforms,
  activePlatform,
  onOpen,
}: {
  category: ReelCategory;
  platforms: ReelPlatformChip[];
  activePlatform: string | null;
  onOpen: () => void;
}) {
  const platformLabel =
    activePlatform != null
      ? (platforms.find((p) => p.code === activePlatform)?.label ?? activePlatform)
      : null;

  return (
    <button
      onClick={onOpen}
      aria-label="Feed seçimi"
      className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl bg-slate-900/80 px-5 py-3 text-base font-bold text-white shadow-lg shadow-black/30 ring-1 ring-white/10 backdrop-blur transition hover:bg-slate-900 active:scale-95"
    >
      <span className="max-w-[11rem] truncate">
        {REEL_CATEGORY_LABELS[category]}
        {platformLabel ? ` · ${platformLabel}` : ""}
      </span>
      <ChevronDown className="h-4 w-4 opacity-70" />
    </button>
  );
}
