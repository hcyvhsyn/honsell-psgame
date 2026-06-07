/**
 * "Məhsulu dostuna hədiyyə et" — kodlar 11 simvollu, böyük hərf/rəqəm.
 * Honsell hədiyyə kartı ilə eyni alfabet (0/O, 1/I/L istisna) ki, müştəri əl ilə
 * yazarkən səhv etməsin. Bu fayl server-only asılılıqlarından (prisma, crypto)
 * azaddır — client komponentlərdə də import oluna bilər.
 */
export const PRODUCT_GIFT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PRODUCT_GIFT_CODE_LENGTH = 11;
export const PRODUCT_GIFT_VALIDITY_DAYS = 365;

/** Hədiyyəni açma səhifəsinin yolu — email və UI-da istinad olunur. */
export const PRODUCT_GIFT_CLAIM_PATH = "/hediyye-ac";

/** İstifadəçi inputu — defislər, boşluqlar silinir, hər şey upper-case olur. */
export function normalizeProductGiftCode(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

export function isValidProductGiftFormat(code: string): boolean {
  if (code.length !== PRODUCT_GIFT_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!PRODUCT_GIFT_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Format: AAAA-BBB-CCCC (görüntüləmə üçün). Saxlanan dəyər həmişə defisiz. */
export function formatProductGiftCode(code: string): string {
  if (code.length !== PRODUCT_GIFT_CODE_LENGTH) return code;
  return `${code.slice(0, 4)}-${code.slice(4, 7)}-${code.slice(7)}`;
}

/** Məhsul tipi → istifadəçiyə göstərilən etiket (AZ). */
export function productGiftKindLabel(kind: string): string {
  switch (kind) {
    case "GAME":
      return "Oyun";
    case "PS_PLUS":
      return "PS Plus";
    case "EA_PLAY":
      return "EA Play";
    case "TRY_BALANCE":
      return "TRY Balans";
    case "STREAMING":
      return "Streaming abunəliyi";
    case "PLATFORM":
      return "Platforma abunəliyi";
    case "ACCOUNT_CREATION":
      return "PSN Hesab Açılışı";
    case "EPIC_ACCOUNT_CREATION":
      return "Epic Hesab Açılışı";
    case "HONSELL_GIFT_CARD":
      return "Honsell Hədiyyə Kartı";
    default:
      return "Məhsul";
  }
}

/**
 * Bu məhsul tipi açılarkən dostdan çatdırılma hesabı tələb edirmi?
 *   - PS oyunu / PS Plus / EA Play / TRY balans → PSN hesabı
 *   - Epic (PC) oyunu → Epic hesabı
 * Digər tiplər (streaming, platform, hesab açılışı və s.) hesab tələb etmir —
 * admin claim-dən sonra çatdırılma detalını adi qaydada toplayır.
 */
export function productGiftNeedsAccount(kind: string, store?: string | null): "PSN" | "EPIC" | null {
  if (kind === "GAME") return store === "EPIC" ? "EPIC" : "PSN";
  if (kind === "PS_PLUS" || kind === "EA_PLAY" || kind === "TRY_BALANCE") return "PSN";
  return null;
}
