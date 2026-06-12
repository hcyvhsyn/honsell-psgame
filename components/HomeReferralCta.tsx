import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import ReferralShareButtons from "./ReferralShareButtons";

/**
 * Ana səhifədəki referal CTA bölməsi. Login olmuş istifadəçiyə birbaşa öz
 * kodunu və kopyalama/paylaşma düymələrini göstərir ki, kodu axtarmasın.
 * Login deyilsə ümumi CTA göstərilir.
 */
export default async function HomeReferralCta() {
  const user = await getCurrentUser();

  return (
    <section className="relative overflow-hidden border-y border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-700/30 via-purple-700/20 to-fuchsia-700/30 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(232,121,249,0.25),transparent_60%)]" />
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-fuchsia-300">
          Referal proqramı
        </p>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
          Dostunu dəvət et — hər alışından AZN qazan
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-fuchsia-50/80 sm:text-base">
          Kodunla qeydiyyatdan keçən hər dost üçün siz hər oyun, PS Plus və streaming
          alışından komissiya qazanırsız.
        </p>

        {user?.referralCode ? (
          <div className="mx-auto mt-6 max-w-xl">
            <p className="text-xs uppercase tracking-wide text-fuchsia-200/80">
              Sənin referal kodun
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <code className="break-all rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 font-mono text-2xl font-black tracking-[0.2em] text-white">
                {user.referralCode}
              </code>
            </div>
            <div className="mt-4 flex justify-center">
              <ReferralShareButtons code={user.referralCode} />
            </div>
            <div className="mt-5">
              <Link
                href="/qazan"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-100 underline-offset-4 transition hover:text-white hover:underline"
              >
                Necə qazanıram? <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-fuchsia-900 transition hover:bg-fuchsia-50"
            >
              Qeydiyyatdan keç və kod al <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/qazan"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Necə qazanıram?
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
