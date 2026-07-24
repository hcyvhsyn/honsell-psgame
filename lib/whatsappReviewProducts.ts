/**
 * WhatsApp rəy dəvətində seçilə bilən məhsullar — oyun (`Game`) VƏ ya xidmət
 * (`ServiceProduct`). Satış qeydi və rəy kateqoriyası məntiqi POST route ilə
 * `/rey/[token]/verify` arasında ortaqdır ki, iki yerdə fərqlənməsin.
 */

export type ReviewItemKind = "GAME" | "SERVICE";

/** Rəy picker-ində seçilə bilən xidmət tipləri (oyunlar ayrıca `Game`-dən gəlir). */
export const REVIEW_SERVICE_TYPES = [
  "STREAMING",
  "PLATFORM",
  "PS_PLUS",
  "EA_PLAY",
  "ACCOUNT_CREATION",
  "EPIC_ACCOUNT_CREATION",
] as const;

/** Dəvətin `products` JSON-unda saxlanan bir element. */
export type InviteProduct = {
  kind: ReviewItemKind;
  id: string;
  title: string;
  priceAznCents: number;
  type: string; // GAME (Game.store) və ya ServiceProduct.type
};

/** Satış yaratmaq üçün lazım olan minimal element. */
export type InviteSaleItem = { kind: ReviewItemKind; id: string; priceAznCents: number };

/**
 * Dəvətin `products` JSON-undan satış elementlərini çıxarır. `kind` yoxdursa
 * (köhnə, yalnız-xidmət dəvətləri) SERVICE qəbul olunur. Boş nəticədə köhnə
 * tək-məhsullu dəvətlər üçün serviceProductId/priceAznCents fallback-ı işləyir.
 */
export function parseInviteSaleItems(
  raw: unknown,
  fallback: { serviceProductId: string | null; priceAznCents: number | null }
): InviteSaleItem[] {
  if (Array.isArray(raw)) {
    const list = raw
      .map((p): InviteSaleItem | null => {
        const obj = p as { id?: unknown; priceAznCents?: unknown; kind?: unknown };
        const id = typeof obj?.id === "string" ? obj.id : null;
        const price = Number(obj?.priceAznCents);
        if (!id || !Number.isFinite(price)) return null;
        const kind: ReviewItemKind = obj?.kind === "GAME" ? "GAME" : "SERVICE";
        return { kind, id, priceAznCents: price };
      })
      .filter((p): p is InviteSaleItem => p !== null);
    if (list.length > 0) return list;
  }
  if (fallback.serviceProductId && fallback.priceAznCents != null) {
    return [{ kind: "SERVICE", id: fallback.serviceProductId, priceAznCents: fallback.priceAznCents }];
  }
  return [];
}

/**
 * Bir satış elementi üçün Transaction.create data-sı. Oyun → PURCHASE (gameId),
 * xidmət → SERVICE_PURCHASE (serviceProductId). walletBalance-a toxunmur (mənfi
 * məbləğ yalnız qeyd üçündür, tarixçədə "artıq təhvil verilib" markeri).
 */
export function reviewSaleTxnData(userId: string, item: InviteSaleItem) {
  const isGame = item.kind === "GAME";
  return {
    userId,
    type: isGame ? "PURCHASE" : "SERVICE_PURCHASE",
    status: "SUCCESS",
    ...(isGame ? { gameId: item.id } : { serviceProductId: item.id }),
    amountAznCents: -item.priceAznCents,
    metadata: "whatsapp-review-invite",
  };
}

/**
 * Rəy kateqoriyası (Testimonial.platform) — seçilmiş məhsulun tipindən çıxarılır.
 * Admin əl ilə override etməyibsə bu istifadə olunur.
 */
export function derivePlatform(kind: ReviewItemKind, type: string, store?: string | null): string {
  if (kind === "GAME") return store === "EPIC" ? "EPIC_GAMES" : "GAME";
  switch (type) {
    case "STREAMING":
      return "STREAMING";
    case "PLATFORM":
      return "MUSIC";
    case "PS_PLUS":
      return "PS_PLUS";
    case "EA_PLAY":
      return "EA_PLAY";
    case "ACCOUNT_CREATION":
    case "EPIC_ACCOUNT_CREATION":
      return "ACCOUNT_CREATION";
    default:
      return "GAME";
  }
}
