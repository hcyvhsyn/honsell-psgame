import { prisma } from "@/lib/prisma";

export const EPIC_ACCOUNT_PRODUCT_TITLE = "Türkiyə Epic Games Hesabının Açılması";
export const EPIC_ACCOUNT_DEFAULT_PRICE_CENTS = 300; // 3.00 AZN

/**
 * Fetch the EPIC_ACCOUNT_CREATION ServiceProduct, creating it with the default
 * 3 AZN price on first access so the offer modal always has a product to add.
 */
export async function getOrCreateEpicAccountProduct() {
  const existing = await prisma.serviceProduct.findFirst({
    where: { type: "EPIC_ACCOUNT_CREATION" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.serviceProduct.create({
    data: {
      type: "EPIC_ACCOUNT_CREATION",
      title: EPIC_ACCOUNT_PRODUCT_TITLE,
      priceAznCents: EPIC_ACCOUNT_DEFAULT_PRICE_CENTS,
      isActive: true,
      metadata: {},
    },
  });
}
