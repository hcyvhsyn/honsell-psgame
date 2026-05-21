import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Globe2,
  HelpCircle,
  Server,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import WebsiteApplicationFormClient from "./WebsiteApplicationFormClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Layihə üçün müraciət — Website Hazırlanması | Honsell",
  description:
    "Website hazırlanması üçün layihənizi qısa formada təqdim edin — komandamız WhatsApp üzərindən sizinlə əlaqə saxlayacaq.",
  alternates: { canonical: "/xidmetler/website/muraciet" },
};

const GUIDE_ITEMS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Globe2,
    title: "Domen",
    text: "Saytın ünvanıdır. Məsələn, sizinbrend.az. Yoxdursa, seçimdə kömək edirik.",
  },
  {
    icon: Server,
    title: "Hosting",
    text: "Saytın işlədiyi server yeridir. Hazır hosting yoxdursa, uyğun variant təklif edirik.",
  },
  {
    icon: Sun,
    title: "Light / Dark",
    text: "Light açıq fon, Dark tünd fondur. Brendə uyğun birini və ya hər ikisini seçmək olar.",
  },
  {
    icon: CalendarDays,
    title: "Tarix",
    text: "Başlama günü dəqiq deyilsə boş saxlaya bilərsiniz. Danışıqda dəqiqləşdiririk.",
  },
];

export default function WebsiteMuraciatPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc,#eef2ff_42%,#f8fafc)] text-zinc-950 dark:bg-[linear-gradient(180deg,#05050b,#090914_42%,#05050b)] dark:text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            <header className="py-4 sm:py-8">
              <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-violet-700 dark:border-violet-300/25 dark:bg-violet-400/10 dark:text-violet-200">
                <Sparkles className="h-3.5 w-3.5" />
                Website Hazırlanması
              </p>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
                Layihəni rahat başa salın, biz texniki tərəfini sadələşdirək
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
                Sayt istəyinizi yazın, təxmini qiyməti görün, sonra WhatsApp-da danışaq.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["Layihə məlumatı", "Nə sayt istədiyinizi qısa yazın"],
                  ["Təxmini qiymət", "Seçimlərə görə ilkin məbləğ görünür"],
                  ["Başlama tarixi", "Uyğun günü rahat seçin"],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <p className="text-sm font-black text-zinc-950 dark:text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{text}</p>
                  </div>
                ))}
              </div>
            </header>

            <div className="mt-8">
              <WebsiteApplicationFormClient />
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-32">
            <div className="overflow-hidden rounded-[26px] border border-zinc-200 bg-white/86 p-5 shadow-[0_24px_70px_-58px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-400/10 dark:text-violet-200 dark:ring-violet-300/20">
                  <HelpCircle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-black text-zinc-950 dark:text-white">
                    Formdakı terminlər
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Lazım olan qədər izah, artıq səs-küy yox.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {GUIDE_ITEMS.map(({ icon: Icon, title, text }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-zinc-200 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-violet-500" />
                      <p className="text-sm font-black text-zinc-950 dark:text-white">{title}</p>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/xidmetler/website"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm font-bold text-zinc-800 transition hover:border-violet-300 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-violet-300/30 dark:hover:text-white"
            >
              Xidmət səhifəsinə bax
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
