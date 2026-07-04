/** Client-safe reel feed tipləri (lib/reels.ts server modulunu client bundle-a
 *  çəkməmək üçün ayrıca saxlanılır — forma eyni olmalıdır). */
export type ReelProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  productType: string;
  store: string;
  href: string | null;
};

export type ReelFeedItem = {
  id: string;
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
  };
  counts: { likes: number; dislikes: number; views: number; comments: number };
};

/** Slot-un oynatma rolu — window/preload state machine. */
export type ReelRole = "dormant" | "preload" | "active";
