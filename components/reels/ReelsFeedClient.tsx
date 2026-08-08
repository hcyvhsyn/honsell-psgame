"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { ReelStateProvider } from "./ReelStateProvider";
import ReelSlot from "./ReelSlot";
import ReelSideRail from "./ReelSideRail";
import ReelCommentsSheet from "./ReelCommentsSheet";
import ReelCategoryGate from "./ReelCategoryGate";
import ReelCategorySwitch from "./ReelCategorySwitch";
import { readStoredReelCategory, storeReelCategory } from "./reelCategory";
import { isVolumeUpKey, readSoundPreference, storeSoundPreference } from "./reelSound";
import type { ReelCategory, ReelFeedItem, ReelPlatformChip, ReelRole } from "./types";

/** Bir slot-un yüksəkliyi — mobil tam ekran, desktop-da telefon-eni sütun. */
const SLOT_H = "h-[100dvh] sm:h-[92dvh]";

type Page = { items: ReelFeedItem[]; nextCursor: number | null };
type Bucket = Page & { loaded: boolean };

const EMPTY_BUCKET: Bucket = { items: [], nextCursor: 0, loaded: false };

/**
 * Reels feed — YouTube Shorts tərzi.
 *  • Mobil: tam ekran, action düymələri video üzərində overlay (ReelSlot içində).
 *  • Desktop: mərkəzdə video sütunu, action düymələri KƏNARDA (ReelSideRail).
 *  • CSS scroll-snap + tək IntersectionObserver ilə aktiv slot; active±1 <video>.
 *
 * KATEQORİYA: oyun və film/serial auditoriyaları ayrıdır. Seçim client-də
 * (localStorage) saxlanılır — server onu bilmir, çünki səhifə statik qalmalıdır.
 * Seçim həll olunana qədər feed RENDER OLUNMUR: SSR-də hansısa kateqoriyanı
 * göstərsəydik, qayıdan istifadəçi bir an yanlış feed-i görərdi (SSR HTML
 * hidrasiyadan ƏVVƏL paint olunur, ona görə useLayoutEffect bunu xilas etmir).
 */
export default function ReelsFeedClient({
  initialGame,
  initialStreaming,
  platforms,
}: {
  initialGame: Page;
  initialStreaming: Page;
  platforms: ReelPlatformChip[];
}) {
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("r");

  const [category, setCategory] = useState<ReelCategory | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [platform, setPlatform] = useState<string | null>(null);

  // Kateqoriya başına ayrıca dəst — keçid edəndə əvvəlki mövqe və yüklənmiş
  // səhifələr itmir, təkrar fetch olmur.
  const [buckets, setBuckets] = useState<Record<ReelCategory, Bucket>>({
    GAME: { ...initialGame, loaded: true },
    STREAMING: { ...initialStreaming, loaded: true },
    ALL: EMPTY_BUCKET, // azlıqda qalan seçim — lazım olanda çəkilir
  });

  const [pinned, setPinned] = useState<ReelFeedItem | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(true);
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null);
  const [commentDeltas, setCommentDeltas] = useState<Record<string, number>>({});
  const [, startTransition] = useTransition();
  const loadingRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Saxlanmış seçimləri paint-dən əvvəl oxu (hidrasiya uyğunsuzluğu olmasın deyə
  // render-də deyil, layout effektində).
  useLayoutEffect(() => {
    const stored = readStoredReelCategory();
    if (stored) setCategory(stored);
    else {
      setCategory("GAME"); // qapının arxasında məhsul görünsün
      setGateOpen(true);
    }
    // İstifadəçi əvvəllər səsi açıbsa yenidən açmağa CƏHD et — brauzer icazə
    // verməsə ReelSlot səssizə qayıdır (avtoplay siyasəti).
    if (readSoundPreference()) setGlobalMuted(false);
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setGlobalMuted(next);
    storeSoundPreference(!next);
  }, []);

  function pickCategory(next: ReelCategory) {
    storeReelCategory(next);
    setCategory(next);
    setGateOpen(false);
    setPlatform(null);
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ top: 0 });
  }

  const bucket = category ? buckets[category] : EMPTY_BUCKET;

  // Platforma süzgəci SERVERDƏ tətbiq olunur (offset kursoru süzülmüş dəstlə
  // uyğun qalsın deyə), ona görə çip dəyişəndə dəst sıfırdan çəkilir.
  const [filtered, setFiltered] = useState<Bucket | null>(null);
  useEffect(() => {
    if (category !== "STREAMING" || !platform) {
      setFiltered(null);
      return;
    }
    let cancelled = false;
    setFiltered({ items: [], nextCursor: null, loaded: false });
    fetch(`/api/reels?category=STREAMING&platform=${encodeURIComponent(platform)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { items: [], nextCursor: null }))
      .then((d: Page) => {
        if (!cancelled) setFiltered({ items: d.items ?? [], nextCursor: d.nextCursor ?? null, loaded: true });
      })
      .catch(() => !cancelled && setFiltered({ items: [], nextCursor: null, loaded: true }));
    return () => {
      cancelled = true;
    };
  }, [category, platform]);

  // "Hamısı" ilk dəfə seçiləndə çəkilir (SSR-də göndərilmir).
  useEffect(() => {
    if (category !== "ALL" || buckets.ALL.loaded) return;
    let cancelled = false;
    fetch("/api/reels?category=ALL", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [], nextCursor: null }))
      .then((d: Page) => {
        if (cancelled) return;
        setBuckets((prev) => ({
          ...prev,
          ALL: { items: d.items ?? [], nextCursor: d.nextCursor ?? null, loaded: true },
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [category, buckets.ALL.loaded]);

  // Deep link — paylaşılan reel feed-in BAŞINA qoyulur və kateqoriya ona
  // uyğunlaşdırılır (yoxsa link saxlanmış seçimə görə boş feed açar).
  // Saxlanmış seçim DƏYİŞDİRİLMİR: bu, bir dəfəlik baxışdır.
  useEffect(() => {
    if (!deepLinkId) return;
    let cancelled = false;
    fetch(`/api/reels/${encodeURIComponent(deepLinkId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { item?: ReelFeedItem } | null) => {
        if (cancelled || !d?.item) return;
        setPinned(d.item);
        setGateOpen(false);
        setCategory((prev) => {
          if (prev === "ALL") return prev;
          return d.item!.category === "GAME" ? "GAME" : "STREAMING";
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deepLinkId]);

  const active = filtered ?? bucket;

  // Pin-lənmiş reel siyahının başında, təkrarsız.
  const items = useMemo(() => {
    if (!pinned) return active.items;
    return [pinned, ...active.items.filter((i) => i.id !== pinned.id)];
  }, [pinned, active.items]);

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
    scroller.querySelectorAll("[data-reel-slot]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  const loadMore = useCallback(async () => {
    const cursor = active.nextCursor;
    if (loadingRef.current || cursor == null || !category) return;
    loadingRef.current = true;
    try {
      const qs = new URLSearchParams({ cursor: String(cursor), category });
      if (filtered && platform) qs.set("platform", platform);
      const res = await fetch(`/api/reels?${qs}`, { cache: "no-store" });
      const data: Partial<Page> = await res.json();
      const merge = (prev: Bucket): Bucket => {
        const seen = new Set(prev.items.map((p) => p.id));
        const fresh = (data.items ?? []).filter((it) => !seen.has(it.id));
        return { items: [...prev.items, ...fresh], nextCursor: data.nextCursor ?? null, loaded: true };
      };
      startTransition(() => {
        if (filtered) setFiltered((prev) => (prev ? merge(prev) : prev));
        else setBuckets((prev) => ({ ...prev, [category]: merge(prev[category]) }));
      });
    } finally {
      loadingRef.current = false;
    }
  }, [active.nextCursor, category, filtered, platform]);

  useEffect(() => {
    if (active.nextCursor != null && activeIndex >= items.length - 3) loadMore();
  }, [activeIndex, items.length, active.nextCursor, loadMore]);

  const scrollToIndex = useCallback((i: number) => {
    scrollerRef.current
      ?.querySelector(`[data-index="${i}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        setMuted(!globalMuted);
      } else if (isVolumeUpKey(e)) {
        // Yalnız bu klavişi ötürən masaüstü brauzerlərdə işləyir (macOS və mobil
        // onu səhifəyə vermir) — ona görə bu, əlavə imkandır, əsas yol deyil.
        setMuted(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, items.length, scrollToIndex, globalMuted, setMuted]);

  function roleFor(i: number): ReelRole {
    if (i === activeIndex) return "active";
    if (Math.abs(i - activeIndex) === 1) return "preload";
    return "dormant";
  }

  function onCommentCount(id: string, d: number) {
    setCommentDeltas((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + d }));
  }

  // Seçim hələ oxunmayıb — qara ekran (feed onsuz da qara fonludur, ona görə bu
  // görünməz keçiddir və yanlış kateqoriyanın bir kadr belə görünməsini əngəlləyir).
  if (!category) {
    return <div className={`${SLOT_H} w-full bg-black`} />;
  }

  const activeItem = items[activeIndex] ?? items[0];

  return (
    <ReelStateProvider>
      {gateOpen && <ReelCategoryGate onPick={pickCategory} />}

      {/* Kateqoriya keçidi — üst mərkəzdə. */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-16">
        <ReelCategorySwitch
          category={category}
          onCategoryChange={pickCategory}
          platforms={platforms}
          activePlatform={platform}
          onPlatformChange={setPlatform}
        />
      </div>

      <div className="flex justify-center bg-black">
        <div className="flex w-full items-stretch justify-center gap-3 sm:w-auto sm:gap-5">
          <div className={`relative ${SLOT_H} w-full sm:w-[430px] sm:max-w-full`}>
            {items.length === 0 ? (
              <EmptyState
                loading={!active.loaded}
                category={category}
                platform={platform}
                onClearPlatform={() => setPlatform(null)}
                onSwitch={pickCategory}
              />
            ) : (
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
                      onToggleMute={() => setMuted(!globalMuted)}
                      // Brauzer səsli avtoplay-a icazə vermədi. YALNIZ state
                      // dəyişir — saxlanmış seçim "səs açıq" qalır ki, növbəti
                      // girişdə (media engagement artdıqca) yenidən cəhd olunsun.
                      onSoundBlocked={() => setGlobalMuted(true)}
                      commentDelta={commentDeltas[item.id] ?? 0}
                      onOpenComments={setCommentsOpenId}
                    />
                  </div>
                ))}

                {active.nextCursor != null && (
                  <div className="flex h-16 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                  </div>
                )}
              </div>
            )}

            {commentsOpenId && (
              <ReelCommentsSheet
                reelId={commentsOpenId}
                onClose={() => setCommentsOpenId(null)}
                onCountChange={(d) => onCommentCount(commentsOpenId, d)}
              />
            )}
          </div>

          {/* Desktop yan panel — yalnız aktiv reel üçün. */}
          <div className="hidden shrink-0 items-end pb-6 xl:flex">
            {activeItem && (
              <ReelSideRail
                key={activeItem.id}
                item={activeItem}
                commentDelta={commentDeltas[activeItem.id] ?? 0}
                muted={globalMuted}
                onToggleMute={() => setMuted(!globalMuted)}
                onOpenComments={() => setCommentsOpenId(activeItem.id)}
              />
            )}
          </div>

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

/** Boş feed — istifadəçini çıxılmaz ekranda saxlamamaq üçün həmişə bir çıxış verir. */
function EmptyState({
  loading,
  category,
  platform,
  onClearPlatform,
  onSwitch,
}: {
  loading: boolean;
  category: ReelCategory;
  platform: string | null;
  onClearPlatform: () => void;
  onSwitch: (c: ReelCategory) => void;
}) {
  if (loading) {
    return (
      <div className="grid h-full w-full place-items-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  const other: ReelCategory = category === "GAME" ? "STREAMING" : "GAME";
  return (
    <div className="grid h-full w-full place-items-center bg-black px-6 text-center text-white/70">
      <div>
        <p className="text-lg font-semibold text-white">Hələ video yoxdur</p>
        <p className="mt-1 text-sm text-white/50">
          {platform ? "Bu platforma üzrə video tapılmadı." : "Tezliklə yeni reels əlavə olunacaq."}
        </p>
        {platform ? (
          <button
            onClick={onClearPlatform}
            className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-900"
          >
            Bütün platformalar
          </button>
        ) : (
          category !== "ALL" && (
            <button
              onClick={() => onSwitch(other)}
              className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-900"
            >
              {other === "GAME" ? "Oyun videolarına bax" : "Film & serial videolarına bax"}
            </button>
          )
        )}
      </div>
    </div>
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
