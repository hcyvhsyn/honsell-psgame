"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { ReelStateProvider } from "./ReelStateProvider";
import ReelSlot from "./ReelSlot";
import type { ReelFeedItem, ReelRole } from "./types";

/** Bir slot-un yüksəkliyi — mobil tam ekran, desktop-da telefon-eni sütun. */
const SLOT_H = "h-[100dvh] sm:h-[92dvh]";

/**
 * Reels feed — performans nüvəsi.
 *  • CSS scroll-snap (JS yox) + tək IntersectionObserver ilə aktiv slot təyini.
 *  • Yalnız active±1 üçün <video> mount olunur (mobil decoder limiti); qalanı poster.
 *  • activeIndex sona yaxınlaşanda növbəti səhifə startTransition ilə əlavə olunur.
 *  • Səs qlobal state — yalnız aktiv video səslənə bilər.
 */
export default function ReelsFeedClient({
  initialItems,
  initialCursor,
}: {
  initialItems: ReelFeedItem[];
  initialCursor: number | null;
}) {
  const [items, setItems] = useState<ReelFeedItem[]>(initialItems);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(true);
  const [, startTransition] = useTransition();
  const loadingRef = useRef(false);

  const scrollerRef = useRef<HTMLDivElement>(null);

  // ─── Aktiv slot aşkarlama (tək IntersectionObserver) ─────────────────────
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: scroller, threshold: [0.6] },
    );
    const els = scroller.querySelectorAll("[data-reel-slot]");
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  // ─── Infinite scroll: sona 3 qalanda növbəti səhifə ──────────────────────
  const loadMore = useCallback(async () => {
    if (loadingRef.current || cursor == null) return;
    loadingRef.current = true;
    try {
      const res = await fetch(`/api/reels?cursor=${cursor}`, { cache: "no-store" });
      const data: { items?: ReelFeedItem[]; nextCursor?: number | null } = await res.json();
      startTransition(() => {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = (data.items ?? []).filter((it) => !seen.has(it.id));
          return [...prev, ...fresh];
        });
        setCursor(data.nextCursor ?? null);
      });
    } finally {
      loadingRef.current = false;
    }
  }, [cursor]);

  useEffect(() => {
    if (cursor != null && activeIndex >= items.length - 3) loadMore();
  }, [activeIndex, items.length, cursor, loadMore]);

  // ─── Desktop klaviatura naviqasiyası ─────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollToIndex(Math.min(activeIndex + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollToIndex(Math.max(activeIndex - 1, 0));
      } else if (e.key.toLowerCase() === "m") {
        setGlobalMuted((m) => !m);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, items.length]);

  function scrollToIndex(i: number) {
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector(`[data-index="${i}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function roleFor(i: number): ReelRole {
    if (i === activeIndex) return "active";
    if (Math.abs(i - activeIndex) === 1) return "preload";
    return "dormant";
  }

  if (items.length === 0) {
    return (
      <div className="grid min-h-[60dvh] place-items-center text-center text-white/70">
        <div>
          <p className="text-lg font-semibold">Hələ video yoxdur</p>
          <p className="mt-1 text-sm text-white/50">Tezliklə yeni reels əlavə olunacaq.</p>
        </div>
      </div>
    );
  }

  return (
    <ReelStateProvider>
      <div className="flex justify-center bg-black">
        <div
          ref={scrollerRef}
          className={`${SLOT_H} w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain sm:w-[430px] sm:max-w-full`}
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((item, i) => (
            <div
              key={item.id}
              data-reel-slot
              data-index={i}
              className={`${SLOT_H} w-full snap-start`}
              style={{ scrollSnapStop: "always" }}
            >
              <ReelSlot
                item={item}
                role={roleFor(i)}
                globalMuted={globalMuted}
                onToggleMute={() => setGlobalMuted((m) => !m)}
              />
            </div>
          ))}

          {cursor != null && (
            <div className="flex h-16 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          )}
        </div>
      </div>
    </ReelStateProvider>
  );
}
