import { BadgeCheck, Briefcase, Sparkles, Zap } from "lucide-react";

export default function LinkedInHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-[#0a1929] via-[#0b2a44] to-[#0a1422] px-6 py-12 shadow-2xl sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(56,189,248,0.25),transparent_45%),radial-gradient(circle_at_15%_85%,rgba(37,99,235,0.18),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
            <Briefcase className="h-3.5 w-3.5" />
            LinkedIn Premium · Rəsmi abunəlik
          </span>

          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            LinkedIn Premium
            <span className="block bg-gradient-to-r from-sky-300 via-blue-300 to-cyan-200 bg-clip-text text-transparent">
              Career & Business
            </span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-sky-100/80 sm:text-lg">
            Karyera fürsətləri, biznes networking və peşəkar inkişaf üçün ən sürətli yol.
            Öz LinkedIn hesabına aktivləşdirilir — endirimli qiymətə, sənin adına.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200">
              <BadgeCheck className="h-3.5 w-3.5 text-sky-300" />
              Rəsmi LinkedIn abunəliyi
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200">
              <Zap className="h-3.5 w-3.5 text-emerald-300" />
              Sürətli aktivləşdirmə
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              50%-ə qədər endirim
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center justify-center lg:flex">
          <div className="relative">
            <div className="absolute inset-0 -m-6 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="relative grid h-44 w-44 place-items-center rounded-3xl border border-sky-300/30 bg-gradient-to-br from-sky-500/30 via-blue-600/20 to-cyan-500/10 shadow-[0_0_60px_rgba(56,189,248,0.35)]">
              <Briefcase className="h-24 w-24 text-sky-200" strokeWidth={1.6} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
