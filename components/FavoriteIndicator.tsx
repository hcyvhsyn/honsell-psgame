"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { useModals } from "@/lib/modals";

const BRAND_PURPLE = "#6301F3";
const BRAND_PURPLE_DARK = "#2D006F";

export default function FavoriteIndicator() {
  const { ids, hydrated, isAuthed } = useFavorites();
  const { open } = useModals();
  const count = ids.size;

  // Anonymous → click opens login modal (favorites only work logged-in).
  if (!isAuthed) {
    return (
      <button
        type="button"
        onClick={() => open("login")}
        aria-label="Favorilər"
        title="Favorilər — daxil ol"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border bg-transparent text-zinc-200 transition hover:bg-white/5 hover:text-white"
        style={{ borderColor: `${BRAND_PURPLE}80` }}
      >
        <Heart className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Link
      href="/profile/favorites"
      aria-label="Favorilər"
      title="Favorilər"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border bg-transparent text-zinc-200 transition hover:bg-white/5 hover:text-white"
      style={{ borderColor: `${BRAND_PURPLE}80` }}
    >
      <Heart className="h-4 w-4" />
      {hydrated && count > 0 && (
        <span
          className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
          style={{
            backgroundImage: `linear-gradient(90deg, ${BRAND_PURPLE}, ${BRAND_PURPLE_DARK})`,
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
