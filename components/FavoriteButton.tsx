"use client";

import { Heart, Info } from "lucide-react";
import { useState } from "react";
import { useFavorites } from "@/lib/favorites";

type Variant = "card" | "detail";

/**
 * Heart toggle button. Two visual variants:
 *  - "card":   small floating button on top of GameCard cover (top-left).
 *  - "detail": full pill button beside the product page CTA.
 *
 * Includes an info `?` icon that explains the favorite mechanic on hover/tap.
 * On the user's first successful add, a one-time popup is dispatched via the
 * `honsell:favorite-intro` window event (handled by `FavoriteIntroModal`).
 */
export default function FavoriteButton({
  gameId,
  variant = "card",
}: {
  gameId: string;
  variant?: Variant;
}) {
  const { has, toggle, consumeIntroPopup, hydrated, isAuthed } = useFavorites();
  const fav = hydrated && has(gameId);
  const [busy, setBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const nowFav = await toggle(gameId);
      if (nowFav && consumeIntroPopup()) {
        // First-add popup
        window.dispatchEvent(new CustomEvent("honsell:favorite-intro"));
      }
    } finally {
      setBusy(false);
    }
  }

  const tooltip = isAuthed
    ? fav
      ? "Favorilərdən sil"
      : "Favorilərə əlavə et — endirim olanda email göndərək"
    : "Favorilərə əlavə etmək üçün daxil ol";

  if (variant === "detail") {
    return (
      <div className="relative flex items-center gap-3">
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-pressed={fav}
          aria-label={tooltip}
          className={`inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-3 rounded-2xl border px-5 text-base font-bold transition ${
            fav
              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/20"
              : "border-zinc-200 bg-white/75 text-zinc-800 hover:border-rose-300 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-rose-500/40 dark:hover:text-rose-200"
          } ${busy ? "opacity-60" : ""}`}
        >
          <Heart
            className={`h-5 w-5 shrink-0 transition ${
              fav ? "fill-rose-400 text-rose-400" : ""
            }`}
          />
          <span className="truncate">{fav ? "Favorilərdə" : "Favorilərə əlavə et"}</span>
        </button>

        <FavTip open={tipOpen} setOpen={setTipOpen} placement="left" />
      </div>
    );
  }

  // "card" variant — floating top-left
  return (
    <div className="absolute left-3 top-3 z-10">
      <div className="relative">
        <button
          type="button"
          onClick={onClick}
          onMouseEnter={() => setTipOpen(true)}
          onMouseLeave={() => setTipOpen(false)}
          onFocus={() => setTipOpen(true)}
          onBlur={() => setTipOpen(false)}
          disabled={busy}
          aria-pressed={fav}
          aria-label={tooltip}
          className={`grid h-9 w-9 place-items-center rounded-full border backdrop-blur-md transition ${
            fav
              ? "border-rose-400/60 bg-rose-500/30 text-rose-100 shadow-[0_4px_12px_-4px_rgba(244,63,94,0.6)]"
              : "border-white/30 bg-black/40 text-white hover:bg-black/60"
          } ${busy ? "opacity-60" : ""}`}
        >
          <Heart
            className={`h-4 w-4 transition ${
              fav ? "fill-rose-300 text-rose-300" : ""
            }`}
          />
        </button>
        {tipOpen && (
          <div
            role="tooltip"
            className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300 shadow-2xl"
          >
            <p className="font-semibold text-white">Favorilər niyə var?</p>
            <p className="mt-1 text-zinc-400">
              Oyunu favorilərə əlavə edəndə həmin oyun yenidən endirimə düşəndə
              sənə email göndəririk — bütün favorilər profilindəki{" "}
              <i>Favorilər</i> bölməsində toplanır.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FavTip({
  open,
  setOpen,
  placement,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  placement: "left" | "right";
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label="Favorilər nə üçündür?"
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-zinc-200 bg-white/75 text-zinc-600 shadow-sm backdrop-blur-md transition hover:border-violet-200 hover:bg-white hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-violet-400/40 dark:hover:bg-zinc-900 dark:hover:text-white"
      >
        <Info className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className={`absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs leading-relaxed text-zinc-600 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 ${
            placement === "right" ? "left-0" : "right-0"
          }`}
        >
          <p className="font-semibold text-zinc-950 dark:text-white">Favorilər niyə var?</p>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Oyunu favorilərə əlavə edəndə həmin oyun yenidən endirimə düşəndə
            sənə email göndəririk — bütün favorilər profilindəki{" "}
            <i>Favorilər</i> bölməsində toplanır.
          </p>
        </div>
      )}
    </div>
  );
}
