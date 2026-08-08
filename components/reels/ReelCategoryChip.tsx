"use client";

import { Bookmark, ChevronDown, Clapperboard, Gamepad2, Layers } from "lucide-react";
import { REEL_CATEGORY_LABELS } from "./reelCategory";
import type { ReelCategory, ReelPlatformChip } from "./types";

const ICONS: Record<ReelCategory, typeof Gamepad2> = {
  GAME: Gamepad2,
  STREAMING: Clapperboard,
  ALL: Layers,
  SAVED: Bookmark,
};

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
  const Icon = ICONS[category];
  const platformLabel =
    activePlatform != null
      ? (platforms.find((p) => p.code === activePlatform)?.label ?? activePlatform)
      : null;

  return (
    <button
      onClick={onOpen}
      aria-label="Feed seçimi"
      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-black/70 active:scale-95"
    >
      <Icon className="h-4 w-4" />
      <span className="max-w-[9rem] truncate">
        {REEL_CATEGORY_LABELS[category]}
        {platformLabel ? ` · ${platformLabel}` : ""}
      </span>
      <ChevronDown className="h-4 w-4 opacity-70" />
    </button>
  );
}
