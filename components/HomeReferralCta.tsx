import Link from "next/link";
import { ArrowRight, Gift, Coins, UserPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import ReferralShareButtons from "./ReferralShareButtons";

/**
 * Ana səhifədəki referal CTA bölməsi. Login olmuş istifadəçiyə birbaşa öz
 * kodunu və kopyalama/paylaşma düymələrini göstərir ki, kodu axtarmasın.
 * Login deyilsə ümumi CTA göstərilir.
 */
const BENEFITS = [
  { icon: UserPlus, label: "Pulsuz qoşul" },
  { icon: Coins, label: "Hər alışdan komissiya" },
  { icon: Gift, label: "Dostuna da sərfəli" },
];

export default async function HomeReferralCta() {
  const user = await getCurrentUser();

  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] border border-fuchsia-400/25 bg-gradient-to-br from-violet-600/15 via-fuchsia-600/12 to-violet-700/15 px-6 py-10 shadow-[0_30px_80px_-50px_rgba(168,85,247,0.7)] dark:border-fuchsia-400/20 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(232,121,249,0.22),transparent_55%)]" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />

          <div className="relative mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-fuchsia-700 dark:text-fuchsia-200">
              <Coins className="h-3.5 w-3.5" />
              Referal proqramı
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
              Dostunu dəvət et — hər alışından AZN qazan
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-fuchsia-50/80 sm:text-base">
              Kodunla qeydiyyatdan keçən hər dost üçün oyun, PS Plus və streaming
              alışlarından komissiya qazanırsan.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200"
                >
                  <Icon className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-300" />
                  {label}
                </span>
              ))}
            </div>

            {user?.referralCode ? (
              <div className="mx-auto mt-7 max-w-xl">
                <p className="text-xs font-bold uppercase tracking-wide text-fuchsia-700/80 dark:text-fuchsia-200/80">
                  Sənin referal kodun
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <code className="break-all rounded-xl border border-fuchsia-300/40 bg-white/80 px-5 py-2.5 font-mono text-2xl font-black tracking-[0.2em] text-fuchsia-700 dark:border-white/20 dark:bg-white/10 dark:text-white">
                    {user.referralCode}
                  </code>
                </div>
                <div className="mt-4 flex justify-center">
                  <ReferralShareButtons code={user.referralCode} />
                </div>
                <div className="mt-5">
                  <Link
                    href="/qazan"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-fuchsia-700 underline-offset-4 transition hover:underline dark:text-fuchsia-100"
                  >
                    Necə qazanıram? <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-black text-white shadow-[0_18px_44px_-20px_rgba(168,85,247,0.9)] transition hover:-translate-y-0.5 hover:from-violet-500 hover:to-fuchsia-500"
                >
                  Qeydiyyatdan keç və kod al <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/qazan"
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/70 px-6 py-3 text-sm font-bold text-zinc-800 transition hover:bg-white dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  Necə qazanıram?
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
