// Streaming "qrup" (parent) konfiqurasiyası.
//
// Bəzi xidmətlər tək paket siyahısı yox, alt-platformalara bölünmüş seçim
// ekranı kimi təqdim olunur. Məsələn Netflix: /streaming/netflix səhifəsi
// müqayisə (seçim) ekranı göstərir, hər kart isə öz müstəqil platforma
// səhifəsinə (/streaming/netflix-yanimda və s.) yönləndirir.
//
// Hər alt-paket DB-də AYRICA `streamingPlatform` kimi mövcuddur (öz slug/code
// və paketləri ilə). Buradakı config yalnız hansı parent slug-ın hansı uşaq
// slug-lara bağlandığını və kartlarda göstərilən ad/fərqləri (variant
// config-dən) həll edir.

import { STREAMING_VARIANTS, type VariantFeature } from "@/lib/streamingVariants";

export type StreamingGroupChild = {
  /** Müstəqil platforma slug-ı — /streaming/<platformSlug>. */
  platformSlug: string;
  /** Kartda göstərilən qısa ad (xidmət adı ayrıca göstərilir). */
  name: string;
  /** Bu alt-paketə xas fərqləndirici xüsusiyyətlər. */
  features: VariantFeature[];
};

export type StreamingGroup = {
  /** Ortaq xüsusiyyətlər üçün variant config açarı (lib/streamingVariants). */
  variantServiceCode: string;
  /** Seçim ekranındakı alt-paketlər (sıra ilə). */
  children: StreamingGroupChild[];
};

const NETFLIX = STREAMING_VARIANTS.NETFLIX;
function netflixVariant(slug: string): { name: string; features: VariantFeature[] } {
  const v = NETFLIX?.variants.find((x) => x.slug === slug);
  return { name: v?.name ?? slug, features: v?.features ?? [] };
}

export const STREAMING_GROUPS: Record<string, StreamingGroup> = {
  netflix: {
    variantServiceCode: "NETFLIX",
    children: [
      { platformSlug: "netflix-yanimda", ...netflixVariant("yanimda") },
      { platformSlug: "netflix-evimde", ...netflixVariant("evimde") },
      { platformSlug: "netflix-evimde-vip", ...netflixVariant("evimdevip") },
    ],
  },
};

/** Parent slug üçün qrup konfiqurasiyasını qaytarır (yoxdursa null). */
export function getStreamingGroup(slug: string): StreamingGroup | null {
  return STREAMING_GROUPS[slug] ?? null;
}

const CHILD_TO_PARENT = new Map<string, string>();
for (const [parentSlug, group] of Object.entries(STREAMING_GROUPS)) {
  for (const child of group.children) CHILD_TO_PARENT.set(child.platformSlug, parentSlug);
}

/** Bu slug hər hansı qrupun alt-paketidirsə true. */
export function isStreamingGroupChild(slug: string): boolean {
  return CHILD_TO_PARENT.has(slug);
}

/** Alt-paket slug-ının parent slug-ını qaytarır (yoxdursa null). */
export function getStreamingGroupParentSlug(slug: string): string | null {
  return CHILD_TO_PARENT.get(slug) ?? null;
}
