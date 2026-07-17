// Route-level Suspense fallback for /oyunlar. Səhifə server-render (DB sorğuları)
// bitənə qədər Next.js bunu dərhal göstərir — əvvəl fallback olmadığı üçün naviqasiya
// zamanı ekran boş/qara qalırdı. Real SiteHeaderServer / GameBrowser burada çağırılmır,
// çünki onlar da data çəkir; bu yalnız statik skeleton-dur, ölçüləri əsl layout-la uyğun.
export default function OyunlarLoading() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header placeholder — real header hündürlüyünü təxminən saxlayır ki, sıçrayış olmasın */}
      <div className="h-16 w-full border-b border-zinc-200/70 bg-white/60 dark:border-white/5 dark:bg-zinc-950/60" />

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 mt-12">
        {/* Filter/axtarış paneli skeleton-u */}
        <div className="mb-3 rounded-[18px] border border-violet-200 bg-white/70 p-2 dark:border-violet-300/25 dark:bg-zinc-900/40 sm:mb-5 sm:rounded-[22px] sm:p-3">
          <div className="flex flex-col gap-2 sm:gap-3">
            {/* Tip pill-ləri */}
            <div className="-mx-1 flex gap-2 overflow-hidden px-1 pb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-24 shrink-0 animate-pulse rounded-xl bg-zinc-200/70 dark:bg-white/[0.06] sm:h-11 sm:w-28 sm:rounded-2xl"
                />
              ))}
            </div>
            {/* Axtarış + filter düyməsi */}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="h-10 animate-pulse rounded-xl bg-zinc-200/70 dark:bg-white/[0.06] sm:h-11 sm:rounded-2xl" />
              <div className="h-10 w-20 animate-pulse rounded-xl bg-zinc-200/70 dark:bg-white/[0.06] sm:h-11 sm:w-28 sm:rounded-2xl" />
            </div>
          </div>
        </div>

        {/* Kart şəbəkəsi skeleton-u */}
        <ul
          aria-hidden
          className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <li
              key={i}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="aspect-square w-full animate-pulse bg-zinc-200/70 dark:bg-zinc-800/60" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                <div className="h-7 w-1/2 animate-pulse rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
                <div className="h-9 w-full animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
