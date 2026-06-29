"use client";

import Image from "next/image";
import { cdnImageUrl } from "@/lib/cdnImage";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Gamepad2,
  Gift,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import FavoriteButton from "./FavoriteButton";
import PlatformInfoButton from "./PlatformInfoButton";
import ReferralBadge from "./ReferralBadge";

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
  /** Storefront: "PS" (default) or "EPIC". Epic cards swap PS chrome for Epic branding. */
  store?: string | null;
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
    case "PC":
      return "Epic Games Store (PC) versiyasıdır.";
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
  const { add, addGift, remove, has, hasGift, hydrated } = useCart();
  const inCart = hydrated && has(game.id);
  const giftInCart = hydrated && hasGift(game.id);
  const countdown = useCountdown(game.discountEndAt);
  const compact = variant === "compact";

  const isEpic = game.store === "EPIC" || game.platform === "PC";
  const cartPayload = {
    id: game.id,
    title: game.title,
    imageUrl: game.imageUrl,
    finalAzn: game.finalAzn,
    productType: game.productType,
    store: isEpic ? "EPIC" : "PS",
  };
  // Məhsul aktiv endirimdədirsə, hədiyyə sətrinə endirimin bitmə tarixini ötürürük
  // ki, müştəriyə "endirim müddətində aktivləşdir" xəbərdarlığı göstərilə bilsin.
  const giftDiscountEndAt = game.discountPct != null ? game.discountEndAt : null;
  const isDiscounted = game.discountPct != null;
  const platforms = game.platform ? game.platform.split(",").map((p) => p.trim()).filter(Boolean) : [];
  const detailHref = game.productId ? `/oyunlar/${game.productId}` : null;
  const productTypeBadge = getProductTypeBadge(game.productType);

  const coverVisual = (
    <div className="relative aspect-square w-full overflow-hidden rounded-[18px] bg-zinc-100 dark:bg-zinc-900">
      {game.imageUrl ? (
        <>
          <Image
            src={cdnImageUrl(game.imageUrl)}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="scale-110 object-cover opacity-45 blur-xl"
            priority={priority}
            aria-hidden
          />
          <Image
            src={cdnImageUrl(game.imageUrl)}
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
    <li className="group flex flex-col overflow-hidden rounded-[18px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0A] transition hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-[0_8px_30px_-10px_rgba(99,102,241,0.15)] sm:rounded-[24px]">
      <div className="relative p-2 pb-0 sm:p-3">
        <div className="relative">
          {detailHref ? (
            <Link href={detailHref} aria-label={`${game.title} daxili səhifəsinə keç`} className="block">
              {coverVisual}
            </Link>
          ) : (
            coverVisual
          )}

          <FavoriteButton gameId={game.id} variant="card" />

          {isEpic ? (
            <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/55 px-2.5 py-1 backdrop-blur-md sm:gap-2 sm:px-3 sm:py-1.5">
                <Image
                  src="/epic-white-logo.png"
                  alt="Epic Games"
                  width={16}
                  height={16}
                  className="h-3.5 w-3.5 object-contain sm:h-4 sm:w-4"
                />
                <span className="text-[10px] font-semibold tracking-wide text-white sm:text-[11px]">
                  Epic Games · PC
                </span>
              </span>
            </div>
          ) : platforms.length > 0 ? (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 sm:bottom-3 sm:left-3 sm:gap-1.5">
              {platforms.map((p) => (
                <span
                  key={p}
                  tabIndex={0}
                  title={getPlatformHelp(p)}
                  aria-label={getPlatformHelp(p)}
                  className="group/platform relative rounded-full border border-white/40 bg-black/30 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white backdrop-blur-md outline-none transition focus-visible:ring-2 focus-visible:ring-white/80 sm:px-3 sm:py-1 sm:text-[11px]"
                >
                  {p}
                  <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-52 translate-y-1 rounded-xl border border-white/20 bg-zinc-950/90 px-3 py-2 text-left text-[11px] font-medium normal-case leading-snug tracking-normal text-zinc-100 opacity-0 shadow-2xl backdrop-blur-md transition group-hover/platform:translate-y-0 group-hover/platform:opacity-100 group-focus/platform:translate-y-0 group-focus/platform:opacity-100">
                    {getPlatformHelp(p)}
                  </span>
                </span>
              ))}
              <PlatformInfoButton
                variant="compact"
                className="hidden h-7 w-7 border border-white/35 bg-black/35 text-white hover:bg-black/55 sm:inline-flex"
              />
            </div>
          ) : null}

          {productTypeBadge && (
            <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3">
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-md sm:px-2.5 sm:py-1 sm:text-[10px] ${productTypeBadge.className}`}
              >
                {productTypeBadge.label}
              </span>
            </div>
          )}
        </div>

        {game.discountPct != null && (
          <span className="pointer-events-none absolute -right-1 -top-1 z-20 grid h-11 w-11 place-items-center rounded-full bg-[#6D28D9] text-[11px] font-bold text-white shadow-[0_8px_24px_-6px_rgba(109,40,217,0.6)] ring-2 ring-white dark:ring-[#0A0A0A] sm:h-16 sm:w-16 sm:text-sm sm:ring-4">
            -{game.discountPct}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-3 text-center sm:px-5 sm:pb-5 sm:pt-4">
        {detailHref ? (
          <Link
            href={detailHref}
            className="line-clamp-2 text-sm font-semibold leading-tight text-zinc-900 dark:text-white transition hover:text-indigo-300 sm:text-lg"
          >
            {game.title}
          </Link>
        ) : (
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-zinc-900 dark:text-white sm:text-lg">
            {game.title}
          </h3>
        )}

        {detailHref && !compact && (
          <Link
            href={detailHref}
            className="mx-auto mt-2 hidden items-center gap-1 text-xs font-bold text-violet-600 transition hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200 sm:inline-flex"
          >
            Daxili səhifəyə keç
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}

        <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 sm:mt-3 sm:gap-3">
          {game.originalAzn != null && (
            <span className="relative text-xs font-medium text-zinc-600 dark:text-zinc-300 sm:text-base">
              {game.originalAzn.toFixed(2)}₼
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-rose-400/90"
              />
            </span>
          )}
          <span className="text-lg font-bold leading-none tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
            {game.finalAzn.toFixed(2)}₼
          </span>
        </div>

        <div className="mt-1 flex justify-center">
          <ReferralBadge category="games" productName={game.title} compact />
        </div>

        <div className="mt-1 min-h-[18px] text-[11px] sm:mt-2 sm:min-h-[20px] sm:text-sm">
          {countdown ? (
            <span className="text-zinc-500 dark:text-zinc-400">
              <span className="hidden sm:inline">Kampaniyanın bitişinə: </span>
              <span className="sm:hidden">Bitir: </span>
              <span className="font-semibold text-indigo-300 tabular-nums">
                {countdown.text}
              </span>
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-1 flex-col justify-end gap-1.5 sm:mt-5 sm:gap-2">
          {compact ? (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => !inCart && add(cartPayload)}
                disabled={inCart}
                aria-label={inCart ? "Səbətdədir" : "Səbətə əlavə et"}
                title={inCart ? "Səbətdədir" : "Səbətə əlavə et"}
                className={`inline-grid h-12 w-12 place-items-center rounded-full border shadow-lg transition ${
                  inCart
                    ? "border-emerald-400/35 bg-emerald-500/20 text-emerald-200"
                    : "border-violet-400/35 bg-violet-600 text-white shadow-violet-500/25 hover:bg-violet-500"
                }`}
              >
                {inCart ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => !giftInCart && addGift(cartPayload, undefined, giftDiscountEndAt)}
                disabled={giftInCart}
                aria-label={giftInCart ? "Hədiyyə kimi səbətdədir" : "Dostuna hədiyyə et"}
                title={giftInCart ? "Hədiyyə kimi səbətdədir" : "Dostuna hədiyyə et"}
                className={`inline-grid h-12 w-12 place-items-center rounded-full border shadow-lg transition ${
                  giftInCart
                    ? "border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200"
                    : "border-fuchsia-400/35 bg-zinc-900 text-fuchsia-300 hover:bg-fuchsia-500/20"
                }`}
              >
                <Gift className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              {/* Səbət + Hədiyyə düymələri yan-yana. Müştəri eyni oyunu HƏM özünə
                  ala, HƏM dostuna hədiyyə edə bilər — iki düymə müstəqil işləyir. */}
              <div className="flex items-stretch gap-2">
                {inCart ? (
                  <button
                    type="button"
                    onClick={() => remove(game.id)}
                    title="Səbətdən sil"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="truncate">Səbətdə</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => add(cartPayload)}
                    title="Səbətə əlavə et"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#6D28D9] px-2 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 transition-all duration-200 hover:bg-[#5B21B6] sm:gap-2 sm:px-3 sm:py-3 sm:text-sm"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="truncate">Səbətə</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    giftInCart ? remove(game.id, true) : addGift(cartPayload, undefined, giftDiscountEndAt)
                  }
                  title={giftInCart ? "Hədiyyədən sil" : "Dostuna hədiyyə et"}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3 sm:py-3 sm:text-sm ${
                    giftInCart
                      ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200 hover:bg-fuchsia-500/25"
                      : "border-fuchsia-500/30 bg-transparent text-fuchsia-300 hover:bg-fuchsia-500/10"
                  }`}
                >
                  <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="truncate">Hədiyyə</span>
                </button>
              </div>

              {/* Endirimli məhsul hədiyyə edilibsə müştərini xəbərdar edirik:
                  dost endirim müddətində aktivləşdirməlidir, əks halda yalnız
                  ödənilən (endirimli) məbləğ qədər hədiyyə dəyəri keçərli olur. */}
              {giftInCart && isDiscounted && (
                <p className="mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-left text-[10px] font-medium leading-snug text-amber-300 sm:text-[11px]">
                  ⚠️ Endirimli hədiyyə: dostunuz endirim müddətində aktivləşdirməlidir.
                  Gec aktivləşdirsə, yalnız ödədiyiniz {game.finalAzn.toFixed(2)}₼ məbləğ qədər
                  hədiyyə dəyəri keçərli olacaq.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
