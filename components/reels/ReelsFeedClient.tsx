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
import ReelCategoryChip from "./ReelCategoryChip";
import ReelExhaustedScreen from "./ReelExhaustedScreen";
import { readStoredReelCategory, storeReelCategory } from "./reelCategory";
import { isVolumeUpKey, readSoundPreference, storeSoundPreference } from "./reelSound";
import { clearSeenReels, readSeenReels } from "./reelSeen";
import { createReelSeed } from "@/lib/reelRanking";
import type { ReelCategory, ReelFeedItem, ReelPlatformChip, ReelRole } from "./types";

/** Bir slot-un yüksəkliyi — mobil tam ekran, desktop-da telefon-eni sütun. */
const SLOT_H = "h-[100dvh] sm:h-[92dvh]";

type Page = { items: ReelFeedItem[]; nextCursor: number | null; exhausted?: boolean };
type Feed = { items: ReelFeedItem[]; nextCursor: number | null; loaded: boolean; exhausted: boolean };

const LOADING_FEED: Feed = { items: [], nextCursor: null, loaded: false, exhausted: false };

/**
 * Reels feed — YouTube Shorts tərzi.
 *  • Mobil: tam ekran, action düymələri video üzərində overlay (ReelSlot içində).
 *  • Desktop: mərkəzdə video sütunu, action düymələri KƏNARDA (ReelSideRail).
 *  • CSS scroll-snap + tək IntersectionObserver ilə aktiv slot; active±1 <video>.
 *
 * KATEQORİYA: oyun və film/serial auditoriyaları ayrıdır. Seçim client-də
 * (localStorage) saxlanılır — server onu bilmir, çünki səhifə statik qalmalıdır.
 * Seçim həll olunana qədər feed RENDER OLUNMUR (SSR HTML hidrasiyadan ƏVVƏL paint
 * olunur, ona görə useLayoutEffect yanlış kateqoriyanın görünməsini əngəlləyə bilmir).
 *
 * TƏKRAR-ÖNLƏMƏ: görülmüş videolar `reelSeen.ts` dəftərində saxlanılır və
 * `POST /api/reels/feed` onları süzür; sıra ziyarətə məxsus `seed` ilə qarışdırılır.
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
  /** Üstdəki çipdən ƏL İLƏ açılan vərəq — ilk giriş qapısından fərqli olaraq bağlanır. */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [platform, setPlatform] = useState<string | null>(null);
  const [feed, setFeed] = useState<Feed>(LOADING_FEED);
  const [restartKey, setRestartKey] = useState(0);

  const [pinned, setPinned] = useState<ReelFeedItem | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(true);
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null);
  const [commentDeltas, setCommentDeltas] = useState<Record<string, number>>({});
  const [, startTransition] = useTransition();
  const loadingRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  /** Ziyarətə məxsus qarışdırma toxumu — səhifələmə boyu SABİT qalmalıdır. */
  const seedRef = useRef("");
  /** Dəftərin CANLI vəziyyəti — yeni tamamlanan videolar buraya düşür. */
  const seenRef = useRef<Set<string>>(new Set());
  /**
   * Cari feed sessiyası üçün DONDURULMUŞ süzgəc siyahısı.
   *
   * ⚠️ Səhifələmə zamanı `excludeIds`-i yeniləsək server hovuzu kiçilir və offset-lər
   * sürüşür → istifadəçi element atlayır və ya təkrar görür. Ona görə siyahı yalnız
   * yeni feed sessiyası başlayanda (kateqoriya/platforma dəyişimi, restart) yenilənir.
   */
  const excludeRef = useRef<string[]>([]);

  // Saxlanmış seçimləri paint-dən əvvəl oxu (hidrasiya uyğunsuzluğu olmasın deyə
  // render-də deyil, layout effektində).
  useLayoutEffect(() => {
    seedRef.current = createReelSeed();
    seenRef.current = new Set(readSeenReels());

    const stored = readStoredReelCategory();
    if (stored) setCategory(stored);
    else {
      setCategory("GAME"); // qapının arxasında məhsul görünsün
      setGateOpen(true);
    }
    if (readSoundPreference()) setGlobalMuted(false);
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setGlobalMuted(next);
    storeSoundPreference(!next);
  }, []);

  /**
   * SSR-dən gələn statik səhifə — dəftərə görə DƏRHAL süzülür.
   * Şəxsiləşdirilmiş cavabı gözləməsək belə görülmüş video bir kadr görünmür.
   */
  const ssrPlaceholder = useCallback(
    (cat: ReelCategory): Feed => {
      // Yalnız GAME/STREAMING SSR-də gəlir; ALL və SAVED client-də çəkilir.
      if (cat !== "GAME" && cat !== "STREAMING") return LOADING_FEED;
      const src = cat === "GAME" ? initialGame : initialStreaming;
      const seen = seenRef.current;
      return {
        items: src.items.filter((i) => !seen.has(i.id)),
        nextCursor: null,
        loaded: false, // şəxsi cavab gələnə qədər "yüklənir" sayılır
        exhausted: false,
      };
    },
    [initialGame, initialStreaming],
  );

  /** Şəxsiləşdirilmiş feed sorğusu. `cursor: 0` yeni sessiya başladır. */
  const fetchFeed = useCallback(
    async (cat: ReelCategory, plat: string | null, cursor: number): Promise<Page | null> => {
      if (cursor === 0) excludeRef.current = Array.from(seenRef.current);
      try {
        const res = await fetch("/api/reels/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            category: cat,
            platform: plat,
            cursor,
            seed: seedRef.current,
            excludeIds: excludeRef.current,
          }),
        });
        if (!res.ok) return null;
        return (await res.json()) as Page;
      } catch {
        return null;
      }
    },
    [],
  );

  // Kateqoriya / platforma / restart dəyişəndə feed sıfırdan qurulur.
  useEffect(() => {
    if (!category) return;
    let cancelled = false;

    // Platforma süzgəci yoxdursa SSR məzmununu dərhal göstər (boş ekran olmasın).
    setFeed(platform ? LOADING_FEED : ssrPlaceholder(category));
    setActiveIndex(0);

    fetchFeed(category, platform, 0).then((data) => {
      if (cancelled) return;
      if (!data) {
        // Şəbəkə xətası — SSR məzmunu ilə davam et, boş ekran göstərmə.
        setFeed((prev) => ({ ...prev, loaded: true }));
        return;
      }
      setFeed({
        items: data.items ?? [],
        nextCursor: data.nextCursor ?? null,
        loaded: true,
        exhausted: Boolean(data.exhausted),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [category, platform, restartKey, ssrPlaceholder, fetchFeed]);

  function pickCategory(next: ReelCategory) {
    // "Saxladıqlarım" MƏZMUN SEÇİMİ deyil, müvəqqəti baxışdır — yadda saxlasaq
    // növbəti giriş boş siyahı ilə açılardı.
    if (next !== "SAVED") storeReelCategory(next);
    setCategory(next);
    setGateOpen(false);
    setSheetOpen(false);
    setPlatform(null);
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ top: 0 });
  }

  /** "Əvvəldən başla" — dəftər təmizlənir, yeni toxumla feed yenidən qurulur. */
  function restart() {
    clearSeenReels();
    seenRef.current = new Set();
    seedRef.current = createReelSeed();
    setPinned(null);
    setRestartKey((k) => k + 1);
    scrollerRef.current?.scrollTo({ top: 0 });
  }

  /** Video sonuna çatdı — dəftərə düşür (cari səhifələməyə TƏSİR ETMİR). */
  const onSeen = useCallback((id: string) => {
    seenRef.current.add(id);
  }, []);

  // Deep link — paylaşılan reel feed-in BAŞINA qoyulur və kateqoriya ona
  // uyğunlaşdırılır. Görülmüş olsa belə göstərilir (açıq niyyətdir) və dəftərdən
  // süzülmür. Saxlanmış kateqoriya seçimi DƏYİŞDİRİLMİR — bir dəfəlik baxışdır.
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

  // Pin-lənmiş reel siyahının başında, təkrarsız.
  const items = useMemo(() => {
    if (!pinned) return feed.items;
    return [pinned, ...feed.items.filter((i) => i.id !== pinned.id)];
  }, [pinned, feed.items]);

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
    const cursor = feed.nextCursor;
    if (loadingRef.current || cursor == null || !category) return;
    loadingRef.current = true;
    try {
      const data = await fetchFeed(category, platform, cursor);
      if (!data) return;
      startTransition(() => {
        setFeed((prev) => {
          const seen = new Set(prev.items.map((p) => p.id));
          const fresh = (data.items ?? []).filter((it) => !seen.has(it.id));
          return {
            items: [...prev.items, ...fresh],
            nextCursor: data.nextCursor ?? null,
            loaded: true,
            exhausted: prev.exhausted,
          };
        });
      });
    } finally {
      loadingRef.current = false;
    }
  }, [feed.nextCursor, category, platform, fetchFeed]);

  useEffect(() => {
    if (feed.nextCursor != null && activeIndex >= items.length - 3) loadMore();
  }, [activeIndex, items.length, feed.nextCursor, loadMore]);

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
  // "Hamısını gördün" YALNIZ dəftər doludursa. Dəftər boş ikən boş nəticə
  // "kataloqda video yoxdur" deməkdir — mesajlar qarışmamalıdır.
  const showExhausted = feed.loaded && items.length === 0 && feed.exhausted && seenRef.current.size > 0;

  return (
    <ReelStateProvider>
      {/* İlk giriş qapısı — bağlana BİLMİR (onClose verilmir), seçim məcburidir. */}
      {gateOpen && <ReelCategoryGate onPick={pickCategory} />}

      {/* Sonradan dəyişmək — eyni vərəq, amma bağlanan. */}
      {sheetOpen && (
        <ReelCategoryGate
          onPick={pickCategory}
          current={category}
          onClose={() => setSheetOpen(false)}
          platforms={platforms}
          activePlatform={platform}
          onPlatformChange={setPlatform}
        />
      )}

      {/* Kateqoriya çipi — home linkinin yanında (sol üst). `app/reels/page.tsx`-dəki
          home düyməsi `left-4 top-4`-dədir, ona görə çip `left-16`-dan başlayır. */}
      <div className="pointer-events-none fixed left-16 top-4 z-[90]">
        <ReelCategoryChip
          category={category}
          platforms={platforms}
          activePlatform={platform}
          onOpen={() => setSheetOpen(true)}
        />
      </div>

      <div className="flex justify-center bg-black">
        <div className="flex w-full items-stretch justify-center gap-3 sm:w-auto sm:gap-5">
          <div className={`relative ${SLOT_H} w-full sm:w-[430px] sm:max-w-full`}>
            {showExhausted ? (
              <ReelExhaustedScreen
                category={category}
                onRestart={restart}
                onSwitchCategory={pickCategory}
              />
            ) : items.length === 0 ? (
              <EmptyState
                loading={!feed.loaded}
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
                      onSeen={onSeen}
                      commentDelta={commentDeltas[item.id] ?? 0}
                      onOpenComments={setCommentsOpenId}
                    />
                  </div>
                ))}

                {feed.nextCursor != null && (
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

/**
 * Boş feed — kataloqda HEÇ video yoxdur (admin yayımlamayıb).
 * "Hamısını gördün" halı ilə qarışdırma: ona `ReelExhaustedScreen` baxır.
 */
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

  // "Saxladıqlarım" boşdursa səbəb kataloq deyil, istifadəçinin hələ heç nə
  // saxlamamasıdır — mesaj fərqli olmalıdır.
  if (category === "SAVED") {
    return (
      <div className="grid h-full w-full place-items-center bg-black px-6 text-center">
        <div>
          <p className="text-lg font-semibold text-white">Hələ heç nə saxlamamısan</p>
          <p className="mt-1 text-sm text-white/50">
            Bəyəndiyin videoda <b>Saxla</b> düyməsinə bas — oyunlar favoritlərə, film və
            seriallar izləmə siyahısına düşür.
          </p>
          <button
            onClick={() => onSwitch("GAME")}
            className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-900"
          >
            Videolara qayıt
          </button>
        </div>
      </div>
    );
  }

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
