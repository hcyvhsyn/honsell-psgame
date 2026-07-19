import { prisma } from "@/lib/prisma";
import WhatsappAdminTabs from "./WhatsappAdminTabs";

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp Rəy &amp; Sorğu</h1>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Yeni müştərilərdən rəy toplayın, abunəliyi bitib davam etməyənlərdən isə səbəbini soruşun.
        </p>
      </div>
      <WhatsappAdminTabs products={options} />
    </div>
  );
}
