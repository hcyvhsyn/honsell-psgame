"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Clock, ShoppingCart, Zap } from "lucide-react";
import ProductImage from "./ProductImage";
import { useCart } from "@/lib/cart";

/**
 * "Fürsətləri qaçırma" — admin panelindən əl ilə kürasiya olunan kampaniya
 * karuseli (`/admin/flash-deals`). Endirim karuselindən fərqi: burada nə
 * göstəriləcəyini scraper deyil, admin seçir və qiymət/bitmə vaxtı əl ilə
 * override oluna bilər.
 *
 * Vaxt: bütün geri sayımlar bölmə səviyyəsindəki TƏK `setInterval`-dan
 * qidalanır — hər kartda ayrıca taymer 10 karta 10 interval demək olardı.
 * Serverdə heç vaxt `Date.now()` hesablamırıq (hydration uyğunsuzluğu) —
 * ilk effekt tick-inə qədər sayğaclar boş qalır.
 */

export type FlashDealCard = {
  /** Game.id — səbət elementinin identifikatoru. */
  id: string;
  title: string;
  href: string | null;
  imageUrl: string | null;
  productType: string;
  store: string | null;
  platform: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  endsAt: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function remainingFrom(endsAt: string, now: number): Remaining | null {
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - now;
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

export default function HomeFlashDeals({ deals }: { deals: FlashDealCard[] }) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Vaxtı dolan kartlar səhifə yenilənmədən də siyahıdan çıxır.
  const visible = useMemo(
    () =>
      now === null
        ? deals
        : deals.filter((d) => !d.endsAt || remainingFrom(d.endsAt, now) !== null),
    [deals, now],
  );

  // Başlıqdakı böyük sayğac ən tez bitən təklifi sayır.
  const soonestEndsAt = useMemo(() => {
    const stamps = visible
      .map((d) => (d.endsAt ? new Date(d.endsAt).getTime() : null))
      .filter((t): t is number => t != null && !Number.isNaN(t));
    return stamps.length ? new Date(Math.min(...stamps)).toISOString() : null;
  }, [visible]);

  if (visible.length === 0) return null;

  const headerRemaining = soonestEndsAt && now !== null ? remainingFrom(soonestEndsAt, now) : null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <section id="fursetler" className="py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-700 p-4 shadow-xl shadow-violet-900/20 dark:from-[#3B1080] dark:via-[#2A0B5E] dark:to-[#43106B] sm:p-6">
          {/* Dekorativ işıq — panelin künclərini "yastı" görünməkdən çıxarır */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-3xl" />

          {/* ─── Başlıq: ad + geri sayım + hamısına bax ─────────────────────── */}
          <div className="relative mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-white sm:text-xl">
              <Zap className="h-5 w-5 shrink-0 fill-amber-300 text-amber-300" />
              Fürsətləri qaçırma
            </h2>

            {soonestEndsAt && (
              <div className="flex items-center gap-1" aria-label="Ən tez bitən təklifə qalan vaxt">
                <DigitPair value={headerRemaining?.days ?? null} />
                <Separator />
                <DigitPair value={headerRemaining?.hours ?? null} />
                <Separator />
                <DigitPair value={headerRemaining?.minutes ?? null} />
                <Separator />
                <DigitPair value={headerRemaining?.seconds ?? null} />
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 sm:flex">
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
              <Link
                href="/endirimler"
                className="text-sm font-bold text-white underline underline-offset-4 transition hover:text-amber-200"
              >
                Hamısına bax
              </Link>
            </div>
          </div>

          {/* ─── Kartlar ────────────────────────────────────────────────────── */}
          <ul
            ref={scrollRef}
            className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:w-[72%] [&>li]:min-w-[220px] [&>li]:shrink-0 [&>li]:snap-start sm:gap-4 sm:[&>li]:w-[276px] sm:[&>li]:min-w-[260px]"
          >
            {visible.map((deal) => (
              <FlashDealTile key={deal.id} deal={deal} now={now} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** İki rəqəmli dəyər — hər rəqəm ayrı qutuda (skrinşotdakı sayğac üslubu). */
function DigitPair({ value }: { value: number | null }) {
  const text = value === null ? "--" : pad(Math.min(value, 99));
  return (
    <span className="flex gap-1">
      {text.split("").map((ch, i) => (
        <span
          key={i}
          suppressHydrationWarning
          className="grid h-8 w-6 place-items-center rounded-md bg-white/20 text-sm font-black tabular-nums text-white shadow-inner sm:h-9 sm:w-7 sm:text-base"
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function Separator() {
  return <span className="px-0.5 text-sm font-black text-white/60">:</span>;
}

function FlashDealTile({ deal, now }: { deal: FlashDealCard; now: number | null }) {
  const { add, has, hydrated } = useCart();
  const inCart = hydrated && has(deal.id);
  const remaining = deal.endsAt && now !== null ? remainingFrom(deal.endsAt, now) : null;

  const cover = (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
      <ProductImage
        src={deal.imageUrl}
        alt={deal.title}
        sizes="(max-width: 640px) 72vw, 276px"
        className="object-cover transition duration-500 group-hover:scale-[1.04]"
        badge={deal.platform ?? "Oyun"}
      />
      {deal.discountPct != null && (
        <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-2 py-1 text-[11px] font-black text-white shadow-sm">
          -{deal.discountPct}%
        </span>
      )}
    </div>
  );

  return (
    <li className="group flex flex-col overflow-hidden rounded-[22px] border border-zinc-200 bg-white p-2.5 shadow-lg shadow-violet-950/10 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#150A21] sm:p-3">
      {deal.href ? (
        <Link href={deal.href} aria-label={deal.title}>
          {cover}
        </Link>
      ) : (
        cover
      )}

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        {deal.href ? (
          <Link
            href={deal.href}
            className="line-clamp-2 min-h-[2.6em] text-sm font-black leading-tight text-zinc-950 transition hover:text-violet-600 dark:text-white dark:hover:text-violet-300"
          >
            {deal.title}
          </Link>
        ) : (
          <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-black leading-tight text-zinc-950 dark:text-white">
            {deal.title}
          </h3>
        )}

        {/* Qalan vaxt — bitmə tarixi olmayan təkliflərdə göstərilmir */}
        {deal.endsAt && (
          <div className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white dark:bg-violet-500/90">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Qalan
            <span className="tabular-nums" suppressHydrationWarning>
              {remaining
                ? remaining.days > 0
                  ? `${remaining.days} GÜN ${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`
                  : `${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`
                : "--:--:--"}
            </span>
          </div>
        )}

        <div className="mt-3 rounded-2xl bg-zinc-100/80 p-2.5 dark:bg-white/[0.05]">
          <div className="flex items-baseline gap-2">
            {deal.originalAzn != null && (
              <span className="text-xs font-semibold text-zinc-500 line-through tabular-nums dark:text-zinc-400">
                {deal.originalAzn.toFixed(2)}₼
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-rose-600 tabular-nums dark:text-rose-400">
              {deal.finalAzn.toFixed(2)}₼
            </span>
            {deal.discountPct != null && (
              <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[11px] font-black text-white">
                -%{deal.discountPct}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              !inCart &&
              add({
                id: deal.id,
                title: deal.title,
                imageUrl: deal.imageUrl,
                finalAzn: deal.finalAzn,
                productType: deal.productType,
                store: deal.store === "EPIC" || deal.platform === "PC" ? "EPIC" : "PS",
              })
            }
            disabled={inCart}
            className={`mt-2.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
              inCart
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                : "bg-violet-600 text-white hover:bg-violet-500"
            }`}
          >
            {inCart ? (
              <>
                <Check className="h-4 w-4" /> Səbətdə
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" /> İndi al
              </>
            )}
          </button>
        </div>
      </div>
    </li>
  );
}
