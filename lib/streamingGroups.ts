// Streaming "qrup" (parent) konfiqurasiyası.
//
// Netflix kimi xidmətlər tək paket siyahısı yox, addımlı seçim ekranı kimi
// təqdim olunur:
//   /streaming/netflix                → 2 seçim (Kabinet almaq / Hesab almaq)
//   /streaming/netflix?secim=kabinet  → kabinet tier-ləri (Yanımda/Evimdə/VIP)
//   /streaming/netflix-hesab          → hesab tier-ləri (Basic/Standart/Premium)
//
// Hər kabinet alt-paketi DB-də AYRICA `streamingPlatform` kimi mövcuddur.
// "Hesab" seçimi isə ayrıca platformaya (netflix-hesab) yönləndirir.

import { STREAMING_VARIANTS, type VariantFeature } from "@/lib/streamingVariants";

export type StreamingGroupChild = {
  /** Müstəqil platforma slug-ı — /streaming/<platformSlug>. */
  platformSlug: string;
  /** Kartda göstərilən qısa ad. */
  name: string;
  /** Bu alt-paketə xas fərqləndirici xüsusiyyətlər. */
  features: VariantFeature[];
};

export type StreamingGroupChoice = {
  /** Kart başlığı — məs. "Kabinet almaq istəyirəm". */
  title: string;
  /** Alt mətn. */
  subtitle: string;
  /** Qısa üstünlük bulletləri. */
  points: string[];
  /** Vurğu/tema açarı. */
  accent: "kabinet" | "hesab";
  /** Eyni səhifədə group landing açır — /streaming/<parent>?secim=<selection>. */
  selection?: string;
  /** Başqa platforma səhifəsinə yönəldir — /streaming/<platformSlug>. */
  platformSlug?: string;
};

export type StreamingGroup = {
  /** Ortaq xüsusiyyətlər üçün variant config açarı (lib/streamingVariants). */
  variantServiceCode: string;
  /** Kabinet seçim ekranındakı alt-paketlər (sıra ilə). */
  children: StreamingGroupChild[];
  /** Parent ilk açılışda göstərilən addım seçimləri (verilməsə birbaşa landing). */
  chooser?: StreamingGroupChoice[];
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
    chooser: [
      {
        title: "Kabinet almaq istəyirəm",
        subtitle: "Bizim hazır Netflix kabinetimizdən istifadə et — giriş məlumatları tərəfimizdən verilir.",
        points: ["Yanımda", "Evimdə", "Evimdə VIP"],
        accent: "kabinet",
        selection: "kabinet",
      },
      {
        title: "Hesab almaq istəyirəm",
        subtitle: "Plan birbaşa SƏNİN Netflix hesabına aktivləşir — alışda şəxsi mailini verirsən.",
        points: ["Basic", "Standart", "Premium"],
        accent: "hesab",
        platformSlug: "netflix-hesab",
      },
    ],
  },
};

/** Parent slug üçün qrup konfiqurasiyasını qaytarır (yoxdursa null). */
export function getStreamingGroup(slug: string): StreamingGroup | null {
  return STREAMING_GROUPS[slug] ?? null;
}

// Kabinet alt-paket slug-ları (kabinet landing-də göstərilir).
const CHILD_SLUGS = new Set(
  Object.values(STREAMING_GROUPS).flatMap((g) => g.children.map((c) => c.platformSlug)),
);

/** Bu slug hər hansı qrupun kabinet alt-paketidirsə true. */
export function isStreamingGroupChild(slug: string): boolean {
  return CHILD_SLUGS.has(slug);
}

// Ana /streaming grid-dən gizlədiləcək slug-lar: kabinet uşaqları + chooser
// platform hədəfləri (məs. netflix-hesab). Hamısı yalnız parent vasitəsilə açılır.
const HIDDEN_FROM_GRID = new Set<string>(CHILD_SLUGS);
for (const g of Object.values(STREAMING_GROUPS)) {
  for (const c of g.chooser ?? []) {
    if (c.platformSlug) HIDDEN_FROM_GRID.add(c.platformSlug);
  }
}

/** Ana /streaming siyahısında gizlədilməlidirsə true. */
export function isHiddenFromStreamingGrid(slug: string): boolean {
  return HIDDEN_FROM_GRID.has(slug);
}

// slug → parent slug (kabinet uşağı və ya chooser platform hədəfi).
const CHILD_TO_PARENT = new Map<string, string>();
for (const [parentSlug, group] of Object.entries(STREAMING_GROUPS)) {
  for (const child of group.children) CHILD_TO_PARENT.set(child.platformSlug, parentSlug);
  for (const c of group.chooser ?? []) {
    if (c.platformSlug) CHILD_TO_PARENT.set(c.platformSlug, parentSlug);
  }
}

/** Alt-paket/hədəf slug-ının parent slug-ını qaytarır (yoxdursa null). */
export function getStreamingGroupParentSlug(slug: string): string | null {
  return CHILD_TO_PARENT.get(slug) ?? null;
}
