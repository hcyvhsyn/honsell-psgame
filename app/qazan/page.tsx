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
import QazanCalculatorClient from "./QazanCalculatorClient";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/pricing";
import { getReferralLeaderboard } from "@/lib/referralLeaderboard";
import { REFERRAL_TIERS } from "@/lib/referralTiers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Qazan — Honsell referal proqramı",
  description:
    "Dostunu Honsell-ə dəvət et, hər oyun, PS Plus və streaming alışından komissiya qazan. 5/10/25 uğurlu dəvət üçün bonus AZN.",
  alternates: { canonical: "/qazan" },
};

export default async function QazanPage() {
  const [user, settings, leaderboard] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getReferralLeaderboard(10).catch(() => []),
  ]);

  const gamePct = Math.round(settings.referralProfitSharePct);
  const streamingPct = Math.round(settings.referralStreamingProfitSharePct);

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
              hər alışından AZN qazan
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            Honsell-də əsas qazanc kanalımız sizinlədir. Kodunla qoşulan hər
            dostunun oyun, PS Plus və streaming alışlarından komissiya alırsan.
            Bonus pillələri də unutma — 5/10/25 uğurlu dəvət üçün əlavə AZN.
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
              body: `Sənin kodunla qoşulan dostun oyun və ya streaming alanda komissiya hesabına yazılır — oyunlardan ${gamePct}%, streamingdən ${streamingPct}%.`,
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
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
            Qazanc kalkulyatoru
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-400">
            Aylıq neçə dəvətin və orta alışları nə qədərdirsə — təxmini qazancını gör.
          </p>
          <div className="mt-8">
            <QazanCalculatorClient gamePct={gamePct} streamingPct={streamingPct} />
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Pilləli mükafatlar
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400">
            Uğurlu dəvət = referal kodu ilə qoşulan və ən azı bir alış edən dost.
          </p>
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-3">
          {REFERRAL_TIERS.map((t) => (
            <li
              key={t.threshold}
              className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-transparent p-6 text-center"
            >
              <p className="text-4xl">{t.emoji}</p>
              <h3 className="mt-2 text-xl font-bold text-white">{t.label}</h3>
              <p className="mt-1 text-xs text-zinc-400">{t.threshold} uğurlu dəvət</p>
              <p className="mt-4 text-2xl font-black tabular-nums text-amber-300">
                +{(t.bonusAznCents / 100).toFixed(0)} AZN
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">birdəfəlik bonus</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Leaderboard */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
            Bu ay liderlər
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-400">
            Cari ay üçün ən çox qazanan referallarımız (anonim).
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
                      <p className="text-[11px] text-zinc-500">Bu ay qazanc</p>
                    </div>
                    <p className="font-bold tabular-nums text-emerald-300">
                      {entry.earnedAzn.toFixed(2)} AZN
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

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
              a: `Hazırda oyunlardan kar payı ${gamePct}%, streaming abunəliklərində isə final qiymətdən ${streamingPct}% komissiya verilir. Tarif idarə tərəfindən dəyişə bilər.`,
            },
            {
              q: "Referal balansını necə istifadə edə bilərəm?",
              a: "Səbətdə ödəniş zamanı 'Referal balansı ilə ödə' seçimini seçərək balansı tam və ya qismən sərf edə bilərsən.",
            },
            {
              q: "Pilləli bonuslar necə işləyir?",
              a: "5, 10 və 25 uğurlu dəvətə çatdıqda birdəfəlik bonus (5/15/50 AZN) referal balansına əlavə olunur. Eyni pillə üçün ikinci dəfə bonus verilmir.",
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
