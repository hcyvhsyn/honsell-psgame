import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import HesabAcmaPageClient from "./HesabAcmaPageClient";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Türkiyə PSN Hesabı Açma — PlayStation Network",
  description:
    "Türkiyə PSN hesabınızı peşəkarlarımız sizin üçün açsın. Tam doğrulanmış hesab, etibarlı proses, qısa müddətdə təhvil.",
  alternates: { canonical: "/hesab-acma" },
  openGraph: {
    title: "Türkiyə PSN Hesabı Açma Xidməti | Honsell PS Store",
    description:
      "Tam doğrulanmış Türkiyə PlayStation Network hesabı — peşəkarlarımız sizin üçün açır.",
    url: "/hesab-acma",
  },
};

export default async function HesabAcmaPage() {
  const service = await prisma.serviceProduct.findFirst({
    where: { isActive: true, type: "ACCOUNT_CREATION" },
  });

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-zinc-100 p-8 shadow-[0_24px_72px_-56px_rgba(217,70,239,0.48)] dark:border-fuchsia-500/30 dark:bg-gradient-to-br dark:from-fuchsia-700/20 dark:via-zinc-900/50 dark:to-zinc-950 dark:shadow-none sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/50 bg-fuchsia-50 px-3 py-1 text-xs text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-200">
            <UserPlus className="h-3.5 w-3.5" />
            Türkiyə PSN Hesab Açma
          </div>
          <h1 className="mt-4 text-3xl font-black text-zinc-950 dark:text-white sm:text-4xl">
            Yeni Türkiyə PSN hesabı
            <br />
            sizin məlumatlarınızla hazırlanır
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Ad, soyad, doğum tarixi, e-poçt və ən azı 8 simvolluq şifrə məlumatlarınızı təqdim edirsiniz; ödənişdən sonra sifariş
            admin panelində icra olunur.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs text-zinc-500 dark:text-zinc-500">Qiymət</p>
              <p className="text-2xl font-black text-fuchsia-700 dark:text-fuchsia-300">
                {service ? (service.priceAznCents / 100).toFixed(2) : "3.00"} ₼
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs text-zinc-500 dark:text-zinc-500">İcra növü</p>
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">Manual admin icrası</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs text-zinc-500 dark:text-zinc-500">Status</p>
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">PENDING → SUCCESS</p>
            </div>
          </div>

          <div className="mt-7">
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
              <p className="text-sm text-amber-400">Hesab açılışı xidməti hazırda aktiv deyil.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
