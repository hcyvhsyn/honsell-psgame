"use client";

import { Bookmark } from "lucide-react";
import type { ReelCategory, ReelPlatformChip } from "./types";

const TABS: { value: ReelCategory; label: string }[] = [
  { value: "GAME", label: "Oyun" },
  { value: "STREAMING", label: "Film" },
  { value: "ALL", label: "Hamısı" },
  // "Saxladıqlarım" — oyun favoritləri + film izləmə siyahısı birlikdə.
  { value: "SAVED", label: "★" },
];

/**
 * Feed-in yuxarısındakı kateqoriya keçidi + (yalnız film rejimində) platforma
 * çipləri. Seçim `localStorage`-a yazılır, ona görə keçid həm də "bir daha bunu
 * göstər" deməkdir.
 */
export default function ReelCategorySwitch({
  category,
  onCategoryChange,
  platforms,
  activePlatform,
  onPlatformChange,
}: {
  category: ReelCategory;
  onCategoryChange: (c: ReelCategory) => void;
  platforms: ReelPlatformChip[];
  activePlatform: string | null;
  onPlatformChange: (code: string | null) => void;
}) {
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2">
      <div className="flex rounded-full bg-black/55 p-1 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => onCategoryChange(t.value)}
            aria-pressed={category === t.value}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              category === t.value ? "bg-white text-zinc-900" : "text-white/75 hover:text-white"
            }`}
          >
            {t.value === "SAVED" ? (
              <span className="inline-flex items-center gap-1">
                <Bookmark className={`h-3.5 w-3.5 ${category === "SAVED" ? "fill-zinc-900" : ""}`} />
                Saxladıqlarım
              </span>
            ) : (
              t.label
            )}
          </button>
        ))}
      </div>

      {/* Platforma çipləri yalnız film feed-ində mənalıdır — oyun sətirlərində
          platformCode "PS"/"EPIC" olur və süzgəc kimi maraqsızdır. */}
      {category === "STREAMING" && platforms.length > 0 && (
        <div
          className="flex max-w-[92vw] gap-1.5 overflow-x-auto px-1"
          style={{ scrollbarWidth: "none" }}
        >
          <Chip active={activePlatform === null} onClick={() => onPlatformChange(null)}>
            Hamısı
          </Chip>
          {platforms.map((p) => (
            <Chip
              key={p.code}
              active={activePlatform === p.code}
              onClick={() => onPlatformChange(activePlatform === p.code ? null : p.code)}
            >
              {p.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold backdrop-blur transition ${
        active ? "bg-white text-zinc-900" : "bg-black/50 text-white/80 hover:bg-black/70"
      }`}
    >
      {children}
    </button>
  );
}
