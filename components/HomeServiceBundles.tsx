"use client";

import { useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Layers, ShoppingCart } from "lucide-react";
import ProductImage from "./ProductImage";
import { useCart } from "@/lib/cart";
import {
  buildServiceBundleCartPayload,
  formatAznCents,
  type ServiceBundleCardData,
} from "@/lib/serviceBundleShared";

/**
 * "Sərfəli xidmət dəstləri" — admin panelindən (`/admin/service-bundles`) qurulan
 * abunəlik dəstləri (Netflix + HBO Max, Prime Video + Spotify …).
 *
 * ⚠️ Oyun paketindən fərqli olaraq DETAL SƏHİFƏSİ YOXDUR: kart birbaşa səbətə atır,
 * müştəri məlumatları (Spotify hesabları, YouTube gmail-i və s.) səbətdəki
 * "Redaktə" düyməsindən toplanır. Ona görə burada `Link` deyil, yalnız düymə var.
 */
export default function HomeServiceBundles({
  bundles,
}: {
  bundles: ServiceBundleCardData[];
}) {
  const scrollRef = useRef<HTMLUListElement>(null);

  if (bundles.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <section id="xidmet-destleri" className="py-10 sm:py-12">
      <div className="site-container">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-600 via-fuchsia-700 to-rose-700 p-4 shadow-xl shadow-fuchsia-900/20 dark:from-[#26103F] dark:via-[#3A0B38] dark:to-[#3D0B22] sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-fuchsia-300/15 blur-3xl" />

          <div className="relative mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-white sm:text-xl">
              <Layers className="h-5 w-5 shrink-0 text-amber-300" />
              Sərfəli xidmət dəstləri
            </h2>
            <p className="text-sm font-medium text-white/70">
              Bir neçə abunəlik — bir qiymətə
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
              <ServiceBundleTile key={b.id} bundle={b} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Öz şəkli olmayan dəst üçün üzv xidmətlərin şəkillərindən kollaj.
 * 1 xidmət → tam şəkil, 2 → yanaşı, 3+ → 2×2 tor (4-dən çoxu kəsilir).
 */
function ServiceBundleCover({ bundle }: { bundle: ServiceBundleCardData }) {
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

function ServiceBundleTile({ bundle }: { bundle: ServiceBundleCardData }) {
  const { add, has, hydrated } = useCart();
  const inCart = hydrated && has(bundle.id);
  const { pricing } = bundle;
  // Dəstdə müştəri məlumatı tələb edən xidmət varsa müştəri bunu ƏVVƏLCƏDƏN bilsin
  // — səbətə atandan sonra "Redaktə" gözləyəcək.
  const needsInput = pricing.items.some((i) => i.requirement.kind !== "NONE");

  return (
    <li className="group flex flex-col overflow-hidden rounded-[22px] border border-zinc-200 bg-white p-2.5 shadow-lg shadow-fuchsia-950/10 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#170A1F] sm:p-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
        <ServiceBundleCover bundle={bundle} />
        {bundle.badgeText && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-amber-950 shadow-sm">
            {bundle.badgeText}
          </span>
        )}
        {pricing.discountPct > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-fuchsia-500 px-2 py-1 text-[11px] font-black text-white shadow-sm">
            -{pricing.discountPct}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <p className="line-clamp-2 min-h-[2.6em] text-sm font-black leading-tight text-zinc-950 dark:text-white">
          {bundle.title}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
          {bundle.subtitle || `${pricing.items.length} xidmət`}
        </p>

        <ul className="mt-2 space-y-0.5">
          {pricing.items.slice(0, 3).map((i) => (
            <li
              key={i.serviceProductId}
              className="flex items-center gap-1.5 truncate text-[11px] text-zinc-600 dark:text-zinc-400"
            >
              <span className="h-1 w-1 shrink-0 rounded-full bg-fuchsia-500" />
              <span className="truncate">{i.title}</span>
            </li>
          ))}
          {pricing.items.length > 3 && (
            <li className="pl-2.5 text-[11px] font-semibold text-fuchsia-600 dark:text-fuchsia-400">
              +{pricing.items.length - 3} xidmət daha
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
                <span className="rounded-md bg-fuchsia-500/15 px-1.5 py-0.5 text-[11px] font-bold text-fuchsia-700 dark:text-fuchsia-300">
                  {formatAznCents(pricing.savingsAznCents)} qənaət
                </span>
              </div>
            )}
            <div className="mt-0.5 text-xl font-black tracking-tight text-fuchsia-600 tabular-nums dark:text-fuchsia-400">
              {formatAznCents(pricing.totalAznCents)}
            </div>

            <button
              type="button"
              onClick={() => !inCart && add(buildServiceBundleCartPayload(bundle))}
              disabled={inCart}
              className={`mt-2.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
                inCart
                  ? "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300"
                  : "bg-fuchsia-600 text-white hover:bg-fuchsia-500"
              }`}
            >
              {inCart ? (
                <>
                  <Check className="h-4 w-4" /> Səbətdə
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" /> Dəsti al
                </>
              )}
            </button>
            {needsInput && (
              <p className="mt-1.5 text-center text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                Səbətdə hesab məlumatları soruşulacaq
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
