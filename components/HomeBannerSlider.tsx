"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/lib/cart";

export type BannerCartGame = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  productType: string;
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

export default function HomeBannerSlider({ banners }: { banners: BannerSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const cart = useCart();

  const prev = useCallback(() => setCurrent((c) => (c - 1 + banners.length) % banners.length), [banners.length]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % banners.length), [banners.length]);

  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [banners.length, paused, next]);

  // Touch swipe — mobildə əl ilə slide-ları çevirməyə imkan ver.
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

  if (banners.length === 0) return null;

  const banner = banners[current];
  const isCart = banner.actionType === "ADD_TO_CART" && banner.game;
  const inCart = isCart ? cart.has(banner.game!.id) : false;
  const linkHref = !isCart && banner.linkUrl ? banner.linkUrl : null;

  return (
    <div
      className="group relative w-full overflow-hidden rounded-2xl aspect-[4/5] sm:aspect-[16/8] lg:aspect-[21/7]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {banners.map((b, i) => (
        <div
          key={b.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          {/* Mobil variant — mobileImageUrl varsa onu, yoxsa desktop şəklini istifadə edir. */}
          <div className="absolute inset-0 sm:hidden">
            <Image
              src={b.mobileImageUrl ?? b.imageUrl}
              alt={b.title ?? "Banner"}
              fill
              sizes="100vw"
              className="object-cover object-center"
              priority={i === 0}
            />
          </div>
          {/* Desktop / tablet variant. */}
          <div className="absolute inset-0 hidden sm:block">
            <Image
              src={b.imageUrl}
              alt={b.title ?? "Banner"}
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover object-center"
              priority={i === 0}
            />
          </div>
          {/* Mobildə şaquli gradient (mətn aşağıda), desktopda yan gradient. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent sm:bg-gradient-to-r sm:from-black/70 sm:via-black/25 sm:to-transparent" />
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0 p-5 pb-12 sm:right-auto sm:p-8 sm:pb-8 lg:p-10">
        {linkHref ? (
          <Link href={linkHref} className="block">
            {banner.title && (
              <h2 className="text-2xl font-black leading-tight text-white drop-shadow sm:text-3xl lg:text-4xl">{banner.title}</h2>
            )}
            {banner.subtitle && (
              <p className="mt-2 text-sm leading-snug text-zinc-200 drop-shadow sm:text-base">{banner.subtitle}</p>
            )}
            <span className="mt-4 inline-flex w-full justify-center rounded-lg bg-white px-5 py-3 text-sm font-bold text-zinc-900 shadow-lg transition hover:bg-zinc-100 sm:w-auto">
              Kəşfet →
            </span>
          </Link>
        ) : (
          <>
            {banner.title && (
              <h2 className="text-2xl font-black leading-tight text-white drop-shadow sm:text-3xl lg:text-4xl">{banner.title}</h2>
            )}
            {banner.subtitle && (
              <p className="mt-2 text-sm leading-snug text-zinc-200 drop-shadow sm:text-base">{banner.subtitle}</p>
            )}
            {isCart && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (inCart) cart.remove(banner.game!.id);
                  else cart.add(banner.game!);
                }}
                className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white shadow-lg transition sm:w-auto ${
                  inCart ? "bg-emerald-500 hover:bg-emerald-600" : "bg-indigo-500 hover:bg-indigo-600"
                }`}
              >
                {inCart ? <><Check className="h-4 w-4" /> Səbətdədir</> : <><ShoppingCart className="h-4 w-4" /> Səbətə əlavə et · {banner.game!.finalAzn.toFixed(2)} ₼</>}
              </button>
            )}
          </>
        )}
      </div>

      {banners.length > 1 && (
        <>
          {/* Mobildə həmişə görünür (touch); desktopda hover-də görünür. */}
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

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
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
  );
}
