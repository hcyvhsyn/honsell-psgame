import Link from "next/link";
import { ArrowDown, Clock, KeyRound, Users } from "lucide-react";
import { HeroMotionOverlay } from "@/components/MarketingUI";
import { fmtThousands } from "@/lib/format";

/**
 * Honsell hədiyyə kartı hero-su — `/hediyye-kartlari` hero-su ilə eyni quruluş,
 * amma PS mavisi əvəzinə Honsell brend rəngləri (violet/fuchsia).
 *
 * Server komponentdir: bütün hərəkət saf CSS-dir (`gc-sheen`, `ps-float`), ona
 * görə səhifə statik qalır. Kart vizualı şəkil deyil — məhsulun heç bir
 * `imageUrl`-i yoxdur, ona görə nominal özü vizualın mərkəzidir.
 */
export default function HonsellGiftCardHero({ topAzn }: { topAzn: number | null }) {
  return (
    <section className="site-container pt-6">
      <div className="relative overflow-hidden rounded-[28px] border border-violet-300/40 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 dark:border-violet-500/25 dark:from-[#1a0d2e] dark:via-[#140a24] dark:to-[#07050f]">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(217,70,239,0.18),transparent_55%)]" />
        <HeroMotionOverlay />

        <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-fuchsia-700 dark:border-fuchsia-400/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-500" />
              Honsell balansı
            </span>

            <h1 className="mt-4 text-[2rem] font-black leading-[1.05] tracking-tight text-zinc-950 sm:text-5xl dark:text-white">
              Sevdiyinə
              <br />
              <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500 bg-clip-text text-transparent">
                balans hədiyyə et
              </span>
            </h1>

            <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
              Nominal seç, ödə — 11 simvollu unikal kod alırsan. Kodu kimə
              versən, o öz Honsell cüzdanına köçürür.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { icon: KeyRound, text: "11 simvollu unikal kod" },
                { icon: Clock, text: "1 il etibarlıdır" },
                { icon: Users, text: "İstənilən hesaba" },
              ].map((t) => (
                <span
                  key={t.text}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300/70 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-zinc-700 backdrop-blur sm:text-xs dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
                >
                  <t.icon className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-300" />
                  {t.text}
                </span>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="#kartlar"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-600/25 transition hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-fuchsia-600/40"
              >
                Nominal seç
                <ArrowDown className="h-4 w-4 transition group-hover:translate-y-0.5" />
              </Link>
              <Link
                href="#aktivlesdirme"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-fuchsia-400 hover:text-fuchsia-700 dark:border-white/15 dark:text-zinc-300 dark:hover:border-fuchsia-400/50 dark:hover:text-white"
              >
                Necə aktivləşdirilir?
              </Link>
            </div>
          </div>

          {/* Kart vizualı — mobildə də görünür, `scale` ilə kiçilir. */}
          <div className="relative mx-auto h-[195px] w-full max-w-[460px] sm:h-[300px]">
            <div className="absolute inset-0 origin-top scale-[0.62] sm:scale-100">
              <div className="absolute left-1/2 top-11 h-[220px] w-[372px] -translate-x-1/2 rotate-[-11deg] rounded-2xl bg-gradient-to-br from-fuchsia-600 to-violet-800 opacity-40 blur-[1px]" />
              <div className="absolute left-1/2 top-7 h-[220px] w-[372px] -translate-x-1/2 rotate-[-6deg] rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-700 opacity-60" />

              <div className="gc-card absolute left-1/2 top-3 flex h-[232px] w-[382px] -translate-x-1/2 rotate-[4deg] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#7a00ff] via-[#a21caf] to-[#2b1170] p-6 shadow-2xl shadow-fuchsia-950/40 ring-1 ring-white/20">
                <span aria-hidden className="gc-sheen pointer-events-none absolute inset-0" />

                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] !text-white/85">
                      Honsell
                    </div>
                    <div className="mt-0.5 text-xs font-bold !text-white/70">
                      Hədiyyə kartı
                    </div>
                  </div>
                  <span className="mt-0.5 grid h-7 w-9 shrink-0 place-items-center rounded-[5px] bg-gradient-to-br from-amber-200 to-amber-400 shadow-inner">
                    <span className="h-3.5 w-5 rounded-[2px] border border-amber-600/40" />
                  </span>
                </div>

                <div className="relative">
                  <div className="text-5xl font-black leading-none tracking-tight !text-white">
                    {topAzn ? fmtThousands(topAzn) : "1.000"}
                    <span className="ml-1 text-3xl !text-white/80">₼</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    {/* 11 simvollu kod formatının vizual təqlidi */}
                    <div className="font-mono text-[11px] tracking-[0.18em] !text-white/55">
                      ••••-••••-•••
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.14em] !text-white/85">
                      1 il
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
