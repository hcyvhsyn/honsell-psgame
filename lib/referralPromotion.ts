import { SITE_URL, SITE_NAME } from "@/lib/site";

export function buildReferralRegisterUrl(code: string): string {
  return `${SITE_URL}/register?ref=${encodeURIComponent(code)}`;
}

/** Müştərinin paylaşacağı mesaj — WhatsApp/Telegram üçün hazır. */
export function buildReferralShareMessage(code: string, sharePct: number = 5): string {
  const url = buildReferralRegisterUrl(code);
  return `${SITE_NAME}-da PlayStation oyun, PS Plus və streaming abunəlikləri sərfəli qiymətə!

Mənim kodumla qeydiyyatdan keç, hər alışından mən %${sharePct} qazanaraq sənə dəstək olum:
${url}

Kod: ${code}`;
}

export function buildWhatsAppShareLink(code: string, sharePct?: number): string {
  const text = buildReferralShareMessage(code, sharePct);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildTelegramShareLink(code: string, sharePct?: number): string {
  const url = buildReferralRegisterUrl(code);
  const text = buildReferralShareMessage(code, sharePct);
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
