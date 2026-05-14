import type { Metadata } from "next";
import Link from "next/link";
import { Gift, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { HONSELL_GIFT_CARD_SERVICE_TYPE } from "@/lib/honsellGiftCard";
import HonsellGiftCardsClient from "./HonsellGiftCardsClient";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Honsell Hədiyyə Kartları — 5/10/20/50/100/200/500/1000 AZN",
  description:
    "Honsell Store-da istifadə üçün hədiyyə kartları. 11 simvollu unikal kod ilə anında çatdırılma — istənilən istifadəçi cüzdanına aktivləşdirə bilər.",
  alternates: { canonical: "/hediyye-kartlari/honsell" },
  openGraph: {
    title: "Honsell Hədiyyə Kartları | Honsell PS Store",
    description:
      "Honsell hədiyyə kartı al, 11 simvollu unikal kod əldə et və hədiyyə et. Aktivləşdirildikdə tam məbləğ cüzdana köçürülür.",
    url: "/hediyye-kartlari/honsell",
  },
};

export default async function HonsellGiftCardsPage() {
  const cards = await prisma.serviceProduct.findMany({
    where: { isActive: true, type: HONSELL_GIFT_CARD_SERVICE_TYPE },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 via-fuchsia-700/10 to-zinc-900/40 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
            <Gift className="h-3.5 w-3.5" />
            Honsell Hədiyyə Kartı
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            Honsell Hədiyyə Kartları
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-300">
            Sevdiklərinə Honsell Store balansı hədiyyə et. Alış zamanı 11 simvollu
            unikal kod yaranır — istənilən istifadəçi həmin kodu sayta daxil edərək
            cüzdan balansına məbləği köçürə bilər. Kartın müddəti 1 ildir.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
              <div>
                <div className="text-sm font-semibold text-white">Anında çatdırılma</div>
                <p className="mt-1 text-xs text-zinc-400">Ödəniş tamamlandığı an kod email-ə və sifarişlərə düşür.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
              <div>
                <div className="text-sm font-semibold text-white">11 simvollu unikal kod</div>
                <p className="mt-1 text-xs text-zinc-400">Hər kart yalnız bir dəfə istifadə oluna bilər.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
              <div>
                <div className="text-sm font-semibold text-white">Cüzdana köçürmə</div>
                <p className="mt-1 text-xs text-zinc-400">
                  Aktivləşdirmə {" "}
                  <Link href="/profile/hediyye-kart" className="text-violet-300 hover:underline">
                    Profil → Hədiyyə kart
                  </Link>{" "}
                  bölməsindən.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <HonsellGiftCardsClient
          cards={cards.map((c) => {
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
          })}
        />
      </section>
    </main>
  );
}
