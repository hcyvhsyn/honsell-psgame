"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Gift, Heart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";

export type BannerCartGame = {
  id: string;
  productId: string | null;
  title: string;
  imageUrl: string | null;
  heroImageUrl: string | null;
  platform: string | null;
  productType: string;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  discountEndAt: string | null;
};

export type BannerSlide = {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  actionType: "LINK" | "ADD_TO_CART";
  game: BannerCartGame | null;
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function useCountdown(iso: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  if (!iso || now === null) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - now;
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}g ${hms}` : hms;
}

function bannerThumb(b: BannerSlide): string {
  return b.game?.imageUrl || b.game?.heroImageUrl || b.imageUrl;
}

function bannerHeroSrc(b: BannerSlide): string {
  return b.game?.heroImageUrl || b.imageUrl || b.game?.imageUrl || "";
}

function bannerTitle(b: BannerSlide): string {
  return b.title?.trim() || b.game?.title || "";
}

export default function HomeBannerSlider({ banners }: { banners: BannerSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const cart = useCart();
  const favorites = useFavorites();

  const prev = useCallback(() => setCurrent((c) => (c - 1 + banners.length) % banners.length), [banners.length]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % banners.length), [banners.length]);

  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [banners.length, paused, next]);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    setTouchStartX(null);
  };

  const banner = banners[current];
  const countdownText = useCountdown(banner?.game?.discountEndAt ?? null);

  if (banners.length === 0 || !banner) return null;

  const game = banner.game;
  const isCartAction = banner.actionType === "ADD_TO_CART" && game;
  const inCart = isCartAction ? cart.has(game!.id) : false;
  const isFav = game ? favorites.hydrated && favorites.has(game.id) : false;
  const platforms = game?.platform ? game.platform.split(",") : [];
  const linkHref = !isCartAction && banner.linkUrl ? banner.linkUrl : null;
  const detailHref = game?.productId ? `/oyunlar/${game.productId}` : null;
  const title = bannerTitle(banner);
  const subtitle = banner.subtitle?.trim() || null;

  return (
    <div
      className="grid w-full gap-3 lg:grid-cols-[minmax(0,1fr)_280px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Hero */}
      <div
        className="group relative w-full overflow-hidden rounded-2xl aspect-[4/5] sm:aspect-[16/8] lg:aspect-[21/9]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {banners.map((b, i) => {
          const bGame = b.game;
          const bDesktop = bannerHeroSrc(b);
          const bMobile = b.mobileImageUrl ?? bDesktop;
          const bTitle = bannerTitle(b);
          return (
            <div
              key={b.id}
              className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <div className="absolute inset-0 sm:hidden">
                {bMobile && (
                  <Image
                    src={bMobile}
                    alt={bTitle || "Banner"}
                    fill
                    sizes="100vw"
                    className="object-cover object-center"
                    priority={i === 0}
                  />
                )}
              </div>
              <div className="absolute inset-0 hidden sm:block">
                {bDesktop && (
                  <Image
                    src={bDesktop}
                    alt={bTitle || "Banner"}
                    fill
                    sizes="(max-width: 1280px) 100vw, 1000px"
                    className="object-cover object-center"
                    priority={i === 0}
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent sm:bg-gradient-to-r sm:from-black/85 sm:via-black/35 sm:to-transparent" />
              {bGame?.discountPct != null && (
                <div className="absolute right-4 top-4 sm:left-4 sm:right-auto">
                  <span className="inline-flex items-center rounded-full bg-[#22d3ee] px-3 py-1 text-sm font-bold text-zinc-900 shadow-lg">
                    -%{bGame.discountPct}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Content overlay (only for current banner) */}
        <div className="absolute inset-x-0 bottom-0 p-5 pb-12 sm:bottom-0 sm:right-auto sm:max-w-[60%] sm:p-8 sm:pb-10 lg:p-10 lg:pb-12">
          {title && (
            detailHref ? (
              <Link href={detailHref} className="block">
                <h2 className="text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-3xl lg:text-5xl">
                  {title}
                </h2>
              </Link>
            ) : linkHref ? (
              <Link href={linkHref} className="block">
                <h2 className="text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-3xl lg:text-5xl">
                  {title}
                </h2>
              </Link>
            ) : (
              <h2 className="text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-3xl lg:text-5xl">
                {title}
              </h2>
            )
          )}

          {platforms.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {platforms.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-white/40 bg-black/30 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {subtitle ? (
            <p className="mt-3 max-w-xl text-sm leading-snug text-zinc-200 drop-shadow sm:text-base">{subtitle}</p>
          ) : (
            game && (
              <p className="mt-3 text-xs uppercase tracking-widest text-zinc-300 drop-shadow sm:text-sm">
                İndi mağazada
              </p>
            )
          )}

          {/* Price */}
          {game && (
            <div className="mt-4 flex items-baseline gap-3">
              {game.originalAzn != null && (
                <span className="relative text-base font-medium text-zinc-300 sm:text-lg">
                  {game.originalAzn.toFixed(2)}₼
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 -rotate-6 bg-rose-500"
                  />
                </span>
              )}
              <span className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {game.finalAzn.toFixed(2)}₼
              </span>
            </div>
          )}

          {countdownText && (
            <p className="mt-1 text-xs text-zinc-300 sm:text-sm">
              Kampaniyanın bitişinə: <span className="font-semibold tabular-nums text-cyan-300">{countdownText}</span>
            </p>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {isCartAction ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (inCart) cart.remove(game!.id);
                  else cart.add({
                    id: game!.id,
                    title: game!.title,
                    imageUrl: game!.imageUrl,
                    finalAzn: game!.finalAzn,
                    productType: game!.productType,
                  });
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg transition ${
                  inCart
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "bg-white text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {inCart ? (
                  <><Check className="h-4 w-4" /> Səbətdədir</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> Hemen Satın Al</>
                )}
              </button>
            ) : linkHref ? (
              <Link
                href={linkHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-zinc-900 shadow-lg transition hover:bg-zinc-100"
              >
                Kəşfet →
              </Link>
            ) : null}

            <Link
              href="/hediyye-kartlari"
              aria-label="Hədiyyə kartları"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md ring-1 ring-white/25 transition hover:bg-white/25"
            >
              <Gift className="h-4 w-4" />
            </Link>

            {game && (
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  const nowFav = await favorites.toggle(game.id);
                  if (nowFav && favorites.consumeIntroPopup()) {
                    window.dispatchEvent(new CustomEvent("honsell:favorite-intro"));
                  }
                }}
                aria-label={isFav ? "Favorilərdən sil" : "Favorilərə əlavə et"}
                aria-pressed={isFav}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md ring-1 transition ${
                  isFav
                    ? "bg-rose-500/25 text-rose-200 ring-rose-400/40 hover:bg-rose-500/35"
                    : "bg-white/15 text-white ring-white/25 hover:bg-white/25"
                }`}
              >
                <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
              </button>
            )}
          </div>
        </div>

        {banners.length > 1 && (
          <>
            <button
              aria-label="Əvvəlki banner"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:left-3 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Növbəti banner"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 sm:right-3 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 lg:hidden">
              {banners.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Banner ${i + 1}`}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right side vertical list (desktop only) */}
      {banners.length > 1 && (
        <ul
          className="hidden flex-col gap-2 overflow-y-auto pr-1 lg:flex"
          style={{ maxHeight: "100%" }}
        >
          {banners.map((b, i) => {
            const active = i === current;
            const t = bannerTitle(b);
            const thumb = bannerThumb(b);
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(i)}
                  onMouseEnter={() => setPaused(true)}
                  className={`group/item flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                    active
                      ? "bg-white/10 ring-1 ring-white/15"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                    {thumb && (
                      <Image
                        src={thumb}
                        alt={t || "Banner"}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <span
                    className={`line-clamp-2 text-sm font-medium leading-tight ${
                      active ? "text-white" : "text-zinc-300 group-hover/item:text-white"
                    }`}
                  >
                    {t || "Banner"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
