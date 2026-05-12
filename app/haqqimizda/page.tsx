import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gamepad2, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { SITE_NAME } from "@/lib/site";

const description =
  "Honsell PS Store haqqında məlumat: PlayStation oyunları, PS Plus, hədiyyə kartları və rəqəmsal xidmətlər üçün yerli alış təcrübəsi.";

export const metadata: Metadata = {
  title: "Haqqımızda",
  description,
  alternates: { canonical: "/haqqimizda" },
  openGraph: {
    title: "Haqqımızda | Honsell PS Store",
    description,
    url: "/haqqimizda",
    type: "website",
  },
};

const values = [
  {
    title: "Aydın qiymət",
    description: "Məhsullar AZN ilə göstərilir, sifarişdən əvvəl yekun məbləğ istifadəçiyə açıq görünür.",
    Icon: ShieldCheck,
  },
  {
    title: "Rəqəmsal rahatlıq",
    description: "PlayStation, streaming, musiqi və digər rəqəmsal xidmətləri bir hesab üzərindən idarə etmək mümkündür.",
    Icon: Gamepad2,
  },
  {
    title: "Sürətli dəstək",
    description: "Sifariş, aktivasiya və hesab sualları üçün komandamız istifadəçiyə praktik yönləndirmə verir.",
    Icon: Headphones,
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              Haqqımızda
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Azərbaycanda rəqəmsal oyun və abunəlik alışını daha sadə edirik.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">
              {SITE_NAME} PlayStation oyunları, PS Plus, hədiyyə kartları, Türkiyə PSN hesabı,
              streaming və digər rəqəmsal xidmətlər üçün yerli alış təcrübəsi yaradır. Məqsədimiz
              istifadəçinin region, valyuta və ödəniş çətinlikləri ilə vaxt itirmədən istədiyi
              rəqəmsal məhsula rahat çatmasıdır.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/oyunlar"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-500"
              >
                Məhsullara bax
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/bilmeli-olduglarin"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
              >
                Bələdçiləri oxu
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-[0_24px_80px_-48px_rgba(124,58,237,0.9)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Nə edirik
            </p>
            <div className="mt-5 space-y-5 text-sm leading-7 text-zinc-300">
              <p>
                Oyunçular üçün PS5 və PS4 oyunları, PS Plus paketləri, hədiyyə kartları və hesab
                açma xidmətlərini bir platformada toplayırıq.
              </p>
              <p>
                Rəqəmsal məhsulların sifariş, ödəniş və çatdırılma mərhələsini mümkün qədər aydın
                saxlayırıq ki, istifadəçi nə aldığını və növbəti addımı əvvəlcədən bilsin.
              </p>
              <p className="text-xs leading-6 text-zinc-500">
                Honsell müstəqil rəqəmsal satış platformasıdır və Sony Interactive Entertainment
                və ya PlayStation brendləri ilə rəsmi tərəfdaşlıq iddiası daşımır.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {values.map(({ title, description, Icon }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-zinc-900/45 p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-violet-400/25 bg-violet-500/10 text-violet-200">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-2xl font-black text-white">Sualın var?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Sifariş, ödəniş və ya məhsul seçimi ilə bağlı köməyə ehtiyacın olsa, bizimlə əlaqə
              saxlaya bilərsən.
            </p>
          </div>
          <a
            href="mailto:info@honsell.store"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white transition hover:bg-white/[0.09]"
          >
            info@honsell.store
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
