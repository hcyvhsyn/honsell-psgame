// Streaming xidmətlərinin variant (tier) konfiqurasiyası.
//
// Variant DISPLAY məlumatı (ad, fərqlər, ortaq xüsusiyyətlər, cihazlar) burada,
// kodda saxlanılır — DB metadata-da YOX. Səbəb: admin paneli məhsulu redaktə
// edəndə metadata sıfırdan qurulur; əgər fərqlər metadata-da saxlansaydı, hər
// redaktədə silinərdi. Məhsul yalnız `variantSlug` saxlayır, qalanı buradan
// həll olunur.

export type VariantFeatureTone = "good" | "bad" | "warn" | "neutral";
export type VariantFeature = { text: string; tone: VariantFeatureTone };

export type StreamingVariant = {
  /** URL slug — /streaming/<service>/<slug>. */
  slug: string;
  /** Görünən ad — məs. "Evimdə VIP". */
  name: string;
  /** Sıralama (kiçik əvvəl). */
  rank: number;
  /** Bu tier-ə xas fərqləndirici xüsusiyyətlər. */
  features: VariantFeature[];
  /** Bu tier-də dəstəklənən cihazlar (DEVICE_META açarları). */
  devices: string[];
};

export type ServiceVariantConfig = {
  /** Bütün tier-lərdə ortaq xüsusiyyətlər. */
  common: VariantFeature[];
  /** Tier-lər (rank sırası ilə). */
  variants: StreamingVariant[];
  /**
   * true olduqda /streaming/<svc> ayrıca müqayisə (landing) səhifəsi GÖSTƏRMİR;
   * tier-lər birbaşa plan picker-in içində tab kimi seçilir (məs. Netflix Hesab —
   * müştəri öz hesabına plan alır, kabinet/hane konsepti yoxdur).
   */
  inlineVariantPicker?: boolean;
};

export const STREAMING_VARIANTS: Record<string, ServiceVariantConfig> = {
  NETFLIX: {
    common: [
      { text: "Görüntü keyfiyyəti: 4K Ultra HD", tone: "good" },
      { text: "Premium hesabda yalnız sizə məxsus pəncərə (otaq)", tone: "good" },
    ],
    variants: [
      {
        slug: "yanimda",
        name: "Yanımda",
        rank: 0,
        devices: ["computer", "tablet", "phone"],
        features: [
          { text: "TV ilə istifadə qadağandır", tone: "bad" },
          { text: "Heç bir texniki problem yaşanmır", tone: "good" },
        ],
      },
      {
        slug: "evimde",
        name: "Evimdə",
        rank: 1,
        devices: ["tv", "computer", "tablet", "phone"],
        features: [
          { text: "TV ilə istifadə mümkündür", tone: "good" },
          {
            text: "2 həftədə bir texniki problem ola bilər (2-3 saata həll olunur)",
            tone: "warn",
          },
        ],
      },
      {
        slug: "evimdevip",
        name: "Evimdə VIP",
        rank: 2,
        devices: ["tv", "computer", "tablet", "phone"],
        features: [
          { text: "TV ilə istifadə mümkündür", tone: "good" },
          {
            text: "Çox nadir — ümumi istifadə müddətində 1 dəfə texniki problem ola bilər",
            tone: "warn",
          },
        ],
      },
    ],
  },

  // Netflix Hesab — plan birbaşa müştərinin ÖZ Netflix hesabına aktivləşdirilir.
  // Funksiyalar Netflix-in rəsmi Basic/Standart/Premium planları ilə eynidir.
  // Tier-lər plan picker-in içində tab kimi seçilir (ayrıca landing yoxdur).
  NETFLIX_VVIP: {
    common: [],
    inlineVariantPicker: true,
    variants: [
      {
        slug: "basic",
        name: "Basic",
        rank: 0,
        devices: ["tv", "computer", "tablet", "phone"],
        features: [
          { text: "Görüntü və səs keyfiyyəti: Yaxşı", tone: "neutral" },
          { text: "Çözünürlük: 720p (HD)", tone: "neutral" },
          { text: "Eyni anda 1 cihazda izləmə", tone: "neutral" },
          { text: "1 cihaza endirmə", tone: "neutral" },
        ],
      },
      {
        slug: "standart",
        name: "Standart",
        rank: 1,
        devices: ["tv", "computer", "tablet", "phone"],
        features: [
          { text: "Görüntü və səs keyfiyyəti: Yüksək", tone: "good" },
          { text: "Çözünürlük: 1080p (Tam HD)", tone: "good" },
          { text: "Eyni anda 2 cihazda izləmə", tone: "good" },
          { text: "2 cihaza endirmə", tone: "good" },
        ],
      },
      {
        slug: "premium",
        name: "Premium",
        rank: 2,
        devices: ["tv", "computer", "tablet", "phone"],
        features: [
          { text: "Görüntü və səs keyfiyyəti: Ən yüksək", tone: "good" },
          { text: "Çözünürlük: 4K (Ultra HD) + HDR", tone: "good" },
          { text: "Məkan səsi (3 boyutlu səs) daxil", tone: "good" },
          { text: "Eyni anda 4 cihazda izləmə", tone: "good" },
          { text: "6 cihaza endirmə", tone: "good" },
        ],
      },
    ],
  },
};

/** Xidmət kodu üçün variant konfiqurasiyasını qaytarır (yoxdursa null). */
export function getServiceVariantConfig(serviceCode: string): ServiceVariantConfig | null {
  return STREAMING_VARIANTS[serviceCode.toUpperCase()] ?? null;
}

/** Xidmət + slug üzrə konkret varianti qaytarır (yoxdursa null). */
export function getServiceVariant(serviceCode: string, slug: string): StreamingVariant | null {
  const cfg = getServiceVariantConfig(serviceCode);
  return cfg?.variants.find((v) => v.slug === slug) ?? null;
}

/** Xidmətin bütün variant slug-larını qaytarır (admin/validasiya üçün). */
export function getServiceVariantSlugs(serviceCode: string): string[] {
  return getServiceVariantConfig(serviceCode)?.variants.map((v) => v.slug) ?? [];
}
