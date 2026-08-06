import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gift, ShieldCheck, Sparkles, Wallet, Zap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import ActivationStepsSection from "@/components/ActivationStepsSection";
import { SectionFlowDivider } from "@/components/MarketingUI";
import ScrollAnimationManager from "@/components/ScrollAnimationManager";
import GiftCardHero from "./GiftCardHero";
import HediyyeKartlariClient from "./HediyyeKartlariClient";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "PlayStation Hədiyyə Kartları — TRY Wallet Kodları",
  description:
    "Türkiyə PSN üçün hədiyyə kartları və wallet top-up kodları. Anında e-pin çatdırılması, etibarlı ödəniş, ən sərfəli kurs.",
  alternates: { canonical: "/hediyye-kartlari" },
  openGraph: {
    title: "PlayStation Hədiyyə Kartları — TRY Wallet Kodları | Honsell Store",
    description:
      "Türkiyə PSN wallet-i üçün anında e-pin kodlar. Ən sərfəli kursla TRY balansı.",
    url: "/hediyye-kartlari",
  },
};

/**
 * «Məhsul nədir» bölməsinin sağ sütunu — eyni ölçülü 3 kart əvəzinə hairline
 * ayırıcılı sətirlər. Hər sətrin solunda BÖYÜK rəqəm/dəyər var: skan edilə bilən
 * və vizual olaraq maraqlıdır, 3 dəfə təkrarlanan kart çərçivəsi isə deyil.
 */
const FACTS = [
  {
    icon: Zap,
    value: "0 dəq",
    title: "Gözləmə yoxdur",
    text: "Stokda kod olan nominallarda sifariş ödənişdən dərhal sonra tamamlanır.",
  },
  {
    icon: ShieldCheck,
    value: "12",
    title: "Simvollu rəsmi kod",
    text: "Birbaşa mağaza e-pin-i — hesabın risk altına düşmür.",
  },
  {
    icon: Wallet,
    value: "TRY",
    title: "Wallet balansı",
    text: "Kod PSN-də istifadə olunur, balansla oyun, DLC və abunəlik alırsan.",
  },
] as const;

/**
 * Səhifə QƏSDƏN qısa saxlanılıb: hero → nominallar → «məhsul nədir» → addımlar.
 * Uzun izahlar silinib, çünki müştəri ilk ekranda qiyməti görməlidir. Vizual
 * ağırlıq (gradient hero, CSS kart, marquee ayırıcı) mətnlə deyil, dizaynla
 * yaradılır. Aktivləşdirmə addımları admin panelindən gəlir, burda hardcode YOX.
 */
export default async function HediyyeKartlariPage() {
  const cards = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "TRY_BALANCE" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    include: { _count: { select: { codes: { where: { isUsed: false } } } } },
  });

  const tryAmounts = cards
    .map((c) => Number((c.metadata as Record<string, unknown> | null)?.tryAmount))
    .filter((n) => Number.isFinite(n) && n > 0);
  const topTry = tryAmounts.length ? Math.max(...tryAmounts) : null;
  const fromAzn = cards.length ? Math.min(...cards.map((c) => c.priceAznCents)) / 100 : null;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <SiteHeaderServer />
      <ScrollAnimationManager />

      <GiftCardHero topTry={topTry} fromAzn={fromAzn} />

      {/* ─── Nominallar ──────────────────────────────────────────────────── */}
      <SectionFlowDivider text="Məbləği seç" tone="indigo" />

      <section id="kartlar" className="site-container scroll-mt-24 pb-4">
        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Hazırda aktiv hədiyyə kartı yoxdur.
          </div>
        ) : (
          <HediyyeKartlariClient
            cards={cards.map((c) => ({
              id: c.id,
              title: c.title,
              imageUrl: c.imageUrl,
              priceAznCents: c.priceAznCents,
              metadata: (c.metadata as Record<string, unknown> | null) ?? null,
              _count: { codes: c._count.codes },
            }))}
          />
        )}
      </section>

      {/* ─── Məhsul nədir ──────────────────────────────────────────────────
          Asimmetrik: sol sütun izah + böyük tipoqrafiya, sağ sütun faktlar.
          Simmetrik 3 kart sırası bilərəkdən tərk edildi — eyni çərçivənin üç
          dəfə təkrarı bölməni "boş" göstərirdi. */}
      <section className="site-container py-16">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
              Məhsul nədir
            </span>
            <h2 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl">
              Rəsmi{" "}
              <span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">
                wallet kodu
              </span>
              , başqa heç nə
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
              Türkiyə PlayStation Store üçün 12 simvollu kod alırsan. Kodu PSN
              hesabına daxil edirsən, məbləğ TRY balansına düşür — sonra oyun,
              DLC və ya abunəlik alırsan. Hesab paylaşımı, şifrə dəyişikliyi və
              ya gözləmə yoxdur.
            </p>
          </div>

          <ul className="divide-y divide-zinc-200 dark:divide-white/10">
            {FACTS.map((f) => (
              <li key={f.title} className="group flex gap-5 py-6 first:pt-0 last:pb-0">
                <div className="w-[4.5rem] shrink-0 text-right sm:w-24">
                  <div className="text-2xl font-black leading-none tracking-tight text-violet-600 sm:text-3xl dark:text-violet-300">
                    {f.value}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <f.icon className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:text-violet-500" />
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

      {/* ─── Necə aktivləşdirilir (admin paneldən) ─────────────────────────
          Burda ikinci marquee zolağı QOYULMUR — bölmənin öz başlığı eyni şeyi
          deyir, iki dəfə qışqırmaq səhifəni yenidən yükləyir. */}
      <ActivationStepsSection
        scope="GIFT_CARDS_TRY"
        id="aktivlesdirme"
      />

      {/* ─── Honsell hədiyyə kartı (cross-sell) ─────────────────────────── */}
      <section className="site-container pb-16">
        <Link
          href="/hediyye-kartlari/honsell"
          className="group relative flex items-center gap-4 overflow-hidden rounded-[22px] bg-gradient-to-r from-violet-600/10 via-fuchsia-600/10 to-transparent p-5 ring-1 ring-violet-400/30 transition hover:ring-violet-400/70"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-2xl" />
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-600/25">
            <Sparkles className="h-6 w-6 !text-white" />
          </span>
          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">Honsell Hədiyyə Kartı</span>
              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider !text-white">
                Yeni
              </span>
            </div>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Sayt balansı hədiyyə et — 5 AZN-dən 1000 AZN-ə qədər, unikal kodla.
            </p>
          </div>
          <ArrowRight className="relative h-5 w-5 shrink-0 text-violet-600 transition group-hover:translate-x-1 dark:text-violet-300" />
        </Link>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
          <Gift className="h-3.5 w-3.5" />
          Sual var? Dəstək 24/7 aktivdir.
        </p>
      </section>
    </main>
  );
}
