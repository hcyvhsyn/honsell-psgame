"use client";

import { useRef } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Package, ShoppingCart } from "lucide-react";
import ProductImage from "./ProductImage";
import { useCart } from "@/lib/cart";
import {
  buildBundleCartPayload,
  formatAznCents,
  type BundleCardData,
} from "@/lib/gameBundleShared";

/**
 * "Sərfəli paketlər" — admin panelindən (`/admin/bundles`) kürasiya olunan oyun
 * dəstləri. Kart bir toxunuşla paketi səbətə ATOMİK tək sətir kimi atır;
 * qiymət serverdə hesablanıb bura hazır gəlir (`lib/gameBundles.ts`).
 *
 * Kolleksiyadan fərqi: kolleksiya redaksiya siyahısıdır, paket isə satılan
 * vahiddir — ona görə kartda cəm, qənaət və "səbətə at" düyməsi var.
 */
export default function HomeBundles({ bundles }: { bundles: BundleCardData[] }) {
  const scrollRef = useRef<HTMLUListElement>(null);

  if (bundles.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <section id="paketler" className="py-10 sm:py-12">
      <div className="site-container">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-700 p-4 shadow-xl shadow-emerald-900/20 dark:from-[#06371F] dark:via-[#053B3B] dark:to-[#04304A] sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl" />

          <div className="relative mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-white sm:text-xl">
              <Package className="h-5 w-5 shrink-0 text-amber-300" />
              Sərfəli paketlər
            </h2>
            <p className="text-sm font-medium text-white/70">
              Bir neçə oyun — bir qiymətə
            </p>

            <div className="ml-auto hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                aria-label="Geri sürüşdür"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                aria-label="İrəli sürüşdür"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <ul
            ref={scrollRef}
            className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:w-[80%] [&>li]:min-w-[240px] [&>li]:shrink-0 [&>li]:snap-start sm:gap-4 sm:[&>li]:w-[300px] sm:[&>li]:min-w-[280px]"
          >
            {bundles.map((b) => (
              <BundleTile key={b.id} bundle={b} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Öz kaveri olmayan paket üçün tərkib oyunlarının kaverlərindən kollaj.
 * 1 oyun → tam şəkil, 2 → yanaşı, 3+ → 2×2 tor (4-dən çoxu kəsilir).
 */
function BundleCover({ bundle }: { bundle: BundleCardData }) {
  const covers = bundle.pricing.items
    .map((i) => i.imageUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 4);

  if (bundle.imageUrl || covers.length === 0) {
    return (
      <ProductImage
        src={bundle.imageUrl}
        alt={bundle.title}
        sizes="(max-width: 640px) 80vw, 300px"
        className="object-cover transition duration-500 group-hover:scale-[1.04]"
      />
    );
  }

  if (covers.length === 1) {
    return (
      <ProductImage
        src={covers[0]}
        alt={bundle.title}
        sizes="(max-width: 640px) 80vw, 300px"
        className="object-cover transition duration-500 group-hover:scale-[1.04]"
      />
    );
  }

  return (
    <div
      className={`grid h-full w-full gap-0.5 ${covers.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2"}`}
    >
      {covers.map((src, i) => (
        <div key={i} className="relative overflow-hidden bg-zinc-200 dark:bg-zinc-800">
          <ProductImage
            src={src}
            alt=""
            sizes="150px"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        </div>
      ))}
    </div>
  );
}

function BundleTile({ bundle }: { bundle: BundleCardData }) {
  const { add, has, hydrated } = useCart();
  const inCart = hydrated && has(bundle.id);
  const { pricing } = bundle;

  return (
    <li className="group flex flex-col overflow-hidden rounded-[22px] border border-zinc-200 bg-white p-2.5 shadow-lg shadow-emerald-950/10 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#0A1A18] sm:p-3">
      <Link href={`/paket/${bundle.slug}`} aria-label={bundle.title}>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
          <BundleCover bundle={bundle} />
          {bundle.badgeText && (
            <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-amber-950 shadow-sm">
              {bundle.badgeText}
            </span>
          )}
          {pricing.discountPct > 0 && (
            <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-1 text-[11px] font-black text-white shadow-sm">
              -{pricing.discountPct}%
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <Link
          href={`/paket/${bundle.slug}`}
          className="line-clamp-2 min-h-[2.6em] text-sm font-black leading-tight text-zinc-950 transition hover:text-emerald-600 dark:text-white dark:hover:text-emerald-300"
        >
          {bundle.title}
        </Link>
        <p className="mt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
          {bundle.subtitle || `${pricing.items.length} oyun`}
        </p>

        <ul className="mt-2 space-y-0.5">
          {pricing.items.slice(0, 3).map((i) => (
            <li
              key={i.gameId}
              className="flex items-center gap-1.5 truncate text-[11px] text-zinc-600 dark:text-zinc-400"
            >
              <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">{i.title}</span>
            </li>
          ))}
          {pricing.items.length > 3 && (
            <li className="pl-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              +{pricing.items.length - 3} oyun daha
            </li>
          )}
        </ul>

        <div className="mt-auto pt-3">
          <div className="rounded-2xl bg-zinc-100/80 p-2.5 dark:bg-white/[0.05]">
            {pricing.savingsAznCents > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-zinc-500 line-through tabular-nums dark:text-zinc-400">
                  {formatAznCents(pricing.listTotalAznCents)}
                </span>
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {formatAznCents(pricing.savingsAznCents)} qənaət
                </span>
              </div>
            )}
            <div className="mt-0.5 text-xl font-black tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
              {formatAznCents(pricing.totalAznCents)}
            </div>

            <button
              type="button"
              onClick={() => !inCart && add(buildBundleCartPayload(bundle))}
              disabled={inCart}
              className={`mt-2.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
                inCart
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }`}
            >
              {inCart ? (
                <>
                  <Check className="h-4 w-4" /> Səbətdə
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" /> Paketi al
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
