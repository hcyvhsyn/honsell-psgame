import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  PRODUCT_GIFT_CODE_ALPHABET,
  PRODUCT_GIFT_CODE_LENGTH,
} from "@/lib/productGiftShared";

export {
  PRODUCT_GIFT_CODE_LENGTH,
  PRODUCT_GIFT_VALIDITY_DAYS,
  PRODUCT_GIFT_CLAIM_PATH,
  normalizeProductGiftCode,
  isValidProductGiftFormat,
  formatProductGiftCode,
  productGiftKindLabel,
  productGiftNeedsAccount,
} from "@/lib/productGiftShared";

function randomCode(): string {
  const bytes = randomBytes(PRODUCT_GIFT_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < PRODUCT_GIFT_CODE_LENGTH; i++) {
    out += PRODUCT_GIFT_CODE_ALPHABET[bytes[i] % PRODUCT_GIFT_CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Unikal hədiyyə kodu yaradır. Kolliziya halı üçün 8 dəfəyə qədər yenidən cəhd
 * edir (31^11 ≈ 1.6e16 məkan). Yalnız tranzaksiyadan KƏNARDA çağırılır
 * (kodlar əvvəlcədən generasiya olunur), ona görə qlobal prisma istifadə edir.
 */
export async function generateUniqueProductGiftCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const existing = await prisma.productGift.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Hədiyyə kodu generasiyası uğursuz oldu (kolliziya).");
}
