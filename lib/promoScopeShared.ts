/**
 * Kupon scope-u üçün paylaşılan sabitlər — həm admin UI ("use client"), həm də
 * admin API işlədir. Prisma-ya TOXUNMUR (client import zənciri build-i qırır).
 *
 * Siyahı /api/cart/checkout-un HƏQİQƏTƏN yüklədiyi növlərlə eynidir. Burada
 * olmayan bir dəyər (məs. StreamingPlatform.category olan "MUSIC") heç bir
 * səbət sətri ilə uyğunlaşmaz və kupon istifadə anında xəta verərdi.
 */
export const PROMO_SCOPE_PRODUCT_TYPES = [
  "GAME",
  "PS_PLUS",
  "EA_PLAY",
  "TRY_BALANCE",
  "POINT_BLANK_TG",
  "ACCOUNT_CREATION",
  "EPIC_ACCOUNT_CREATION",
  "STREAMING",
  "PLATFORM",
  "HONSELL_GIFT_CARD",
] as const;

export const PROMO_SCOPE_TYPE_LABELS: Record<string, string> = {
  GAME: "Oyunlar",
  PS_PLUS: "PS Plus",
  EA_PLAY: "EA Play",
  TRY_BALANCE: "TRY balans",
  POINT_BLANK_TG: "Point Blank TG",
  ACCOUNT_CREATION: "PSN hesab açılışı",
  EPIC_ACCOUNT_CREATION: "Epic hesab açılışı",
  STREAMING: "Streaming",
  PLATFORM: "Platformalar (Spotify, YouTube, LinkedIn…)",
  HONSELL_GIFT_CARD: "Honsell hədiyyə kartı",
};

/** Müştəri mətnində daha qısa növ etiketi (admin chip-ində olan izahsız). */
const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  ...PROMO_SCOPE_TYPE_LABELS,
  PLATFORM: "Platforma abunəlikləri",
};

/** Müştəri üçün kupon izah mətninin girişi (qəpik yox, admin formundakı kimi). */
export type CustomerCouponInput = {
  code: string;
  kind: string; // "PERCENT" | "FIXED"
  /** PERCENT üçün faiz (10), FIXED üçün AZN (2.5). */
  value: number;
  /** PERCENT tavanı, AZN. Yoxdursa null/0. */
  maxDiscountAzn?: number | null;
  /** Minimum sifariş, AZN. Yoxdursa 0. */
  minOrderAzn?: number | null;
  productTypes: string[];
  /** Konkret seçilmiş məhsulların adları (oyun + servis). */
  productNames?: string[];
  /** ISO və ya yyyy-mm-dd. Yoxdursa null. */
  startsAt?: string | null;
  expiresAt?: string | null;
  perUserLimit?: number | null;
};

/** yyyy-mm-dd və ya ISO → dd.MM.yyyy (yararsızdırsa boş string). */
function fmtDate(v?: string | null): string {
  if (!v) return "";
  const iso = v.length > 10 ? v.slice(0, 10) : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function fmtAzn(n: number): string {
  return Number.isInteger(n) ? `${n} ₼` : `${n.toFixed(2)} ₼`;
}

/**
 * Kupon məlumatını müştəriyə göndərilə bilən Azərbaycanca mətnə çevirir.
 * Admin formundakı canlı dəyərlərdən qurulur — pure funksiya (prisma yox).
 */
export function buildCustomerCouponMessage(p: CustomerCouponInput): string {
  const lines: string[] = [];
  lines.push(`🎟️ Kupon kodu: ${p.code || "—"}`);
  lines.push("");

  // Endirim.
  if (p.kind === "FIXED") {
    lines.push(`✅ ${fmtAzn(p.value)} endirim`);
  } else {
    let d = `✅ ${p.value}% endirim`;
    if (p.maxDiscountAzn && p.maxDiscountAzn > 0) d += ` (maksimum ${fmtAzn(p.maxDiscountAzn)})`;
    lines.push(d);
  }

  // Scope.
  const typeLabels = (p.productTypes ?? []).map((t) => CUSTOMER_TYPE_LABELS[t] ?? t);
  const targets = [...typeLabels, ...(p.productNames ?? [])].filter(Boolean);
  if (targets.length > 0) {
    lines.push(`🎯 Yalnız: ${targets.join(", ")}`);
  } else {
    lines.push("🎯 Bütün məhsullara aiddir");
  }

  if (p.minOrderAzn && p.minOrderAzn > 0) {
    lines.push(`💰 Minimum sifariş: ${fmtAzn(p.minOrderAzn)}`);
  }

  const start = fmtDate(p.startsAt);
  const end = fmtDate(p.expiresAt);
  if (start && end) lines.push(`⏳ Keçərlidir: ${start} – ${end}`);
  else if (end) lines.push(`⏳ Son tarix: ${end}`);
  else if (start) lines.push(`⏳ Başlanğıc: ${start}`);

  if (p.perUserLimit && p.perUserLimit === 1) {
    lines.push("👤 Hər istifadəçi bir dəfə istifadə edə bilər");
  } else if (p.perUserLimit && p.perUserLimit > 1) {
    lines.push(`👤 Hər istifadəçi ${p.perUserLimit} dəfə istifadə edə bilər`);
  }

  lines.push("");
  lines.push("🛒 Səbətdə kupon xanasına kodu daxil edin və endirimi qazanın!");

  return lines.join("\n");
}
