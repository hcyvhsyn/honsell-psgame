/**
 * Məhsul-səviyyəli xüsusi şərtlər — data-driven. Səbətdə məhsulun (productType,
 * store, platformKind) kombinasiyasına görə qısa şərt qeydi qaytarır. Şərt yoxdursa
 * `null` (blok göstərilmir). `requiresAcceptance=true` olan varsa checkout-dan əvvəl
 * qəbul checkbox-u tələb olunur.
 *
 * Gələcəkdə admin paneldən idarə üçün: bu mapping-i DB/config-ə köçürmək olar;
 * hazırda saf funksiya kimi saxlanılır.
 */

export type ProductTerms = {
  termsTitle: string;
  termsDescription: string;
  requiresAcceptance: boolean;
};

export function getProductTerms(
  productType: string,
  store?: string | null,
  platformKind?: string | null,
): ProductTerms | null {
  const kind = (platformKind ?? "").toUpperCase();

  // ─── Streaming (Netflix, HBO, Gain, Prime, YouTube Premium) ───────────────
  if (productType === "STREAMING") {
    if (kind.startsWith("NETFLIX")) {
      return {
        termsTitle: "Netflix istifadə qeydi",
        termsDescription:
          "Hesab əsasən TV, telefon və brauzerdə işləyir. Bəzi Smart TV modellərində giriş məhdudiyyəti ola bilər — aktivləşmədən əvvəl WhatsApp dəstəyi ilə cihazınızı dəqiqləşdirin.",
        requiresAcceptance: false,
      };
    }
    return {
      termsTitle: "Streaming abunəliyi qeydi",
      termsDescription:
        "Abunəlik göstərilən müddət üçün aktivləşir. Cihaz və region məhdudiyyətləri ola bilər — aktivləşmə WhatsApp üzərindən aparılır.",
      requiresAcceptance: false,
    };
  }

  // ─── Platform abunəlikləri (Spotify, YouTube, LinkedIn) ───────────────────
  if (productType === "PLATFORM") {
    if (kind === "SPOTIFY") {
      return {
        termsTitle: "Spotify region qeydi",
        termsDescription:
          "Plan fərqli region hesabı ilə aktivləşir. Öz hesabınızı region-a uyğunlaşdırmaq lazım gələ bilər; qaydalara əməl olunmadıqda abunəlik ləğv riski var.",
        requiresAcceptance: true,
      };
    }
    if (kind === "YOUTUBE") {
      return {
        termsTitle: "YouTube Premium qeydi",
        termsDescription:
          "Premium göstərdiyiniz Gmail hesabına aktivləşir. Region tələbi ola bilər — aktivləşmə addımlarını dəstəklə birlikdə tamamlayın.",
        requiresAcceptance: true,
      };
    }
    return {
      termsTitle: "Platform abunəliyi qeydi",
      termsDescription: "Abunəlik göstərilən hesaba aktivləşir. Region/istifadə şərtləri tətbiq oluna bilər.",
      requiresAcceptance: false,
    };
  }

  // ─── PS Plus ──────────────────────────────────────────────────────────────
  if (productType === "PS_PLUS") {
    return {
      termsTitle: "PS Plus hesab tələbi",
      termsDescription:
        "PS Plus Türkiyə (TR) PSN hesabına aktivləşir. Düzgün region hesabı seçdiyinizə əmin olun.",
      requiresAcceptance: true,
    };
  }

  // ─── Epic oyunları ──────────────────────────────────────────────────────
  if (productType === "GAME" && store === "EPIC") {
    return {
      termsTitle: "Epic hesab tələbi",
      termsDescription:
        "Oyun Türkiyə Epic Games hesabına təhkim edilir. Aktivləşmə üçün region tələbləri var — hesab məlumatınızı dəqiq göndərin.",
      requiresAcceptance: true,
    };
  }

  // ─── PlayStation oyunları (informativ) ────────────────────────────────────
  if (productType === "GAME") {
    return {
      termsTitle: "PlayStation region qeydi",
      termsDescription:
        "Oyun Türkiyə (TR) PSN hesabına təhkim olunur. Hesabınız region-a uyğun olmalıdır; ətraflı WhatsApp dəstəyi verir.",
      requiresAcceptance: false,
    };
  }

  return null;
}

/** Hər şərt növü üçün nümunə (productType, store, platformKind) — `listProductTerms` üçün. */
const TERMS_SAMPLES: [string, string | null, string | null][] = [
  ["GAME", "PS", null],
  ["PS_PLUS", null, null],
  ["GAME", "EPIC", null],
  ["PLATFORM", null, "SPOTIFY"],
  ["PLATFORM", null, "YOUTUBE"],
  ["PLATFORM", null, null],
  ["STREAMING", null, "NETFLIX"],
  ["STREAMING", null, null],
];

/**
 * Bütün məhsul şərtlərinin unikal siyahısı (başlığa görə). Bir dəfəlik qəbul
 * modalı bunu göstərir — qəbul hamısını əhatə etdiyi üçün müştəri səbətdə
 * olmayan məhsulun şərtini də görməlidir. `filter` mağaza əhatəsini tətbiq edir.
 */
export function listProductTerms(
  filter: (productType: string, store: string | null, kind: string | null) => boolean = () => true,
): ProductTerms[] {
  const byTitle = new Map<string, ProductTerms>();
  for (const [type, store, kind] of TERMS_SAMPLES) {
    if (!filter(type, store, kind)) continue;
    const t = getProductTerms(type, store, kind);
    if (t && !byTitle.has(t.termsTitle)) byTitle.set(t.termsTitle, t);
  }
  return Array.from(byTitle.values());
}
