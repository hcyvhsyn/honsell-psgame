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
