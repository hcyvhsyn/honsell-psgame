export function fmtAzn(cents: number | null | undefined): string {
  const n = (cents ?? 0) / 100;
  return `${n.toFixed(2)} AZN`;
}

/**
 * Minlik ayırıcısı ilə tam ədəd — «1000» → «1.000».
 *
 * ⚠️ `toLocaleString("az-AZ")` İSTİFADƏ ETMƏ: Node-un ICU-su serverdə `1.000`,
 * brauzer isə `1,000` qaytarır → React hydration mismatch (səhifə client HTML
 * ilə tam əvəzlənir). Bu funksiya hər iki tərəfdə eyni nəticəni verir.
 */
export function fmtThousands(n: number): string {
  const neg = n < 0;
  const digits = Math.trunc(Math.abs(n)).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ".";
    out += digits[i];
  }
  return neg ? `-${out}` : out;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Locale-dən asılı olmayan dd.mm.yyyy hh:mm formatı (ICU fallback "M05" problemini həll edir). */
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`;
}
