import Link from "next/link";
import { GraduationCap, ArrowRight, BadgeCheck } from "lucide-react";

/**
 * Əsas /referal-faizleri səhifəsindən Student Partner (tələbələr) bölməsinə
 * aparan giriş kartı. Öz dizaynlı tam səhifə: /referal-faizleri/telebe.
 */
export default function StudentPartnerEntryCard() {
  return (
    <section className="w-full bg-gradient-to-b from-transparent to-violet-50/60 py-14 dark:to-violet-950/20">
      <div className="site-container">
        <Link
          href="/referal-faizleri/telebe"
          className="group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-violet-200/80 bg-white/80 p-7 shadow-[0_30px_80px_-60px_rgba(76,29,149,0.5)] transition hover:-translate-y-1 hover:shadow-[0_40px_90px_-55px_rgba(76,29,149,0.6)] sm:flex-row sm:items-center sm:justify-between sm:p-9 dark:border-violet-500/25 dark:bg-violet-950/25 dark:shadow-none"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-500/15"
          />

          <div className="relative flex items-start gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
              <GraduationCap className="h-7 w-7" />
            </span>
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <BadgeCheck className="h-3.5 w-3.5" /> Tələbələr üçün
              </span>
              <h3 className="text-xl font-black tracking-tight text-violet-950 sm:text-2xl dark:text-violet-50">
                Honsell Student Partner
              </h3>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Tələbəsənsə, statusunu təsdiqlə və kampusun elçisi ol. Öz referal
                faizlərini gör, qazancını hesabla və dostlarınla paylaş.
              </p>
            </div>
          </div>

          <span className="relative inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition group-hover:bg-violet-500">
            Faizlərə bax
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </section>
  );
}
