/** Client-safe reel feed tipləri (lib/reels.ts server modulunu client bundle-a
 *  çəkməmək üçün ayrıca saxlanılır — forma eyni olmalıdır). */
export type ReelProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  /** Endirimdən əvvəlki qiymət — aktiv endirim yoxdursa null. */
  originalAzn: number | null;
  discountPct: number | null;
  productType: string;
  store: string;
  href: string | null;
  /** "Standart", "Ultimate Sürüm", … — sürüm çipinin adı. */
  editionName: string | null;
  platform: string | null;
};

/** lib/reels.ts-dəki `ReelCategory` ilə EYNİ olmalıdır. */
export type ReelCategory = "GAME" | "STREAMING" | "ALL" | "SAVED";

/** Feed-də göstərilən platforma çipi (yalnız film/serial rejimində). */
export type ReelPlatformChip = { code: string; label: string };

export type ReelFeedItem = {
  id: string;
  /** GAME | STREAMING */
  category: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterUrl: string;
  w: number;
  h: number;
  durationMs: number;
  platform: { code: string | null; label: string | null; logoUrl: string | null };
  cta: {
    type: string;
    label: string;
    href: string | null;
    product: ReelProduct | null;
    /** Oyunun bütün sürümləri — UCUZDAN BAHAYA sıralı, [0] default seçilir. */
    editions: ReelProduct[];
  };
  counts: { likes: number; dislikes: number; views: number; comments: number };
};

/** Slot-un oynatma rolu — window/preload state machine. */
export type ReelRole = "dormant" | "preload" | "active";
