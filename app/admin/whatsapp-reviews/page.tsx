import { prisma } from "@/lib/prisma";
import WhatsappReviewsAdminClient from "./WhatsappReviewsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminWhatsappReviewsPage() {
  const products = await prisma.serviceProduct
    .findMany({
      where: { isActive: true, type: { in: ["STREAMING", "PLATFORM"] } },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { priceAznCents: "asc" }],
      select: { id: true, title: true, priceAznCents: true, type: true },
    })
    .catch(() => []);

  const options = products.map((p) => ({
    id: p.id,
    title: p.title,
    priceAzn: p.priceAznCents / 100,
    type: p.type,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp Rəy Dəvəti</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Abunəliyini WhatsApp-dan alan müştərilər üçün. Müştərinin aldığı məhsulu seçin,
          telefon nömrəsini yazın — sistem WhatsApp-a rəy linki göndərir. Nömrə bazada varsa,
          müştəri avtomatik tanınır (təkrar qeydiyyat olmur, sadəcə rəy yazır). Qeyd edilən hər
          satış anasayfadakı sifariş sayı və “ən çox alınanlar”a əlavə olunur.
        </p>
      </div>
      <WhatsappReviewsAdminClient products={options} />
    </div>
  );
}
