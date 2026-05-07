import type { StreamingCartDetails } from "@/lib/cart";

export function validateStreamingDetails(d: StreamingCartDetails): string | null {
  const mail = d.gmail.trim().toLowerCase();
  if (!mail) return "Gmail ünvanı daxil edin.";
  if (!/^[^\s@]+@gmail\.com$/.test(mail)) return "Yalnız Gmail ünvanı (@gmail.com) qəbul edilir.";
  return null;
}

export const STREAMING_SERVICE_LABELS: Record<string, string> = {
  HBO_MAX: "HBO Max",
  GAIN: "Gain",
  YOUTUBE_PREMIUM: "YouTube Premium",
};

export const STREAMING_SERVICES = ["HBO_MAX", "GAIN", "YOUTUBE_PREMIUM"] as const;
export type StreamingService = (typeof STREAMING_SERVICES)[number];

export const STREAMING_DURATIONS = [1, 2, 3, 6, 12] as const;

/** Stok bazasında hər giriş üçün saxlanan struktur (ServiceCode.code-da JSON kimi). */
export type StreamingStockEntry = {
  accountEmail: string;
  accountPassword: string;
  slotName: string;
  pinCode: string;
};

export function parseStreamingStock(raw: string | null | undefined): StreamingStockEntry | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (typeof r.accountEmail !== "string" || !r.accountEmail) return null;
    return {
      accountEmail: r.accountEmail,
      accountPassword: typeof r.accountPassword === "string" ? r.accountPassword : "",
      slotName: typeof r.slotName === "string" ? r.slotName : "",
      pinCode: typeof r.pinCode === "string" ? r.pinCode : "",
    };
  } catch {
    return null;
  }
}

export function serializeStreamingStock(e: StreamingStockEntry): string {
  return JSON.stringify({
    accountEmail: e.accountEmail.trim(),
    accountPassword: e.accountPassword,
    slotName: e.slotName.trim(),
    pinCode: e.pinCode.trim(),
  });
}

function fmtDateAz(d: Date): string {
  return d.toLocaleDateString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

/** Müştəriyə göndəriləcək çatdırılma mesajını qurur (plain text). */
export function buildStreamingDeliveryMessage(params: {
  providerLabel: string;
  entry: StreamingStockEntry;
  months: number;
  startDate: Date;
  endDate: Date;
  paymentAznCents: number;
}): string {
  const { providerLabel, entry, months, startDate, endDate, paymentAznCents } = params;
  const pinLine = entry.pinCode ? `🔢 PIN: ${entry.pinCode}` : "";
  return [
    `${providerLabel} abunəliyiniz aktivləşdirildi.`,
    "",
    `📧 Email: ${entry.accountEmail}`,
    `🔑 Şifrə: ${entry.accountPassword}`,
    "",
    `📺 Profil: ${entry.slotName}`,
    pinLine,
    "",
    `📅 Başlanğıc: ${fmtDateAz(startDate)}`,
    `📅 Bitmə: ${fmtDateAz(endDate)}`,
    `⏰ Müddət: ${months} ay`,
    `💰 Ödəniş: ${(paymentAznCents / 100).toFixed(2)} AZN`,
  ]
    // Əgər PIN yoxdursa "📺 Profil:"-dan sonra iki ardıcıl boş sətir qalır — birini sil.
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}
