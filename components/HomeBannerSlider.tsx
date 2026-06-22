"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { cdnImageUrl } from "@/lib/cdnImage";
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Heart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { bannerContentWrapClass, bannerThemeClasses } from "@/components/bannerLayout";

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

// Oyun olmayan səbət-banneri (streaming, platform, PS Plus, EA Play,
// hədiyyə kartı...). Favorit/platforma/detal linki kimi oyuna xas sahələr yoxdur.
export type BannerCartService = {
  id: string;
  title: string;
  imageUrl: string | null;
  productType: string;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
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
  service: BannerCartService | null;
  contentPosition: string;
  contentPositionMobile: string;
  contentTheme: string;
};

// Banner-in səbətə əlavə olunan məhsulu — oyun və ya xidmət — üçün vahid forma.
type BannerCartProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  productType: string;
};

function bannerProduct(b: BannerSlide): BannerCartProduct | null {
  if (b.game) {
    return {
      id: b.game.id,
      title: b.game.title,
      imageUrl: b.game.imageUrl,
      finalAzn: b.game.finalAzn,
      originalAzn: b.game.originalAzn,
      discountPct: b.game.discountPct,
      productType: b.game.productType,
    };
  }
  if (b.service) return { ...b.service };
  return null;
}

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
  return b.game?.imageUrl || b.game?.heroImageUrl || b.service?.imageUrl || b.imageUrl;
}

function bannerHeroSrc(b: BannerSlide): string {
  return b.game?.heroImageUrl || b.imageUrl || b.game?.imageUrl || b.service?.imageUrl || "";
}

function bannerTitle(b: BannerSlide): string {
  return b.title?.trim() || b.game?.title || b.service?.title || "";
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
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
  const product = bannerProduct(banner);
  const isCartAction = banner.actionType === "ADD_TO_CART" && !!product;
  const inCart = isCartAction && product ? cart.has(product.id) : false;
  const isFav = game ? favorites.hydrated && favorites.has(game.id) : false;
  const platforms = game?.platform ? game.platform.split(",") : [];
  const linkHref = !isCartAction && banner.linkUrl ? banner.linkUrl : null;
  const detailHref = game?.productId ? `/oyunlar/${game.productId}` : null;
  const title = bannerTitle(banner);
  const subtitle = banner.subtitle?.trim() || null;
  const theme = bannerThemeClasses(banner.contentTheme);
  const wrapClass = bannerContentWrapClass(banner.contentPosition, banner.contentPositionMobile);

  return (
    <div
      className="grid w-full items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_280px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Hero */}
      <div
        className="media-hero group relative w-full overflow-hidden rounded-2xl aspect-[4/5] max-sm:max-h-[85svh] max-sm:landscape:aspect-[16/9] max-sm:landscape:max-h-[80svh] sm:aspect-[16/8] lg:h-full lg:min-h-[500px] lg:aspect-auto xl:min-h-[540px]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {banners.map((b, i) => {
          const bProduct = bannerProduct(b);
          const bDesktop = bannerHeroSrc(b);
          const bMobile = b.mobileImageUrl ?? bDesktop;
          const bTitle = bannerTitle(b);
          return (
            <div
              key={b.id}
              className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${i === current ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <div className="absolute inset-0 sm:hidden">
                {bMobile && (
                  <Image
                    src={cdnImageUrl(bMobile)}
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
                    src={cdnImageUrl(bDesktop)}
                    alt={bTitle || "Banner"}
                    fill
                    sizes="(max-width: 1280px) 100vw, 1000px"
                    className="object-cover object-center"
                    priority={i === 0}
                  />
                )}
              </div>
              <div className={`media-hero-overlay absolute inset-0 ${bannerThemeClasses(b.contentTheme).gradient}`} />
              {bProduct?.discountPct != null && (
                <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
                  <span className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-rose-500 via-orange-400 to-amber-300 px-4 py-2 text-white shadow-[0_18px_42px_-16px_rgba(251,113,133,0.95)] ring-2 ring-white/35">
                    <span className="text-[10px] font-black uppercase leading-none tracking-[0.18em] text-white/85">
                      Endirim
                    </span>
                    <span className="mt-0.5 text-xl font-black leading-none tracking-tight">
                      -%{bProduct.discountPct}
                    </span>
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Content overlay (only for current banner) */}
        <div className={wrapClass}>
          <div className="flex flex-wrap items-center gap-2">
            {game && (
              <p className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur-md ${theme.chip}`}>
                İndi mağazada
              </p>
            )}

            {platforms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {platforms.map((p) => (
                  <span
                    key={p}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur-md ${theme.platformChip}`}
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          {title && (
            detailHref ? (
              <Link href={detailHref} className="block">
                <h2 className={`mt-3 max-w-[16ch] text-[clamp(1.5rem,6vw,1.875rem)] font-black leading-[1.05] sm:max-w-[12ch] sm:text-4xl lg:max-w-[15ch] lg:text-[44px] xl:text-5xl ${theme.title}`}>
                  {title}
                </h2>
              </Link>
            ) : linkHref ? (
              <Link href={linkHref} className="block">
                <h2 className={`mt-3 max-w-[16ch] text-[clamp(1.5rem,6vw,1.875rem)] font-black leading-[1.05] sm:max-w-[12ch] sm:text-4xl lg:max-w-[15ch] lg:text-[44px] xl:text-5xl ${theme.title}`}>
                  {title}
                </h2>
              </Link>
            ) : (
              <h2 className={`mt-3 max-w-[16ch] text-[clamp(1.5rem,6vw,1.875rem)] font-black leading-[1.05] sm:max-w-[12ch] sm:text-4xl lg:max-w-[15ch] lg:text-[44px] xl:text-5xl ${theme.title}`}>
                {title}
              </h2>
            )
          )}

          {subtitle && (
            <p className={`mt-3 max-w-md text-sm leading-snug sm:text-base ${theme.subtitle}`}>{subtitle}</p>
          )}

          {/* Price */}
          {(product || countdownText) && (
            <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-2">
              {product && (
                <div className="flex items-baseline gap-3">
                  {product.originalAzn != null && (
                    <span className={`relative text-base font-medium sm:text-lg ${theme.priceOriginal}`}>
                      {product.originalAzn.toFixed(2)}₼
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 -rotate-6 bg-rose-500"
                      />
                    </span>
                  )}
                  <span className={`text-2xl font-extrabold sm:text-3xl ${theme.priceFinal}`}>
                    {product.finalAzn.toFixed(2)}₼
                  </span>
                </div>
              )}

              {countdownText && (
                <p className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-md sm:text-sm">
                  Bitir: <span className="font-bold tabular-nums text-cyan-200">{countdownText}</span>
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {isCartAction ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (!product) return;
                  if (inCart) cart.remove(product.id);
                  else cart.add({
                    id: product.id,
                    title: product.title,
                    imageUrl: product.imageUrl,
                    finalAzn: product.finalAzn,
                    productType: product.productType,
                  });
                }}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 ${
                  inCart
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "bg-white text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {inCart ? (
                  <><Check className="h-4 w-4" /> Səbətdədir</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> Səbətə Əlavə Et</>
                )}
              </button>
            ) : linkHref ? (
              <Link
                href={linkHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-zinc-900 shadow-lg transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
              >
                Kəşfet →
              </Link>
            ) : null}

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
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 ${
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
              className="absolute left-2 top-[38%] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 sm:left-3 sm:top-1/2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Növbəti banner"
              onClick={next}
              className="absolute right-2 top-[38%] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 sm:right-3 sm:top-1/2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 lg:hidden">
              {banners.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Banner ${i + 1}`}
                  aria-current={i === current ? "true" : undefined}
                  onClick={() => setCurrent(i)}
                  className="group/dot flex h-9 items-center justify-center px-1.5 focus-visible:outline-none"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-white group-focus-visible/dot:ring-offset-2 group-focus-visible/dot:ring-offset-black/40 ${i === current ? "w-6 bg-white" : "w-1.5 bg-white/40 group-hover/dot:bg-white/70"}`}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right side vertical list (desktop only) */}
      {banners.length > 1 && (
        <ul
          className="hidden flex-col gap-2 overflow-y-auto pr-1 lg:flex"
          style={{ maxHeight: "472px" }}
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
                  aria-current={active ? "true" : undefined}
                  className={`group/item flex w-full items-center gap-3 rounded-xl p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 ${
                    active
                      ? "bg-white ring-1 ring-zinc-200 shadow-sm dark:bg-white/10 dark:ring-white/15 dark:shadow-none"
                      : "hover:bg-white/70 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                    {thumb && (
                      <Image
                        src={cdnImageUrl(thumb)}
                        alt={t || "Banner"}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <span
                    className={`line-clamp-2 text-sm font-medium leading-tight ${
                      active
                        ? "text-zinc-950 dark:text-white"
                        : "text-zinc-600 group-hover/item:text-zinc-950 dark:text-zinc-300 dark:group-hover/item:text-white"
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
