import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import HesabAcmaPageClient from "./HesabAcmaPageClient";
import ReferralBadge from "@/components/ReferralBadge";
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

export default async function HesabAcmaPage() {
  const service = await prisma.serviceProduct.findFirst({
    where: { isActive: true, type: "ACCOUNT_CREATION" },
  });
  const price = service ? (service.priceAznCents / 100).toFixed(2) : "3.00";

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-zinc-900 dark:bg-[#07090d] dark:text-zinc-100">
      <SiteHeaderServer />

      <section className="border-b border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0b0d12]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:py-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Türkiyə PSN hesabı
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-zinc-950 dark:text-white sm:text-5xl">
              PS Store Türkiyə üçün hesabı sizin adınıza hazırlayaq
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Məlumatları daxil edirsiniz, ödənişi tamamlayırsınız, biz isə regionu düzgün
              qurulmuş yeni PSN hesabını hazırlayıb təhvil veririk.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <ServicePill icon={<UserRound className="h-4 w-4" />} text="Sizin məlumatlarla açılır" />
              <ServicePill icon={<Mail className="h-4 w-4" />} text="Yeni e-poçt tələb olunur" />
              <ServicePill icon={<LockKeyhole className="h-4 w-4" />} text="PSN qaydalarına uyğun şifrə" />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {service ? (
                <HesabAcmaPageClient
                  product={{
                    id: service.id,
                    title: service.title,
                    imageUrl: service.imageUrl,
                    priceAznCents: service.priceAznCents,
                  }}
                />
              ) : (
                <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
                  Hesab açılışı xidməti hazırda aktiv deyil.
                </p>
              )}
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Qiymət: <span className="font-bold text-zinc-950 dark:text-white">{price} AZN</span>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-[#11141b]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
                    Xidmət haqqı
                  </p>
                  <p className="mt-2 text-4xl font-black text-zinc-950 dark:text-white">{price} ₼</p>
                </div>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-200">
                  <BadgeCheck className="h-7 w-7" />
                </span>
              </div>
              <div className="mt-4">
                <ReferralBadge category="accountCreation" productName="Türkiyə PSN hesabı" />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <MiniStep number="1" title="Məlumatları yazın" text="Ad, doğum tarixi, e-poçt və şifrə." />
              <MiniStep number="2" title="Səbətə əlavə edin" text="Ödənişdən sonra sifariş icraya düşür." />
              <MiniStep number="3" title="Hesab təhvil verilir" text="Hazır hesab məlumatları sizə təqdim olunur." />
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.035]">
          <h2 className="text-xl font-black text-zinc-950 dark:text-white">Bizə hansı məlumatlar lazımdır?</h2>
          <div className="mt-5 grid gap-3">
            <Requirement icon={<UserRound className="h-5 w-5" />} title="Ad və soyad" text="Hesab profilində istifadə olunacaq real məlumat." />
            <Requirement icon={<CalendarClock className="h-5 w-5" />} title="Doğum tarixi" text="PSN qeydiyyatında tələb olunan tarix." />
            <Requirement icon={<Mail className="h-5 w-5" />} title="Yeni e-poçt" text="Başqa region PS Store hesabına bağlı olmayan ünvan." />
            <Requirement icon={<LockKeyhole className="h-5 w-5" />} title="Yeni şifrə" text="Başqa xidmətlərdə istifadə etmədiyiniz, yalnız bu hesab üçün şifrə." />
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.035]">
          <h2 className="text-xl font-black text-zinc-950 dark:text-white">Şifrə seçərkən bunlara diqqət edin</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Bu şifrə yeni açılacaq PSN hesabına qoyulacaq. Şəxsi bank, e-poçt və sosial media
            hesablarınızda istifadə etdiyiniz şifrəni yazmayın.
          </p>
          <ul className="mt-5 grid gap-2.5">
            {ACCOUNT_PASSWORD_RULES_AZ.map((rule) => (
              <li key={rule} className="flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function ServicePill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
      {icon}
      {text}
    </span>
  );
}

function MiniStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#11141b]">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-zinc-950 text-sm font-black text-white dark:bg-white dark:text-zinc-950">
        {number}
      </span>
      <div>
        <p className="text-sm font-bold text-zinc-950 dark:text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{text}</p>
      </div>
    </div>
  );
}

function Requirement({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <span className="mt-0.5 text-sky-700 dark:text-sky-300">{icon}</span>
      <div>
        <p className="text-sm font-bold text-zinc-950 dark:text-white">{title}</p>
        <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">{text}</p>
      </div>
    </div>
  );
}
