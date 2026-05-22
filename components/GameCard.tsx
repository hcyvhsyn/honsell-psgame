"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Gamepad2,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import FavoriteButton from "./FavoriteButton";
import PlatformInfoButton from "./PlatformInfoButton";

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

  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const text = days > 0 ? `${days} gün ${hms}` : hms;
  return { expired: false, text };
}

// Maps productType to a small "DLC / Pul kartı / Digər" chip rendered over the
// card cover. GAME deliberately renders no chip — base games are the default
// expectation and a "GAME" tag would be noise on every card.
function getProductTypeBadge(productType: string) {
  switch (productType) {
    case "ADDON":
      return {
        label: "DLC",
        className: "border-fuchsia-300/60 bg-fuchsia-600/70",
      };
    case "CURRENCY":
      return {
        label: "Pul kartı",
        className: "border-emerald-300/60 bg-emerald-600/70",
      };
    case "OTHER":
      return {
        label: "Digər",
        className: "border-sky-300/60 bg-sky-600/70",
      };
    default:
      return null;
  }
}

function getPlatformHelp(platform: string) {
  switch (platform) {
    case "PS5":
      return "PS5 versiyasıdır. PS4-də işləməyə bilər.";
    case "PS4":
      return "PS4 versiyasıdır. PS5-də də çox vaxt işləyir.";
    default:
      return `${platform} uyğunluğu`;
  }
}

type GameCardVariant = "default" | "compact";

export default function GameCard({
  game,
  priority = false,
  variant = "default",
}: {
  game: GameCardData;
  priority?: boolean;
  variant?: GameCardVariant;
}) {
  const { add, remove, has, hydrated } = useCart();
  const inCart = hydrated && has(game.id);
  const countdown = useCountdown(game.discountEndAt);
  const compact = variant === "compact";

  const platforms = game.platform ? game.platform.split(",").map((p) => p.trim()).filter(Boolean) : [];
  const detailHref = game.productId ? `/oyunlar/${game.productId}` : null;
  const productTypeBadge = getProductTypeBadge(game.productType);

  const coverVisual = (
    <div className="relative aspect-square w-full overflow-hidden rounded-[18px] bg-zinc-100 dark:bg-zinc-900">
      {game.imageUrl ? (
        <>
          <Image
            src={game.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="scale-110 object-cover opacity-45 blur-xl"
            priority={priority}
            aria-hidden
          />
          <Image
            src={game.imageUrl}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain transition-transform duration-700 group-hover:scale-[1.03]"
            priority={priority}
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600 bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-900 dark:to-zinc-800">
          <Gamepad2 className="h-10 w-10 opacity-30" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      {detailHref && (
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg backdrop-blur-md transition group-hover:opacity-100">
          Ətraflı bax
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      )}

    </div>
  );

  return (
    <li className="group flex flex-col overflow-hidden rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-[0_8px_30px_-10px_rgba(99,102,241,0.15)]">
      <div className="relative p-3 pb-0">
        <div className="relative">
          {detailHref ? (
            <Link href={detailHref} aria-label={`${game.title} daxili səhifəsinə keç`} className="block">
              {coverVisual}
            </Link>
          ) : (
            coverVisual
          )}

          <FavoriteButton gameId={game.id} variant="card" />

          {platforms.length > 0 && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
              {platforms.map((p) => (
                <span
                  key={p}
                  tabIndex={0}
                  title={getPlatformHelp(p)}
                  aria-label={getPlatformHelp(p)}
                  className="group/platform relative rounded-full border border-white/40 bg-black/30 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md outline-none transition focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  {p}
                  <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-52 translate-y-1 rounded-xl border border-white/20 bg-zinc-950/90 px-3 py-2 text-left text-[11px] font-medium normal-case leading-snug tracking-normal text-zinc-100 opacity-0 shadow-2xl backdrop-blur-md transition group-hover/platform:translate-y-0 group-hover/platform:opacity-100 group-focus/platform:translate-y-0 group-focus/platform:opacity-100">
                    {getPlatformHelp(p)}
                  </span>
                </span>
              ))}
              <PlatformInfoButton
                variant="compact"
                className="h-7 w-7 border border-white/35 bg-black/35 text-white hover:bg-black/55"
              />
            </div>
          )}

          {productTypeBadge && (
            <div className="absolute bottom-3 right-3">
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-md ${productTypeBadge.className}`}
              >
                {productTypeBadge.label}
              </span>
            </div>
          )}
        </div>

        {game.discountPct != null && (
          <span className="pointer-events-none absolute -right-1 -top-1 z-20 grid h-16 w-16 place-items-center rounded-full bg-[#6D28D9] text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(109,40,217,0.6)] ring-4 ring-white dark:ring-[#0A0A0A]">
            -{game.discountPct}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4 text-center">
        {detailHref ? (
          <Link
            href={detailHref}
            className="line-clamp-2 text-lg font-semibold leading-tight text-zinc-900 dark:text-white transition hover:text-indigo-300"
          >
            {game.title}
          </Link>
        ) : (
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-zinc-900 dark:text-white">
            {game.title}
          </h3>
        )}

        {detailHref && !compact && (
          <Link
            href={detailHref}
            className="mx-auto mt-2 inline-flex items-center gap-1 text-xs font-bold text-violet-600 transition hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200"
          >
            Daxili səhifəyə keç
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}

        <div className="mt-3 flex items-baseline justify-center gap-3">
          {game.originalAzn != null && (
            <span className="relative text-base font-medium text-zinc-600 dark:text-zinc-300">
              {game.originalAzn.toFixed(2)}₼
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-rose-400/90"
              />
            </span>
          )}
          <span className="text-2xl font-bold leading-none tracking-tight text-zinc-900 dark:text-white">
            {game.finalAzn.toFixed(2)}₼
          </span>
        </div>

        <div className="mt-2 min-h-[20px] text-sm">
          {countdown ? (
            <span className="text-zinc-500 dark:text-zinc-400">
              Kampaniyanın bitişinə:{" "}
              <span className="font-semibold text-indigo-300 tabular-nums">
                {countdown.text}
              </span>
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-1 flex-col justify-end">
          {compact ? (
            <button
              type="button"
              onClick={() =>
                !inCart &&
                add({
                  id: game.id,
                  title: game.title,
                  imageUrl: game.imageUrl,
                  finalAzn: game.finalAzn,
                  productType: game.productType,
                })
              }
              disabled={inCart}
              aria-label={inCart ? "Səbətdədir" : "Səbətə əlavə et"}
              title={inCart ? "Səbətdədir" : "Səbətə əlavə et"}
              className={`mx-auto inline-grid h-12 w-12 place-items-center rounded-full border shadow-lg transition ${
                inCart
                  ? "border-emerald-400/35 bg-emerald-500/20 text-emerald-200"
                  : "border-violet-400/35 bg-violet-600 text-white shadow-violet-500/25 hover:bg-violet-500"
              }`}
            >
              {inCart ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            </button>
          ) : inCart ? (
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
