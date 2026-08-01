import { prisma } from "./prisma";
import type { DisplayPrice } from "./pricing";

/**
 * Ana səhifədəki "Fürsətləri qaçırma" bölməsinin qiymət override məntiqi.
 *
 * `FlashDeal` sətri kataloqdakı oyunun avtomatik qiymətini əvəz edə bilər.
 * Vitrində göstərilən qiymət kassada tutulan qiymətlə eyni olsun deyə eyni
 * helper həm ana səhifədə, həm `/api/cart/checkout`, `/api/cart/refresh` və
 * birbaşa alış yollarında istifadə olunur — yəni override tək yerdə tətbiq
 * edilir, hər çağırış yerində təkrarlanmır.
 */

export type FlashDealOverride = {
  priceAznCents: number | null;
  originalAznCents: number | null;
  endsAt: Date | null;
};

/** Təklif hazırda qüvvədədirmi (aktivdir və vaxtı bitməyib). */
export function isFlashDealLive(deal: { isActive: boolean; endsAt: Date | null }, now = new Date()): boolean {
  if (!deal.isActive) return false;
  return deal.endsAt == null || deal.endsAt.getTime() > now.getTime();
}

/**
 * Verilmiş oyunlar üçün qüvvədə olan override-ları `gameId → override` map kimi
 * qaytarır. Heç bir oyun ötürülməyibsə DB-yə getmir.
 */
export async function getFlashDealOverrides(gameIds: string[]): Promise<Map<string, FlashDealOverride>> {
  const ids = Array.from(new Set(gameIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const now = new Date();
  const deals = await prisma.flashDeal
    .findMany({
      where: {
        gameId: { in: ids },
        isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { gameId: true, priceAznCents: true, originalAznCents: true, endsAt: true },
    })
    .catch(() => []);

  return new Map(
    deals.map((d) => [
      d.gameId,
      { priceAznCents: d.priceAznCents, originalAznCents: d.originalAznCents, endsAt: d.endsAt },
    ]),
  );
}

/**
 * `computeDisplayPrice` nəticəsinə flash-deal override-ını tətbiq edir.
 *
 * Qayda: override yalnız qiyməti AŞAĞI sala bilər. Admin səhvən kataloq
 * qiymətindən baha rəqəm yazsa, müştəri baha qiymət ödəmir — override sadəcə
 * nəzərə alınmır. Endirim faizi həmişə göstərilən köhnə qiymətdən hesablanır.
 */
export function applyFlashDeal(price: DisplayPrice, override?: FlashDealOverride | null): DisplayPrice {
  if (!override) return price;

  const finalAzn =
    override.priceAznCents != null && override.priceAznCents > 0 && override.priceAznCents / 100 < price.finalAzn
      ? override.priceAznCents / 100
      : price.finalAzn;

  const overrideOriginal =
    override.originalAznCents != null && override.originalAznCents > 0 ? override.originalAznCents / 100 : null;
  const originalAzn = overrideOriginal ?? price.originalAzn;

  // Köhnə qiymət yeni qiymətdən aşağıdırsa üstündən xətt çəkməyin mənası yoxdur.
  const showOriginal = originalAzn != null && originalAzn > finalAzn ? originalAzn : null;

  return {
    finalAzn,
    originalAzn: showOriginal,
    discountPct: showOriginal != null ? Math.round((1 - finalAzn / showOriginal) * 100) : null,
  };
}
