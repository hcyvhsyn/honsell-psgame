import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import InGameCreditClient from "@/components/InGameCreditClient";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Point Blank TG paketləri — Honsell Store",
  description:
    "Point Blank üçün TG (turqid/zəng) paketlərini sərfəli qiymətə əldə et. Rəsmi e-pin kodları və sürətli çatdırılma.",
  alternates: { canonical: "/point-blank" },
  openGraph: {
    title: "Point Blank TG Azərbaycan | Honsell Store",
    description:
      "Point Blank TG paketləri — rəsmi e-pin kodları ilə anlıq çatdırılma.",
    url: "/point-blank",
  },
};

const usageSteps = [
  {
    title: "pb.tamgame.com saytına keçid edin",
    body: "Point Blank-in rəsmi TamGame səhifəsini açın.",
  },
  {
    title: "TamGame hesabınıza daxil olun",
    body: "Sayta üzv olduğunuz hesab məlumatları ilə giriş edin.",
  },
  {
    title: "“TG Yüklə” düyməsini seçin",
    body: "Ana səhifədə yerləşən TG yükləmə bölməsinə keçin.",
  },
  {
    title: "“E-Pin” metodunu seçin",
    body: "Açılan səhifədə ödəniş metodu kimi E-Pin bölməsini işarələyin.",
  },
  {
    title: "Kod və şifrə xanalarını doldurun",
    body: "Satın aldığınız E-Pin məlumatlarını “Kod” və “Şifrə” xanalarına tam şəkildə daxil edin.",
  },
  {
    title: "“Davam” düyməsinə klikləyin",
    body: "Təsdiqdən sonra TG balansınız Point Blank hesabınıza yüklənəcək.",
  },
];

const searchTopics = [
  "Point Blank TG necə yüklənir?",
  "Point Blank E-Pin kodu necə istifadə olunur?",
  "Point Blank TG almaq",
  "pb.tamgame.com TG yükləmə qaydası",
  "Point Blank oyun valyutası yükləmə",
];

export default async function PointBlankPage() {
  const plans = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "POINT_BLANK_TG" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <header className="sr-only">
        <h1>Point Blank TG</h1>
        <p>
          Point Blank-da silah, kostyum, klan üzvlüyü və oyun-içi alış-verişlər
          üçün TG paketləri.
        </p>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <InGameCreditClient
          plans={plans.map((p) => ({
            id: p.id,
            title: p.title,
            priceAznCents: p.priceAznCents,
            description: p.description,
            imageUrl: p.imageUrl,
            metadata:
              (p.metadata as { amount?: number; currency?: string } | null) ?? null,
          }))}
          productType="POINT_BLANK_TG"
          brand="Point Blank"
          currencyLabel="TG"
          brandSubtitle="Point Blank TG paketləri — silah, kostyum, klan üzvlüyü və bütün oyun-içi alış-verişlər üçün."
          imageShape="square"
        />
      </section>

      <section
        aria-labelledby="point-blank-info"
        className="mx-auto max-w-7xl px-4 pb-28 sm:px-6 sm:pb-16 lg:px-8"
      >
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              Məhsul haqqında məlumat
            </p>
            <h2
              id="point-blank-info"
              className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl"
            >
              Point Blank TG E-Pin istifadə qaydası
            </h2>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              Point Blank oyununa E-Pin vasitəsilə TG (TamGame valyutası)
              yükləmək istəyirsinizsə, aşağıdakı addımları izləyərək prosesi
              rahat tamamlayın.
            </p>

            <a
              href="https://pb.tamgame.com"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/15"
            >
              pb.tamgame.com
              <ExternalLink className="h-4 w-4" />
            </a>

            <div className="mt-7 space-y-5 border-t border-white/10 pt-6">
              <InfoLine
                icon={<WalletCards className="h-5 w-5" />}
                title="TG (TamGold) nədir?"
                body="Point Blank oyununda istifadə olunan rəsmi oyun valyutasıdır."
              />
              <InfoLine
                icon={<KeyRound className="h-5 w-5" />}
                title="E-Pin nə üçündür?"
                body="TG yükləməyin rahat və təhlükəsiz yoludur; kodu rəsmi TamGame səhifəsində aktivləşdirirsiniz."
              />
              <InfoLine
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Kodlar necə təhvil verilir?"
                body="Bizdən aldığınız E-Pin kodları orijinal, işlək və istifadəyə hazır şəkildə təqdim olunur."
              />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-violet-300/15 bg-[linear-gradient(135deg,rgba(124,58,237,0.14),rgba(9,9,11,0.92))] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-100">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Addım-addım təlimat</h3>
                <p className="text-sm text-zinc-400">E-Pin kodunu TG balansına çevirmək üçün.</p>
              </div>
            </div>

            <ol className="mt-6 space-y-4">
              {usageSteps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                    <h4 className="text-sm font-black text-white">{step.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-black text-emerald-100">Uğurla tamamladınız!</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-50/80">
                    TG hesabınıza əlavə olunduqdan sonra silah skinləri, kostyumlar,
                    təkmilləşdirmələr və digər oyundaxili alış-verişlərdən istifadə edə bilərsiniz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {searchTopics.map((topic) => (
            <span
              key={topic}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-400"
            >
              {topic}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

function InfoLine({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-emerald-200">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-black text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
      </div>
    </div>
  );
}
