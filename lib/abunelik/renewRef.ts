// Saf (client-safe, DB-siz). CRM ödəniş xatırlatmasındakı ({odenisLinki}) linkin hədəf abunəliyi — `?uzat=<ref>`.
// Format CRM-in abunəlik ref-idir (psCustomer lib/portal/customer-subscriptions.ts): slot / fam / si / ni / ps.
// İmzasızdır: yalnız Abunəliklərim-də həmin kartı göstərir; sahiblik /api/abunelik/renew-də yoxlanır.
const RENEW_REF_RE = /^(slot|fam|si|ni|ps):[A-Za-z0-9_-]{1,64}$/;

export function parseRenewRef(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  return RENEW_REF_RE.test(v) ? v : null;
}
