import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gamepad2, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import ActivationStepsSection from "@/components/ActivationStepsSection";
import { SectionFlowDivider } from "@/components/MarketingUI";
import ScrollAnimationManager from "@/components/ScrollAnimationManager";
import { HONSELL_GIFT_CARD_SERVICE_TYPE } from "@/lib/honsellGiftCard";
import HonsellGiftCardHero from "./HonsellGiftCardHero";
import HonsellGiftCardsClient from "./HonsellGiftCardsClient";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Honsell Hədiyyə Kartları — 5/10/20/50/100/200/500/1000 AZN",
  description:
    "Honsell Store-da istifadə üçün hədiyyə kartları. 11 simvollu unikal kod — istənilən istifadəçi öz cüzdanına aktivləşdirə bilər.",
  alternates: { canonical: "/hediyye-kartlari/honsell" },
  openGraph: {
    title: "Honsell Hədiyyə Kartları | Honsell Store",
    description:
      "Honsell hədiyyə kartı al, 11 simvollu unikal kod əldə et və hədiyyə et. Aktivləşdirildikdə tam məbləğ cüzdana köçürülür.",
    url: "/hediyye-kartlari/honsell",
  },
};

const FACTS = [
  {
    icon: KeyRound,
    value: "11",
    title: "Simvollu unikal kod",
    text: "Hər kart yalnız bir dəfə istifadə oluna bilər — kod aktivləşdikdən sonra sönür.",
  },
  {
    icon: Wallet,
    value: "100%",
    title: "Cüzdana köçür",
    text: "Aktivləşdirən şəxsin Honsell balansına tam məbləğ düşür, komissiya tutulmur.",
  },
  {
    icon: ShieldCheck,
    value: "1 il",
    title: "Etibarlılıq müddəti",
    text: "Alış tarixindən bir il ərzində istənilən vaxt aktivləşdirilə bilər.",
  },
] as const;

/**
 * Honsell hədiyyə kartı vitrini — `/hediyye-kartlari` ilə eyni quruluş:
 * hero → nominallar → «məhsul nədir» → aktivləşdirmə addımları.
 *
 * Fərq: bu kart PSN balansı deyil, SAYT balansıdır və çatdırılma ANINDA DEYİL —
 * checkout `HonsellGiftCard`-ı `status: "PENDING"`, `code: null` ilə yaradır,
 * admin `/admin/honsell-gift-cards` səhifəsindən kodu daxil edir. Səhifə mətni
 * buna uyğun yazılıb.
 */
export default async function HonsellGiftCardsPage() {
  const cards = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: HONSELL_GIFT_CARD_SERVICE_TYPE },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  const mapped = cards.map((c) => {
    const meta = (c.metadata as Record<string, unknown> | null) ?? null;
    const denomination =
      typeof meta?.denominationAzn === "number"
        ? (meta.denominationAzn as number)
        : c.priceAznCents / 100;
    return {
      id: c.id,
      title: c.title,
      imageUrl: c.imageUrl,
      priceAznCents: c.priceAznCents,
      denominationAzn: denomination,
    };
  });

  const topAzn = mapped.length ? Math.max(...mapped.map((c) => c.denominationAzn)) : null;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <SiteHeaderServer />
      <ScrollAnimationManager />

      <HonsellGiftCardHero topAzn={topAzn} />

      {/* ─── Nominallar ──────────────────────────────────────────────────── */}
      <SectionFlowDivider text="Nominal seç" tone="rose" />

      <section id="kartlar" className="site-container scroll-mt-24 pb-4">
        {mapped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Hazırda aktiv hədiyyə kartı yoxdur.
          </div>
        ) : (
          <HonsellGiftCardsClient cards={mapped} />
        )}
      </section>

      {/* ─── Məhsul nədir ────────────────────────────────────────────────── */}
      <section className="site-container py-16">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-fuchsia-700 dark:text-fuchsia-300">
              Məhsul nədir
            </span>
            <h2 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl">
              Sayt balansı,{" "}
              <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                kod şəklində
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
              Nominal seçib ödəyirsən, sənə 11 simvollu unikal kod verilir. Kodu
              kimə versən, o Honsell hesabına daxil olub cüzdanına köçürür və
              istədiyi məhsula xərcləyir — oyun, abunəlik, hədiyyə kartı.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Kodu sən özün də istifadə edə bilərsən — kart konkret hesaba bağlı
              deyil.
            </p>
          </div>

          <ul className="divide-y divide-zinc-200 dark:divide-white/10">
            {FACTS.map((f) => (
              <li key={f.title} className="group flex gap-5 py-6 first:pt-0 last:pb-0">
                <div className="w-[4.5rem] shrink-0 text-right sm:w-24">
                  <div className="text-2xl font-black leading-none tracking-tight text-fuchsia-600 sm:text-3xl dark:text-fuchsia-300">
                    {f.value}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <f.icon className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:text-fuchsia-500" />
                    <h3 className="text-base font-bold">{f.title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {f.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Necə aktivləşdirilir (admin paneldən) ───────────────────────── */}
      <ActivationStepsSection
        scope="GIFT_CARDS_HONSELL"
        id="aktivlesdirme"
        title="Hədiyyə kartı necə aktivləşdirilir?"
      />

      {/* ─── PS TRY kartına cross-sell ───────────────────────────────────── */}
      <section className="site-container pb-16">
        <Link
          href="/hediyye-kartlari"
          className="group relative flex items-center gap-4 overflow-hidden rounded-[22px] bg-gradient-to-r from-indigo-600/10 via-violet-600/10 to-transparent p-5 ring-1 ring-indigo-400/30 transition hover:ring-indigo-400/70"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/15 blur-2xl" />
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/25">
            <Gamepad2 className="h-6 w-6 !text-white" />
          </span>
          <div className="relative min-w-0 flex-1">
            <span className="text-base font-bold">PlayStation TRY Hədiyyə Kartı</span>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Türkiyə PSN wallet-i üçün rəsmi kod — oyun və abunəlik almaq üçün.
            </p>
          </div>
          <ArrowRight className="relative h-5 w-5 shrink-0 text-indigo-600 transition group-hover:translate-x-1 dark:text-indigo-300" />
        </Link>
      </section>
    </main>
  );
}
