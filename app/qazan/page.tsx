import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Coins,
  Gift,
  Sparkles,
  Trophy,
  UserPlus,
  Wallet,
} from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import ReferralShareButtons from "@/components/ReferralShareButtons";
import ReferralCodeCopy from "@/components/ReferralCodeCopy";
import CycleCountdown from "@/components/CycleCountdown";
import QazanCalculatorClient from "./QazanCalculatorClient";
import { getCurrentUser } from "@/lib/auth";
import {
  getReferralLeaderboard,
  getLastCycleLeaderboard,
} from "@/lib/referralLeaderboard";
import { getCurrentCycle } from "@/lib/referralCycle";
import { getReferralCalculatorOptions } from "@/lib/referralCalculatorOptions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Qazan — Honsell referal proqramı",
  description:
    "Dostunu Honsell-ə dəvət et, hər oyun, PS Plus və streaming alışından komissiya qazan.",
  alternates: { canonical: "/qazan" },
};

export default async function QazanPage() {
  const [user, calculatorOptions, leaderboard, lastCycle, cycle] = await Promise.all([
    getCurrentUser(),
    getReferralCalculatorOptions(),
    getReferralLeaderboard(10).catch(() => ({} as never)).then(
      (v) => (Array.isArray(v) ? v : [])
    ),
    getLastCycleLeaderboard(10).catch(() => ({ cycle: null, entries: [] })),
    getCurrentCycle().catch(() => null),
  ]);

  const psStoreOptions = calculatorOptions.filter((o) => o.category === "PLAYSTATION");
  const psStoreSummary = psStoreOptions.length
    ? psStoreOptions.map((o) => `${o.platformLabel}: ${o.ratePct}%`).join(", ")
    : "PS Store: 0%";
  const maxPlatformPct = Math.max(0, ...calculatorOptions.map((o) => o.ratePct));

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(232,121,249,0.25),transparent_60%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200">
            <Sparkles className="h-3.5 w-3.5" /> Referal proqramı
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-white sm:text-6xl">
            Dostunu dəvət et,
            <br />
            <span className="bg-gradient-to-r from-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
              hər alışından PUL qazan
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            Honsell-də əsas qazanc kanalımız sizinlədir. Kodunla qoşulan hər
            dostunun oyun, streaming, musiqi, AI və iş platforması alışlarından
            platformaya görə dəyişən referal faizi ilə komissiya qazanırsan.
          </p>

          {user ? (
            <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-fuchsia-500/30 bg-zinc-950/40 p-5 backdrop-blur sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
                Sənin referal kodun
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="break-all rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 font-mono text-2xl font-bold tracking-[0.2em] text-white">
                  {user.referralCode}
                </span>
                <ReferralCodeCopy code={user.referralCode} />
              </div>
              <div className="mt-4">
                <ReferralShareButtons code={user.referralCode} />
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-fuchsia-900 transition hover:bg-fuchsia-50"
              >
                <UserPlus className="h-4 w-4" /> Qeydiyyatdan keç və başla
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Daxil ol
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
          Necə işləyir?
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: <UserPlus className="h-6 w-6 text-fuchsia-300" />,
              title: "1. Kodunu paylaş",
              body: "Profil səhifəndən referal kodunu və ya hazır WhatsApp/Telegram mesajını dostlarınla paylaş.",
            },
            {
              icon: <Coins className="h-6 w-6 text-amber-300" />,
              title: "2. Onlar alış edir",
              body: `Sənin kodunla qoşulan dostun alış etdikdə komissiya hesabına yazılır. Faiz platformadan asılıdır və hazırda 0%-dən ${maxPlatformPct}% aralığında ola bilər.`,
            },
            {
              icon: <Wallet className="h-6 w-6 text-emerald-300" />,
              title: "3. Balansı istifadə et",
              body: "Yığılan referal balansı növbəti alışda ödəniş kimi seçilir — wallet-dən ayrı saxlanılır.",
            },
          ].map((step) => (
            <li
              key={step.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10">
                {step.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Calculator */}
      <section className="relative overflow-hidden border-y border-white/5 bg-[#050817]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[70rem] -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="pointer-events-none absolute left-[18%] top-24 h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.9)]" />
        <div className="pointer-events-none absolute right-[9%] top-32 h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.9)]" />
        <div className="relative mx-auto max-w-[1560px] px-4 py-16 sm:px-6 lg:py-20">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/20 text-violet-200 ring-1 ring-violet-300/20">
                H
              </span>
              Honsell Store
            </span>
            <h2 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl">
              Qazanc kalkulyatoru
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
              Kateqoriyaları, platformaları, orta aylıq xərci, referal sayını və dövrü
              seçərək referal sistemimizdən nə qədər qazanc əldə edə biləcəyinizi təxmin edin.
            </p>
          </div>
          <div className="mt-8">
            <QazanCalculatorClient initialOptions={calculatorOptions} />
          </div>
        </div>
      </section>

      {/* Cycle countdown */}
      {cycle ? (
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-sm text-zinc-400">
              Cari ay üçün leaderboard sayğacı
            </p>
            <CycleCountdown endsAt={cycle.endsAt.toISOString()} />
          </div>
        </section>
      ) : null}

      {/* Leaderboard */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
            Bu ay liderlər
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
            Cari ay üçün ən çox bal toplayan istifadəçilərimiz (anonim) — öz xərc və dəvətlərinə görə.
          </p>
          {leaderboard.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-sm text-zinc-500">
              <Trophy className="mx-auto h-10 w-10 text-zinc-700" />
              <p className="mt-3">
                Hələ ki, bu ay heç kim sıralamada deyil. İlk olan sən olarsan?
              </p>
            </div>
          ) : (
            <ol className="mt-8 space-y-2">
              {leaderboard.map((entry) => {
                const medal =
                  entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
                return (
                  <li
                    key={entry.userId}
                    className={`flex items-center gap-4 rounded-2xl border p-4 ${
                      entry.rank <= 3
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex w-10 shrink-0 items-center justify-center text-xl">
                      {medal ?? <span className="text-sm text-zinc-500">#{entry.rank}</span>}
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fuchsia-500/15 text-sm font-semibold text-fuchsia-200 ring-1 ring-fuchsia-500/30">
                      {entry.avatarLetter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{entry.displayName}</p>
                      <p className="text-[11px] text-zinc-500">
                        {entry.invites} dəvət · {entry.spendAzn.toFixed(0)} AZN xərc
                      </p>
                    </div>
                    <p className="font-bold tabular-nums text-amber-300">
                      {entry.points} bal
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      {/* Past cycle archive — last 1 month */}
      {lastCycle.cycle ? (
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
            Keçən ay nəticələri
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
            {lastCycle.cycle.startsAt.toLocaleDateString("az-AZ", {
              month: "long",
              year: "numeric",
            })}{" "}
            ayının yekun sıralaması.
          </p>
          {lastCycle.entries.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-sm text-zinc-500">
              Keçən ay heç kim sıralamada deyildi.
            </div>
          ) : (
            <ol className="mt-8 space-y-2">
              {lastCycle.entries.map((entry) => {
                const medal =
                  entry.rank === 1
                    ? "🥇"
                    : entry.rank === 2
                    ? "🥈"
                    : entry.rank === 3
                    ? "🥉"
                    : null;
                return (
                  <li
                    key={entry.userId}
                    className={`flex items-center gap-4 rounded-2xl border p-4 ${
                      entry.rank <= 3
                        ? "border-zinc-700 bg-zinc-900/40"
                        : "border-white/5 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex w-10 shrink-0 items-center justify-center text-xl">
                      {medal ?? (
                        <span className="text-sm text-zinc-500">#{entry.rank}</span>
                      )}
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300 ring-1 ring-white/10">
                      {entry.avatarLetter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-200">
                        {entry.displayName}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {entry.invites} dəvət · {entry.spendAzn.toFixed(0)} AZN xərc
                      </p>
                    </div>
                    <p className="font-bold tabular-nums text-zinc-300">
                      {entry.points} bal
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
          Tez-tez verilən suallar
        </h2>
        <div className="mt-8 space-y-4">
          {[
            {
              q: "Referal komissiyası nə zaman yaranır?",
              a: "Dostun alışı uğurla tamamlandıqda (admin tərəfindən təsdiq edildikdə və ya avto-çatdırılmada) komissiya birbaşa referal balansına əlavə olunur.",
            },
            {
              q: "Komissiya faizi nə qədərdir?",
              a: `PS Store daxilində faizlər ayrıca idarə olunur (${psStoreSummary}). Streaming, musiqi, AI və iş platformalarında faiz hər platforma üçün admin paneldən ayrıca təyin olunur və kalkulyatorda platformanın yanında canlı göstərilir.`,
            },
            {
              q: "Referal balansını necə istifadə edə bilərəm?",
              a: "Səbətdə ödəniş zamanı 'Referal balansı ilə ödə' seçimini seçərək balansı tam və ya qismən sərf edə bilərsən.",
            },
            {
              q: "Uğurlu dəvət deyəndə nə nəzərdə tutulur?",
              a: "Sənin referal kodunla qeydiyyatdan keçən və ən azı bir uğurlu alış (oyun və ya xidmət) etmiş istifadəçi.",
            },
            {
              q: "Pul nağd çıxarıla bilərmi?",
              a: "Hazırda referal balansı yalnız Honsell-də alış üçün istifadə olunur. Nağda çevirmək seçimi gələcəkdə əlavə oluna bilər.",
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 open:border-fuchsia-500/30 open:bg-fuchsia-500/[0.04]"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-base font-semibold text-white">
                {item.q}
                <span className="text-fuchsia-300 transition group-open:rotate-180">▾</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/5 bg-gradient-to-r from-fuchsia-700/20 via-purple-700/15 to-fuchsia-700/20 py-14">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
          <Gift className="h-10 w-10 text-fuchsia-300" />
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">İndi başla</h2>
          <p className="mt-3 max-w-xl text-sm text-fuchsia-50/80 sm:text-base">
            {user
              ? "Kodunu paylaşmaq üçün dəqiqələr lazımdır. Komissiya isə həmişəlik."
              : "Qeydiyyatdan keç, kodunu götür və paylaşmağa başla."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <>
                <Link
                  href="/profile/referrals"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-fuchsia-900 transition hover:bg-fuchsia-50"
                >
                  Mənim kabinetim <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/oyunlar"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Check className="h-4 w-4" /> Mağazaya keç
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-fuchsia-900 transition hover:bg-fuchsia-50"
                >
                  <UserPlus className="h-4 w-4" /> Qeydiyyat
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Daxil ol
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
