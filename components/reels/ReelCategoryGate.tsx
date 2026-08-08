"use client";

import { Bookmark, Clapperboard, Gamepad2, Layers, X, Check } from "lucide-react";
import type { ReelCategory, ReelPlatformChip } from "./types";

/**
 * Feed seçim vərəqi — İKİ rolda işlədilir:
 *
 *  1. **İlk giriş qapısı** — `onClose` VERİLMİR. Seçim məcburidir, çünki seçim həll
 *     olunana qədər feed ümumiyyətlə render olunmur (SSR-də hansısa kateqoriyanı
 *     göstərsək qayıdan istifadəçi bir an yanlış feed-i görür).
 *  2. **Sonradan dəyişmək** — üstdəki çipdən açılır, `onClose` verilir və vərəq
 *     bağlana bilir. Əvvəllər bu iş üst sətirdəki 4 tab-la görülürdü; sətir daimi
 *     yer tuturdu, halbuki kateqoriya gündəlik dəyişilən şey deyil.
 *
 * Platforma süzgəci də buradadır (əvvəl üst sətirdə idi) — süzgəc süzgəcin yanında
 * olsun deyə; yalnız film feed-ində mənalıdır.
 */
const OPTIONS: {
  value: ReelCategory;
  title: string;
  subtitle: string;
  Icon: typeof Gamepad2;
  accent: string;
}[] = [
  {
    value: "GAME",
    title: "Oyun",
    subtitle: "Trailer-lər, qiymətlər, tək toxunuşla səbətə",
    Icon: Gamepad2,
    accent: "from-violet-500 to-fuchsia-600",
  },
  {
    value: "STREAMING",
    title: "Film & Serial",
    subtitle: "Netflix, Prime və digər platformalardan",
    Icon: Clapperboard,
    accent: "from-rose-500 to-orange-500",
  },
  {
    value: "ALL",
    title: "Hamısı",
    subtitle: "Hər ikisi qarışıq göstərilsin",
    Icon: Layers,
    accent: "from-sky-500 to-emerald-500",
  },
  {
    value: "SAVED",
    title: "Saxladıqlarım",
    subtitle: "Favorit oyunlarına aid videolar",
    Icon: Bookmark,
    accent: "from-amber-500 to-yellow-600",
  },
];

export default function ReelCategoryGate({
  onPick,
  current,
  onClose,
  platforms = [],
  activePlatform = null,
  onPlatformChange,
}: {
  onPick: (category: ReelCategory) => void;
  /** Hazırkı seçim — işarələnir. İlk girişdə `undefined`. */
  current?: ReelCategory;
  /** Verilirsə vərəq bağlana bilir (ilk giriş qapısında VERİLMİR). */
  onClose?: () => void;
  platforms?: ReelPlatformChip[];
  activePlatform?: string | null;
  onPlatformChange?: (code: string | null) => void;
}) {
  const firstRun = !onClose;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md">
      {/* Fon toxunuşu ilə bağlanma — yalnız sonradan açılanda. */}
      {onClose && <button aria-label="Bağla" onClick={onClose} className="absolute inset-0" />}

      <div className="relative w-full max-w-md">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Bağla"
            className="absolute -top-2 right-0 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <h1 className="text-center text-2xl font-black text-white">
          {firstRun ? "Nə izləmək istəyirsən?" : "Feed"}
        </h1>
        {firstRun && (
          <p className="mt-2 text-center text-sm text-white/60">
            Feed-i sənə uyğunlaşdıraq. Sonra istənilən vaxt dəyişə bilərsən.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {OPTIONS.map(({ value, title, subtitle, Icon, accent }) => {
            // "Saxladıqlarım" ilk girişdə seçim deyil — istifadəçinin hələ heç nəyi
            // yoxdur, boş feed ilə qarşılaşardı.
            if (value === "SAVED" && firstRun) return null;
            const active = current === value;
            return (
              <button
                key={value}
                onClick={() => onPick(value)}
                aria-pressed={active}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                  active
                    ? "border-white bg-white/15"
                    : "border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10"
                }`}
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-lg`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-white">{title}</span>
                  <span className="block text-xs text-white/60">{subtitle}</span>
                </span>
                {active && <Check className="h-5 w-5 shrink-0 text-white" />}
              </button>
            );
          })}
        </div>

        {/* Platforma süzgəci — yalnız film feed-ində. Oyun sətirlərində platformCode
            "PS"/"EPIC" olur və süzgəc kimi maraqsızdır. */}
        {current === "STREAMING" && platforms.length > 0 && onPlatformChange && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">
              Platforma
            </p>
            <div className="flex flex-wrap gap-1.5">
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
          </div>
        )}
      </div>
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
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active ? "bg-white text-zinc-900" : "bg-white/10 text-white/80 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}
