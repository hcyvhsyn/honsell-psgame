import { prisma } from "@/lib/prisma";
import TestimonialsAdminClient, { type AdminTestimonial } from "./TestimonialsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const rows = await prisma.testimonial.findMany({
    orderBy: [{ isActive: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      text: true,
      rating: true,
      platform: true,
      productTitle: true,
      isActive: true,
      sortOrder: true,
      transactionId: true,
      createdAt: true,
    },
  });

  const testimonials: AdminTestimonial[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    text: r.text,
    rating: r.rating,
    platform: r.platform,
    productTitle: r.productTitle,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    fromPurchase: r.transactionId != null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Müştəri Rəyləri (Anasayfa)</h1>
        <p className="text-sm text-zinc-600">
          Anasayfadakı &ldquo;Müştərilər nə deyir&rdquo; bölməsində göstərilən rəylər.
          Alış sonrası email dəvəti ilə gələn rəylər avtomatik aktivdir; müştərinin
          saytdan könüllü yazdığı rəylər təsdiq gözləyir. Aktivləşdir, deaktiv et və ya sil.
        </p>
      </div>

      <TestimonialsAdminClient initial={testimonials} />
    </div>
  );
}
