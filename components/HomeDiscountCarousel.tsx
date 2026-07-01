"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import CompactGameCard from "./CompactGameCard";
import { type GameCardData } from "./GameCard";

/**
 * Anasayfada endirimli oyunların üfüqi karuseli. Data `/endirimler`
 * səhifəsi ilə eyni mənbədəndir (endirim faizinə görə sıralı), amma burada
 * yalnız ən güclü təkliflər göstərilir + countdown ilə aciliyyat yaradılır.
 */
export default function HomeDiscountCarousel({ games }: { games: GameCardData[] }) {
  const scrollRef = useRef<HTMLUListElement>(null);

  if (games.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <section id="endirimler" className="bg-white py-12 dark:bg-[#07070C] sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-end">
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                aria-label="Geri sürüşdür"
                className="grid h-10 w-10 place-items-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/[0.1]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                aria-label="İrəli sürüşdür"
                className="grid h-10 w-10 place-items-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/[0.1]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <Link
              href="/endirimler"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 dark:border-white/10 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Hamısına bax
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <ul
          ref={scrollRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:w-[44%] [&>li]:min-w-[150px] [&>li]:shrink-0 [&>li]:snap-start sm:mx-0 sm:px-0 sm:[&>li]:w-[260px] sm:[&>li]:min-w-[240px]"
        >
          {games.map((game) => (
            // Yüngül kart (1 şəkil, az ikon) — əvvəlki GameCard hər kartda 2 şəkil
            // (blur+sharp), countdown, gift, referral badge, platform tooltip-ləri
            // render edib HTML-i şişirdirdi. CompactGameCard image+ad+qiymət+badge+
            // səbət düyməsini saxlayır, qalanını atır → xeyli kiçik HTML.
            <CompactGameCard key={game.id} game={game} />
          ))}
        </ul>
      </div>
    </section>
  );
}
