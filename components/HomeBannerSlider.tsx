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

  if (banners.length === 0) return null;

  const banner = banners[current];
  const isCart = banner.actionType === "ADD_TO_CART" && banner.game;
  const inCart = isCart ? cart.has(banner.game!.id) : false;
  const linkHref = !isCart && banner.linkUrl ? banner.linkUrl : null;

  return (
    <div
      className="group relative w-full overflow-hidden rounded-2xl"
      style={{ aspectRatio: "21/7" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {banners.map((b, i) => (
        <div
          key={b.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <Image
            src={b.imageUrl}
            alt={b.title ?? "Banner"}
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
            unoptimized
            priority={i === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
        </div>
      ))}

      <div className="absolute bottom-0 left-0 p-6 sm:p-10">
        {linkHref ? (
          <Link href={linkHref} className="block">
            {banner.title && (
              <h2 className="text-xl font-black text-white drop-shadow sm:text-3xl lg:text-4xl">{banner.title}</h2>
            )}
            {banner.subtitle && (
              <p className="mt-1 text-sm text-zinc-200 drop-shadow sm:text-base">{banner.subtitle}</p>
            )}
            <span className="mt-4 inline-block rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/30">
              Kəşfet →
            </span>
          </Link>
        ) : (
          <>
            {banner.title && (
              <h2 className="text-xl font-black text-white drop-shadow sm:text-3xl lg:text-4xl">{banner.title}</h2>
            )}
            {banner.subtitle && (
              <p className="mt-1 text-sm text-zinc-200 drop-shadow sm:text-base">{banner.subtitle}</p>
            )}
            {isCart && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (inCart) cart.remove(banner.game!.id);
                  else cart.add(banner.game!);
                }}
                className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition ${
                  inCart ? "bg-emerald-500/80 hover:bg-emerald-500" : "bg-indigo-500/80 hover:bg-indigo-500"
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
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
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
