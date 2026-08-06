import Link from "next/link";
import { ArrowDown, BadgeCheck, Clock, Zap } from "lucide-react";
import { HeroMotionOverlay } from "@/components/MarketingUI";
import { fmtThousands } from "@/lib/format";

/**
 * Hədiyyə kartları hero-su.
 *
 * Server komponentdir — bütün hərəkət saf CSS-dir (`HeroMotionOverlay` üzən PS
 * simvolları, `.gc-sheen` kart parıltısı), ona görə səhifə statik qalır.
 *
 * Sağdaki kart VİZUALI qəsdən şəkil deyil, CSS-dir: admin heç nə yükləmədən
 * səhifə "dolu" görünür və CDN-dən əlavə bayt çəkilmir. Nominal dinamikdir
 * (`topTry`) — kataloqdaki ən böyük kart göstərilir ki, vitrin real olsun.
 */
export default function GiftCardHero({
  topTry,
  fromAzn,
}: {
  /** Kataloqdaki ən yüksək TRY nominalı (kart mock-unda göstərilir). */
  topTry: number | null;
  /** Ən aşağı AZN qiyməti — «X AZN-dən» yazısı üçün. */
  fromAzn: number | null;
}) {
  return (
    <section className="site-container pt-6">
      <div className="relative overflow-hidden rounded-[28px] border border-indigo-300/40 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:border-indigo-500/25 dark:from-[#0d1030] dark:via-[#100c24] dark:to-[#05060f]">
        {/* Fon işıqları */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(56,189,248,0.16),transparent_55%)]" />
        <HeroMotionOverlay />

        <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4">
          {/* ─── Mətn ───────────────────────────────────────────────── */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Anında e-pin
            </span>

            <h1 className="mt-4 text-[2rem] font-black leading-[1.05] tracking-tight text-zinc-950 sm:text-5xl dark:text-white">
              PlayStation balansını
              <br />
              <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                2 dəqiqədə
              </span>{" "}
              yüklə
            </h1>

            <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
              Türkiyə PSN hesabın üçün rəsmi TRY wallet kodu.
              {fromAzn !== null && (
                <>
                  {" "}
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {fromAzn.toFixed(2)} AZN-dən
                  </span>{" "}
                  başlayır.
                </>
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { icon: Zap, text: "Ödənişdən dərhal sonra" },
                { icon: BadgeCheck, text: "Rəsmi 12 simvollu kod" },
                { icon: Clock, text: "24/7 dəstək" },
              ].map((t) => (
                <span
                  key={t.text}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300/70 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-zinc-700 backdrop-blur sm:text-xs dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
                >
                  <t.icon className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
                  {t.text}
                </span>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="#kartlar"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-600/40"
              >
                Məbləği seç
                <ArrowDown className="h-4 w-4 transition group-hover:translate-y-0.5" />
              </Link>
              <Link
                href="#aktivlesdirme"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-violet-400 hover:text-violet-700 dark:border-white/15 dark:text-zinc-300 dark:hover:border-violet-400/50 dark:hover:text-white"
              >
                Necə aktivləşdirilir?
              </Link>
            </div>
          </div>

          {/* ─── Kart vizualı (saf CSS) ────────────────────────────────
              Mobildə də göstərilir (trafikin əsas hissəsi mobildir), sadəcə
              `scale` ilə kiçildilir — daxildəki absolute px ölçüləri hər
              breakpoint üçün yenidən yazılmasın. */}
          <div className="relative mx-auto h-[195px] w-full max-w-[460px] sm:h-[300px]">
            <div className="absolute inset-0 origin-top scale-[0.62] sm:scale-100">
              {/* Arxa kart — dərinlik hissi */}
              <div className="absolute left-1/2 top-11 h-[220px] w-[372px] -translate-x-1/2 rotate-[-11deg] rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-800 opacity-40 blur-[1px]" />
              <div className="absolute left-1/2 top-7 h-[220px] w-[372px] -translate-x-1/2 rotate-[-6deg] rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 opacity-60" />

              {/* Ön kart */}
              <div className="gc-card absolute left-1/2 top-3 flex h-[232px] w-[382px] -translate-x-1/2 rotate-[4deg] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a5cc9] via-[#1a3ba8] to-[#2b1170] p-6 shadow-2xl shadow-indigo-950/40 ring-1 ring-white/20">
                <span
                  aria-hidden
                  className="gc-sheen pointer-events-none absolute inset-0"
                />

                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] !text-white/70">
                      PlayStation Store
                    </div>
                    <div className="mt-0.5 text-xs font-bold !text-white/90">
                      Gift Card · TRY
                    </div>
                  </div>
                  {/* Çip */}
                  <span className="mt-0.5 grid h-7 w-9 shrink-0 place-items-center rounded-[5px] bg-gradient-to-br from-amber-200 to-amber-400 shadow-inner">
                    <span className="h-3.5 w-5 rounded-[2px] border border-amber-600/40" />
                  </span>
                </div>

                <div className="relative">
                  <div className="text-5xl font-black leading-none tracking-tight !text-white">
                    {topTry ? fmtThousands(topTry) : "1.000"}
                    <span className="ml-1 text-3xl !text-white/80">₺</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="font-mono text-[11px] tracking-[0.18em] !text-white/55">
                      •••• •••• ••••
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] !text-white/85">
                      Honsell
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
