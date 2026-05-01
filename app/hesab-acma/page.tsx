import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import HesabAcmaPageClient from "./HesabAcmaPageClient";

export const dynamic = "force-dynamic";

export default async function HesabAcmaPage() {
  const service = await prisma.serviceProduct.findFirst({
    where: { isActive: true, type: "ACCOUNT_CREATION" },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-700/20 via-zinc-900/50 to-zinc-950 p-8 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">
            <UserPlus className="h-3.5 w-3.5" />
            Türkiyə PSN Hesab Açma
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            Yeni Türkiyə PSN hesabı
            <br />
            sizin məlumatlarınızla hazırlanır
          </h1>
          <p className="mt-3 max-w-xl text-sm text-zinc-400">
            Ad, soyad, doğum tarixi, e-poçt və ən azı 8 simvolluq şifrə məlumatlarınızı təqdim edirsiniz; ödənişdən sonra sifariş
            admin panelində icra olunur.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-500">Qiymət</p>
              <p className="text-2xl font-black text-fuchsia-300">
                {service ? (service.priceAznCents / 100).toFixed(2) : "3.00"} ₼
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-500">İcra növü</p>
              <p className="text-sm font-semibold text-white">Manual admin icrası</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-500">Status</p>
              <p className="text-sm font-semibold text-white">PENDING → SUCCESS</p>
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
