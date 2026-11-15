// Saf (client-safe, DB-siz) — test: npm run test:crmrenewal

/**
 * /abunelik telefon normallaşdırması. Mövcud `normalizeToE164` (lib/wasender.ts) ölkə kodu bilmir —
 * "0501234567" → "+0501234567" edir. Burada AZ formatları CRM-in `normalizePhoneDigits`-i ilə eyni qaydadır:
 *   050 123 45 67 → +994501234567,  501234567 → +994501234567,  9940501234567 → +994501234567.
 * "+" ilə başlayan xarici nömrələr (10–15 rəqəm) olduğu kimi qalır.
 */
export function normalizeAzPhone(raw: string | null | undefined): { e164: string; phone9: string } | null {
  const input = String(raw ?? "").trim();
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("9940") && digits.length === 13) digits = `994${digits.slice(4)}`;
  else if (digits.length === 10 && digits.startsWith("0")) digits = `994${digits.slice(1)}`;
  else if (digits.length === 9) digits = `994${digits}`;
  const isAz = digits.startsWith("994") && digits.length === 12;
  const isIntl = input.startsWith("+") && digits.length >= 10 && digits.length <= 15;
  if (!isAz && !isIntl) return null;
  return { e164: `+${digits}`, phone9: digits.slice(-9) };
}

/** Ekranda göstərmək üçün: +994 50 123 45 67 */
export function formatAzPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("994") && d.length === 12) {
    return `+994 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  }
  return e164;
}
