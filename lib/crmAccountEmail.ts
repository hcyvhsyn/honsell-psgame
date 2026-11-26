// Saf (client-safe, DB-siz) — lib/resend.ts və UI da import edir.

/**
 * CRM müştəriləri üçün avtomatik yaradılan sayt hesablarının ("telefon hesabı") e-poçtu.
 *
 * CRM-də müştərinin şəxsi e-poçtu yoxdur (`psEmail` PSN girişidir), `User.email` isə məcburi və unikaldır —
 * ona görə hesab telefonun rəqəmlərindən düzələn, ÇATDIRILMAYAN ünvanla yaranır:
 * `994501234567@crm.honsell.invalid` (`.invalid` RFC 2606 ilə rezerv olunub, heç vaxt həll olunmur).
 *
 * Belə hesaba giriş YALNIZ telefonladır (/abunelik: WhatsApp kodu və ya CRM-in göndərdiyi birbaşa giriş linki).
 * `lib/resend.ts` bu ünvanlara heç nə göndərmir; kampaniya auditoriyası onları çıxarır.
 */
export const CRM_PLACEHOLDER_EMAIL_DOMAIN = "crm.honsell.invalid";
export const CRM_PLACEHOLDER_EMAIL_SUFFIX = `@${CRM_PLACEHOLDER_EMAIL_DOMAIN}`;

/** "+994501234567" → "994501234567@crm.honsell.invalid" (eyni nömrə → eyni ünvan, unikal indeks dublikatı tutur). */
export function crmPlaceholderEmail(e164: string): string {
  return `${e164.replace(/\D/g, "")}${CRM_PLACEHOLDER_EMAIL_SUFFIX}`;
}

/** "Ad <x@crm.honsell.invalid>" formatını da tanıyır. */
export function isCrmPlaceholderEmail(email: string | null | undefined): boolean {
  return /@crm\.honsell\.invalid>?\s*$/i.test(String(email ?? "").trim());
}
