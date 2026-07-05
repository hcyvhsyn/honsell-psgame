"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { ReelStateProvider } from "./ReelStateProvider";
import ReelSlot from "./ReelSlot";
import ReelSideRail from "./ReelSideRail";
import ReelCommentsSheet from "./ReelCommentsSheet";
import type { ReelFeedItem, ReelRole } from "./types";

/** Bir slot-un yüksəkliyi — mobil tam ekran, desktop-da telefon-eni sütun. */
const SLOT_H = "h-[100dvh] sm:h-[92dvh]";

/**
 * Reels feed — YouTube Shorts tərzi.
 *  • Mobil: tam ekran, action düymələri video üzərində overlay (ReelSlot içində).
 *  • Desktop: mərkəzdə video sütunu, action düymələri KƏNARDA (ReelSideRail) +
 *    yuxarı/aşağı ox naviqasiyası — boş yer daha yaxşı istifadə olunur.
 *  • CSS scroll-snap + tək IntersectionObserver ilə aktiv slot; active±1 <video>.
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
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null);
  const [commentDeltas, setCommentDeltas] = useState<Record<string, number>>({});
  const [, startTransition] = useTransition();
  const loadingRef = useRef(false);

  const scrollerRef = useRef<HTMLDivElement>(null);

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

  const scrollToIndex = useCallback((i: number) => {
    const scroller = scrollerRef.current;
    const el = scroller?.querySelector(`[data-index="${i}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
  }, [activeIndex, items.length, scrollToIndex]);

  function roleFor(i: number): ReelRole {
    if (i === activeIndex) return "active";
    if (Math.abs(i - activeIndex) === 1) return "preload";
    return "dormant";
  }

  function onCommentCount(id: string, d: number) {
    setCommentDeltas((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + d }));
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

  const activeItem = items[activeIndex] ?? items[0];

  return (
    <ReelStateProvider>
      <div className="flex justify-center bg-black">
        <div className="flex items-stretch gap-3 sm:gap-5">
          {/* Video sütunu (+ şərh panosu bunun üzərində) */}
          <div className={`relative ${SLOT_H} w-full sm:w-[430px] sm:max-w-full`}>
            <div
              ref={scrollerRef}
              className="h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
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
                    commentDelta={commentDeltas[item.id] ?? 0}
                    onOpenComments={setCommentsOpenId}
                  />
                </div>
              ))}

              {cursor != null && (
                <div className="flex h-16 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              )}
            </div>

            {/* Şərh panosu — video sütununun üzərində (mobil + desktop ortaq). */}
            {commentsOpenId && (
              <ReelCommentsSheet
                reelId={commentsOpenId}
                onClose={() => setCommentsOpenId(null)}
                onCountChange={(d) => onCommentCount(commentsOpenId, d)}
              />
            )}
          </div>

          {/* Desktop yan panel — action düymələri videonun kənarında (YouTube tərzi). */}
          <div className="hidden shrink-0 items-end pb-6 xl:flex">
            {activeItem && (
              <ReelSideRail
                key={activeItem.id}
                item={activeItem}
                commentDelta={commentDeltas[activeItem.id] ?? 0}
                muted={globalMuted}
                onToggleMute={() => setGlobalMuted((m) => !m)}
                onOpenComments={() => setCommentsOpenId(activeItem.id)}
              />
            )}
          </div>

          {/* Desktop yuxarı/aşağı naviqasiya */}
          <div className="hidden shrink-0 flex-col justify-center gap-3 xl:flex">
            <NavArrow
              dir="up"
              disabled={activeIndex === 0}
              onClick={() => scrollToIndex(Math.max(activeIndex - 1, 0))}
            />
            <NavArrow
              dir="down"
              disabled={activeIndex >= items.length - 1}
              onClick={() => scrollToIndex(Math.min(activeIndex + 1, items.length - 1))}
            />
          </div>
        </div>
      </div>
    </ReelStateProvider>
  );
}

function NavArrow({
  dir,
  onClick,
  disabled,
}: {
  dir: "up" | "down";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "up" ? "Əvvəlki" : "Növbəti"}
      className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {dir === "up" ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
    </button>
  );
}
