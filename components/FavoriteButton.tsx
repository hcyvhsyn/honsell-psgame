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
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-pressed={fav}
          aria-label={tooltip}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-semibold transition ${
            fav
              ? "border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/20"
              : "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:border-rose-500/40 hover:text-rose-200"
          } ${busy ? "opacity-60" : ""}`}
        >
          <Heart
            className={`h-4 w-4 transition ${
              fav ? "fill-rose-400 text-rose-400" : ""
            }`}
          />
          {fav ? "Favorilərdə" : "Favorilərə əlavə et"}
        </button>

        <FavTip open={tipOpen} setOpen={setTipOpen} placement="left" />
      </div>
    );
  }

  // "card" variant — floating top-left
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={fav}
        aria-label={tooltip}
        title={tooltip}
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
      <FavTip open={tipOpen} setOpen={setTipOpen} placement="right" />
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
        aria-label="Favorilər nə üçündür?"
        className="grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-black/40 text-zinc-300 backdrop-blur-md transition hover:bg-black/60 hover:text-white"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className={`absolute top-full z-30 mt-2 w-64 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300 shadow-2xl ${
            placement === "right" ? "left-0" : "right-0"
          }`}
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
  );
}
