import { prisma } from "@/lib/prisma";

/** Testimonial.platform üçün icazə verilən kobud kateqoriyalar. */
export type TestimonialPlatform = "GAME" | "PS_PLUS" | "GIFT_CARD" | "ACCOUNT_CREATION";

export type PurchasedProduct = {
  /** title əsaslı stabil açar — modal seçimi və validasiya üçün. */
  key: string;
  title: string;
  platform: TestimonialPlatform;
};

/** ServiceProduct.type → Testimonial.platform kobud kateqoriyası. */
function serviceTypeToPlatform(type: string): TestimonialPlatform {
  switch (type) {
    case "PS_PLUS":
      return "PS_PLUS";
    case "TRY_BALANCE":
    case "HONSELL_GIFT_CARD":
      return "GIFT_CARD";
    case "ACCOUNT_CREATION":
    case "EPIC_ACCOUNT_CREATION":
      return "ACCOUNT_CREATION";
    default:
      // STREAMING, PLATFORM, EA_PLAY, PUBG_UC, POINT_BLANK_TG və s. — kobud
      // kateqoriya yoxdur; konkret ad productTitle-da saxlanır.
      return "GAME";
  }
}

/**
 * İstifadəçinin uğurla aldığı məhsulların təkrarsız siyahısı (ad + kobud
 * kateqoriya). Həm anasayfa rəy modalında seçim üçün, həm də rəy göndərişində
 * "bu məhsulu həqiqətən almısan?" validasiyası üçün istifadə olunur.
 */
export async function getUserPurchasedProducts(userId: string): Promise<PurchasedProduct[]> {
  const rows = await prisma.transaction
    .findMany({
      where: {
        userId,
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        game: { select: { title: true } },
        serviceProduct: { select: { title: true, type: true } },
      },
    })
    .catch(() => []);

  const byTitle = new Map<string, PurchasedProduct>();
  for (const row of rows) {
    let title: string | null = null;
    let platform: TestimonialPlatform = "GAME";

    if (row.game?.title) {
      title = row.game.title;
      platform = "GAME";
    } else if (row.serviceProduct?.title) {
      title = row.serviceProduct.title;
      platform = serviceTypeToPlatform(row.serviceProduct.type);
    }

    if (!title) continue;
    if (byTitle.has(title)) continue;
    byTitle.set(title, { key: title, title, platform });
  }

  return [...byTitle.values()];
}

export type ReviewablePurchase = {
  /** Alış əməliyyatının id-si — rəy bu konkret alışa bağlanır (cashback üçün). */
  transactionId: string;
  title: string;
  platform: TestimonialPlatform;
  /** Ödənilmiş məbləğ (qəpik, müsbət). Cashback bunun üzərindən hesablanır. */
  priceAznCents: number;
};

/**
 * İstifadəçinin uğurlu alışları — hələ rəy yazılmamış olanlar (Testimonial.
 * transactionId-də olmayanlar). Hər sətir bir konkret alışdır: rəy modalı
 * məhsul + qiymət göstərir, rəy həmin alışa bağlanıb 1% cashback hesablanır.
 */
export async function getUserReviewablePurchases(userId: string): Promise<ReviewablePurchase[]> {
  const rows = await prisma.transaction
    .findMany({
      where: {
        userId,
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountAznCents: true,
        game: { select: { title: true } },
        serviceProduct: { select: { title: true, type: true } },
      },
    })
    .catch(() => []);

  if (rows.length === 0) return [];

  // Artıq rəy yazılmış alışları çıxar (Testimonial.transactionId).
  const reviewed = await prisma.testimonial
    .findMany({
      where: { transactionId: { in: rows.map((r) => r.id) } },
      select: { transactionId: true },
    })
    .catch(() => []);
  const reviewedIds = new Set(reviewed.map((t) => t.transactionId).filter(Boolean) as string[]);

  const out: ReviewablePurchase[] = [];
  for (const row of rows) {
    if (reviewedIds.has(row.id)) continue;

    let title: string | null = null;
    let platform: TestimonialPlatform = "GAME";
    if (row.game?.title) {
      title = row.game.title;
      platform = "GAME";
    } else if (row.serviceProduct?.title) {
      title = row.serviceProduct.title;
      platform = serviceTypeToPlatform(row.serviceProduct.type);
    }
    if (!title) continue;

    out.push({
      transactionId: row.id,
      title,
      platform,
      priceAznCents: Math.abs(row.amountAznCents),
    });
  }

  return out;
}
