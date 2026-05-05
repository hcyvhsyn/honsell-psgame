"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gamepad2, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import FavoriteButton from "./FavoriteButton";

export type GameCardData = {
  id: string;
  title: string;
  imageUrl: string | null;
  /** "PS5", "PS4", or "PS5,PS4" for cross-gen titles. NULL for concepts. */
  platform: string | null;
  productType: string;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  /** ISO timestamp of when the active discount expires; null if no discount or unknown. */
  discountEndAt: string | null;
  /** PS Store productId — when present, the card links to /oyunlar/[productId]. */
  productId?: string | null;
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function useCountdown(iso: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    setNow(Date.now());
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [iso]);

  if (!iso || now === null) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - now;
  if (diff <= 0) return { expired: true, text: "Bitdi" };

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const hms = `${pad(hours)}.${pad(minutes)}.${pad(seconds)}`;
  const text = days > 0 ? `${days} g ${hms}` : hms;
  return { expired: false, text };
}

export default function GameCard({ game, priority = false }: { game: GameCardData; priority?: boolean }) {
  const { add, remove, has, hydrated } = useCart();
  const inCart = hydrated && has(game.id);
  const countdown = useCountdown(game.discountEndAt);

  const platforms = game.platform ? game.platform.split(",") : [];
  const detailHref = game.productId ? `/oyunlar/${game.productId}` : null;

  const cover = (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] bg-zinc-900">
      {game.imageUrl ? (
        <Image
          src={game.imageUrl}
          alt={game.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          unoptimized
          priority={priority}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-zinc-600 bg-gradient-to-br from-zinc-900 to-zinc-800">
          <Gamepad2 className="h-10 w-10 opacity-30" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      <FavoriteButton gameId={game.id} variant="card" />

      {platforms.length > 0 && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          {platforms.map((p) => (
            <span
              key={p}
              className="rounded-full border border-white/40 bg-black/30 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md"
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <li className="group flex flex-col overflow-hidden rounded-[24px] border border-zinc-800 bg-[#0A0A0A] transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-[0_8px_30px_-10px_rgba(99,102,241,0.15)]">
      <div className="relative p-3 pb-0">
        {detailHref ? (
          <Link href={detailHref} aria-label={game.title} className="block">
            {cover}
          </Link>
        ) : (
          cover
        )}

        {game.discountPct != null && (
          <span className="pointer-events-none absolute -right-1 -top-1 grid h-16 w-16 place-items-center rounded-full bg-[#6D28D9] text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(109,40,217,0.6)] ring-4 ring-[#0A0A0A]">
            -{game.discountPct}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4 text-center">
        {detailHref ? (
          <Link
            href={detailHref}
            className="line-clamp-2 text-lg font-semibold leading-tight text-white transition hover:text-indigo-300"
          >
            {game.title}
          </Link>
        ) : (
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white">
            {game.title}
          </h3>
        )}

        <div className="mt-3 flex items-baseline justify-center gap-3">
          {game.originalAzn != null && (
            <span className="relative text-base font-medium text-zinc-500">
              {game.originalAzn.toFixed(2)}₼
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 -rotate-6 bg-rose-500"
              />
            </span>
          )}
          <span className="text-2xl font-bold leading-none tracking-tight text-white">
            {game.finalAzn.toFixed(2)}₼
          </span>
        </div>

        <div className="mt-2 min-h-[20px] text-sm">
          {countdown ? (
            <span className="text-zinc-400">
              Kampaniyanın bitişinə:{" "}
              <span className="font-semibold text-indigo-300 tabular-nums">
                {countdown.text}
              </span>
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex-1 flex flex-col justify-end">
          {inCart ? (
            <button
              type="button"
              onClick={() => remove(game.id)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
            >
              <Trash2 className="h-4 w-4" /> Səbətdən sil
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                add({
                  id: game.id,
                  title: game.title,
                  imageUrl: game.imageUrl,
                  finalAzn: game.finalAzn,
                  productType: game.productType,
                })
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all duration-200 hover:bg-[#5B21B6]"
            >
              <Plus className="h-4 w-4" /> Səbətə əlavə et
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
