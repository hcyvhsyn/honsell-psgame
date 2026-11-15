/**
 * Müştəriyə görünən məhsul adından daxili region kodlarını silir.
 *
 * CRM-in provayder adları hesabın açıldığı ölkəni daşıyır — "Netflix Evimdə (TR)",
 * "Netflix Yanımda (NGN)", "Spotify Family (AZE)". Bu daxili məlumatdır, müştəri
 * (rəy linki, WhatsApp mesajı, public rəylər) onu GÖRMƏMƏLİDİR. CRM rəy dəvətinin
 * başlığını sərbəst mətn kimi göndərir, ona görə burada təmizlənir.
 *
 *   "Netflix Evimdə (TR) — 1 ay" → "Netflix Evimdə — 1 ay"
 *
 * Yalnız mötərizədəki kod silinir: "500 TRY Balans" kimi adlara toxunulmur.
 * Saf funksiyadır (client-safe).
 */
const REGION_TAG = /\s*\((?:TR|AZE|AZ|NGN|NG)\)/gi;

export function stripRegionCodes(title: string): string {
  return title.replace(REGION_TAG, "").replace(/\s{2,}/g, " ").trim();
}
