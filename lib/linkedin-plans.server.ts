import "server-only";

import { prisma } from "@/lib/prisma";
import { discountPercent, type LinkedInVariant } from "@/lib/linkedin-plans";
import { readPlatformMeta } from "@/lib/platformSubscriptions";

// LinkedIn variantları admin paneldən /admin/work yolundan idarə olunur.
// ServiceProduct.metadata.category="WORK" + metadata.planType="CAREER"|"BUSINESS"
// olduqda /work/linkedin-premium səhifəsində uyğun qrupda görünür.
export async function getLinkedInVariants(): Promise<LinkedInVariant[]> {
  const products = await prisma.serviceProduct.findMany({
    where: { type: "PLATFORM", isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  const variants: LinkedInVariant[] = [];

  for (const p of products) {
    const meta = readPlatformMeta(p.metadata as Record<string, unknown> | null);
    if (meta.category !== "WORK") continue;
    if (!meta.planType) continue;
    if (!meta.durationMonths) continue;

    const oldCents = meta.originalPriceAznCents ?? null;

    variants.push({
      id: p.id,
      planType: meta.planType,
      durationMonths: meta.durationMonths,
      priceAznCents: p.priceAznCents,
      oldPriceAznCents: oldCents,
      discountPercent: discountPercent(oldCents, p.priceAznCents),
      isPopular: Boolean(meta.isPopular),
      title: p.title,
      imageUrl: p.imageUrl,
    });
  }

  return variants;
}
