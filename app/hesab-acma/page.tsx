import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock4,
  HelpCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import AccountCreationCheckoutForm from "./AccountCreationCheckoutForm";
import { ACCOUNT_PASSWORD_RULES_AZ } from "@/lib/accountPasswordRules";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Türkiyə PSN Hesabı Açma — PlayStation Network",
  description:
    "Türkiyə PSN hesabınızı peşəkarlarımız sizin üçün açsın. Tam doğrulanmış hesab, etibarlı proses, qısa müddətdə təhvil.",
  alternates: { canonical: "/hesab-acma" },
  openGraph: {
    title: "Türkiyə PSN Hesabı Açma Xidməti | Honsell Store",
    description:
      "Tam doğrulanmış Türkiyə PlayStation Network hesabı — peşəkarlarımız sizin üçün açır.",
    url: "/hesab-acma",
  },
};

const STEPS = ["Məlumatlar", "Ödəniş", "Hesab hazırdır"];

export default async function HesabAcmaPage() {
  const service = await prisma.serviceProduct.findFirst({
    where: { isActive: true, type: "ACCOUNT_CREATION" },
  });
  const price = service ? (service.priceAznCents / 100).toFixed(2) : "3.00";

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc,#eef2ff_45%,#f8fafc)] text-zinc-950 dark:bg-[linear-gradient(180deg,#05050b,#0a0913_45%,#05050b)] dark:text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Link
          href="/playstation"
          className="inline-flex items-center gap-2 text-sm font-bold text-violet-700 transition hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"
        >
          <ArrowLeft className="h-4 w-4" />
          PlayStation xidmətləri
        </Link>

        <header className="mt-8 text-center">
          <h1 className="mx-auto max-w-3xl text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
            Türkiyə PSN hesabı açdır
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
            Məlumatları daxil edin, hesabı sizin üçün hazırlayaq.
          </p>
        </header>

        <Stepper />

        {service ? (
          <AccountCreationCheckoutForm
            product={{
              id: service.id,
              title: service.title,
              imageUrl: service.imageUrl,
              priceAznCents: service.priceAznCents,
            }}
          />
        ) : (
          <p className="mx-auto mt-10 max-w-xl rounded-3xl border border-amber-300/50 bg-amber-500/10 px-5 py-4 text-center text-sm font-semibold text-amber-700 dark:text-amber-200">
            Hesab açılışı xidməti hazırda aktiv deyil. Zəhmət olmasa bir az sonra yenidən yoxlayın.
          </p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035]">
            <h2 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white">
              Bizə hansı məlumatlar lazımdır?
            </h2>
            <div className="mt-5 grid gap-3">
              <Requirement
                icon={<UserRound className="h-5 w-5" />}
                title="Ad və soyad"
                text="Hesab profilində istifadə olunacaq real məlumat."
              />
              <Requirement
                icon={<CalendarClock className="h-5 w-5" />}
                title="Doğum tarixi"
                text="PSN qeydiyyatında tələb olunan tarix."
              />
              <Requirement
                icon={<Mail className="h-5 w-5" />}
                title="Yeni e-poçt"
                text="Başqa region PS Store hesabına bağlı olmayan ünvan."
              />
              <Requirement
                icon={<LockKeyhole className="h-5 w-5" />}
                title="Yeni şifrə"
                text="Başqa xidmətlərdə istifadə etmədiyiniz, yalnız bu hesab üçün şifrə."
              />
            </div>

            <div className="mt-6 grid gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-400/20 dark:bg-violet-400/10">
              <p className="flex items-center gap-2 text-sm font-black text-violet-800 dark:text-violet-200">
                <Clock4 className="h-4 w-4" />
                Ödənişdən sonra nə olur?
              </p>
              <p className="text-sm leading-6 text-violet-900/80 dark:text-violet-100/80">
                Sifariş icraya düşür, hesab sizin verdiyiniz məlumatlarla açılır və hazır olan kimi
                sizə təhvil verilir. Xidmət haqqı {price} AZN-dir.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035]">
            <h2 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white">
              Şifrə seçərkən bunlara diqqət edin
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Bu şifrə yeni açılacaq PSN hesabına qoyulacaq. Şəxsi bank, e-poçt və sosial media
              hesablarınızda istifadə etdiyiniz şifrəni yazmayın.
            </p>
            <ul className="mt-5 grid gap-2.5">
              {ACCOUNT_PASSWORD_RULES_AZ.map((rule) => (
                <li
                  key={rule}
                  className="flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                >
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
              <span className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-300">
                <HelpCircle className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                Sualınız var?
              </span>
              <Link
                href="/faq"
                className="font-bold text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
              >
                Tez-tez verilən suallar
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

/** 1 → 2 → 3 gedişat göstəricisi. Bu səhifə həmişə 1-ci addımdadır. */
function Stepper() {
  return (
    <ol className="mx-auto mt-8 flex max-w-2xl items-start justify-between lg:mt-10">
      {STEPS.map((label, index) => {
        const active = index === 0;
        return (
          <li
            key={label}
            className="flex flex-1 items-start last:flex-none"
            aria-current={active ? "step" : undefined}
          >
            <div className="flex w-16 shrink-0 flex-col items-center gap-2 sm:w-32">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black ${
                  active
                    ? "bg-violet-600 text-white"
                    : "border border-zinc-300 text-zinc-400 dark:border-white/15 dark:text-zinc-500"
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`text-center text-xs font-semibold sm:text-sm ${
                  active
                    ? "text-violet-700 dark:text-violet-300"
                    : "text-zinc-500 dark:text-zinc-500"
                }`}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className={`mt-[18px] h-px flex-1 ${
                  active ? "bg-violet-500/70" : "bg-zinc-300 dark:bg-white/10"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Requirement({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <span className="mt-0.5 text-violet-700 dark:text-violet-300">{icon}</span>
      <div>
        <p className="text-sm font-bold text-zinc-950 dark:text-white">{title}</p>
        <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">{text}</p>
      </div>
    </div>
  );
}
