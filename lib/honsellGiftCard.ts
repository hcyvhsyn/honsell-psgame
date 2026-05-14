import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  HONSELL_GIFT_CARD_CODE_ALPHABET,
  HONSELL_GIFT_CARD_CODE_LENGTH,
} from "@/lib/honsellGiftCardShared";

export {
  HONSELL_GIFT_CARD_CODE_LENGTH,
  HONSELL_GIFT_CARD_VALIDITY_DAYS,
  HONSELL_GIFT_CARD_SERVICE_TYPE,
  HONSELL_GIFT_CARD_PRODUCT_IDS,
  normalizeHonsellGiftCardCode,
  isValidHonsellGiftCardFormat,
  formatHonsellGiftCardCode,
} from "@/lib/honsellGiftCardShared";

function randomCode(): string {
  const bytes = randomBytes(HONSELL_GIFT_CARD_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < HONSELL_GIFT_CARD_CODE_LENGTH; i++) {
    out += HONSELL_GIFT_CARD_CODE_ALPHABET[bytes[i] % HONSELL_GIFT_CARD_CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Unikal kod yaradır. Çox az ehtimal olsa da, kolliziya halı üçün
 * 8 dəfəyə qədər yenidən cəhd edir (31^11 ≈ 1.6e16 məkan).
 */
export async function generateUniqueHonsellGiftCardCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const existing = await prisma.honsellGiftCard.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Honsell gift card kod generasiyası uğursuz oldu (kolliziya).");
}
