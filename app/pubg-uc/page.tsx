import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import InGameCreditClient from "@/components/InGameCreditClient";
import { Globe, ShieldCheck, Sparkles, Zap } from "lucide-react";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "PUBG UC paketləri — Honsell PS Store",
  description:
    "PUBG Mobile üçün UC paketlərini sərfəli qiymətə əldə et. E-PIN kod və ya ID yükləmə — rəsmi kodlar, sürətli çatdırılma, etibarlı satıcı.",
  alternates: { canonical: "/pubg-uc" },
  openGraph: {
    title: "PUBG UC Azərbaycan | Honsell PS Store",
    description:
      "PUBG Mobile UC paketləri — E-PIN kod və ya ID yükləmə ilə anlıq çatdırılma.",
    url: "/pubg-uc",
  },
};

export default async function PubgUcPage() {
  const plans = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: "PUBG_UC" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <header className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          PUBG UC
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          PUBG Mobile-da skinlər, Royale Pass və bütün daxili alış-verişlər üçün
          UC paketləri. E-PIN kod və ya birbaşa ID yükləmə seçimi ilə.
        </p>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <InGameCreditClient
          plans={plans.map((p) => ({
            id: p.id,
            title: p.title,
            priceAznCents: p.priceAznCents,
            description: p.description,
            imageUrl: p.imageUrl,
            metadata:
              (p.metadata as {
                amount?: number;
                currency?: string;
                deliveryMethod?: "EPIN" | "ID_TOPUP";
              } | null) ?? null,
          }))}
          productType="PUBG_UC"
          brand="PUBG Mobile"
          currencyLabel="UC"
          brandSubtitle="PUBG Mobile UC paketləri — Royale Pass, skinlər, silah kostyumları və bütün oyun-içi alış-verişlər üçün."
        />
      </section>

      {/* About PUBG Mobile */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            PUBG Mobile haqqında
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-300">
            <p>
              PUBG Mobile, Tencent Games tərəfindən hazırlanan və yayımlanan
              məşhur battle royale oyunudur. Oyunçular geniş bir xəritədə sağ
              qalmaq üçün döyüşürkən silah və avadanlıqlar toplayırlar. Oyun
              həm solo, həm də komanda əsaslı rejimlər təklif edir.
            </p>
            <p>
              Müxtəlif xəritə və rejimlərlə zəngin təcrübə təqdim edir.
              Oyunçular strateji düşüncə və sürətli refleksə güvənərək
              rəqibləri məğlub etməyə çalışır. PUBG Mobile mütəmadi yeniləmələr
              və tədbirlərlə daim yenilik təklif edir.
            </p>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            <FeatureRow
              icon={<Sparkles className="h-5 w-5" />}
              title="Kozmetik və daxili əşyalar"
              body="UC ilə skinlər, Royale Pass, mythic əşyalar və bütün oyun-içi alış-verişlər."
            />
            <FeatureRow
              icon={<Globe className="h-5 w-5" />}
              title="Dünya çapında etibarlıdır"
              body="Kod istənilən regionda istifadə edilə bilər və dərhal aktivləşir."
            />
            <FeatureRow
              icon={<Zap className="h-5 w-5" />}
              title="Sürətli çatdırılma"
              body="Ödəniş təsdiqindən sonra kodu emaillə və ya birbaşa hesabınıza yükləyirik."
            />
            <FeatureRow
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Təhlükəsiz alış-veriş"
              body="Yalnız rəsmi kanaldan əldə olunan kodlar — saxta UC, ban riski yoxdur."
            />
          </ul>
        </div>
      </section>
    </main>
  );
}

function FeatureRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3 rounded-2xl border border-white/5 bg-zinc-950/50 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
        {icon}
      </span>
      <div>
        <div className="text-sm font-bold text-white">{title}</div>
        <p className="mt-0.5 text-xs text-zinc-400">{body}</p>
      </div>
    </li>
  );
}
