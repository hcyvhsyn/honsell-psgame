"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useSession } from "@/components/SessionProvider";
import { useReelState } from "./ReelStateProvider";
import ReelActionRail from "./ReelActionRail";
import ReelCommentsSheet from "./ReelCommentsSheet";
import type { ReelFeedItem, ReelRole } from "./types";

/** İzlənməsi bu session-da artıq sayılmış reels (təkrar POST-un qarşısını alır). */
const viewedThisSession = new Set<string>();

/** Bir reel slot-u — poster (anında) + <video> (role-a görə) + hərəkət paneli. */
function ReelSlotImpl({
  item,
  role,
  globalMuted,
  onToggleMute,
}: {
  item: ReelFeedItem;
  role: ReelRole;
  globalMuted: boolean;
  onToggleMute: () => void;
}) {
  const router = useRouter();
  const { add, has } = useCart();
  const { user } = useSession();
  const { reactions, ensure, setLocalReaction } = useReelState();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [posterHidden, setPosterHidden] = useState(false);
  const [needsTap, setNeedsTap] = useState(false); // autoplay bloklananda
  const [paused, setPaused] = useState(false); // istifadəçi əl ilə dayandırıb
  const [iconVisible, setIconVisible] = useState(false); // mərkəz ikonu (Instagram tərzi)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showComments, setShowComments] = useState(false);

  // Optimistik saylar (server saylarının üstünə fərq).
  const myReaction = reactions[item.id] ?? 0;
  const [likeDelta, setLikeDelta] = useState(0);
  const [dislikeDelta, setDislikeDelta] = useState(0);
  const [commentDelta, setCommentDelta] = useState(0);

  // Görünən reels üçün per-user vəziyyəti çək.
  useEffect(() => {
    if (role !== "dormant") ensure([item.id]);
  }, [role, item.id, ensure]);

  // ─── Oynatma state machine (role → play/pause) ───────────────────────────
  // Yalnız `role` dəyişəndə işləyir — mute toggle-ı burada replay etmir (o, ayrı
  // effektlə yalnız v.muted-i sinxronlaşdırır), beləcə əl ilə pauza qorunur.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (role === "active") {
      setPaused(false);
      v.muted = globalMuted;
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.then(() => setNeedsTap(false)).catch((err: DOMException) => {
          // Autoplay siyasəti/interrupt — muted play adətən keçir; keçmirsə tap göstər.
          if (err?.name === "NotAllowedError") setNeedsTap(true);
        });
      }
    } else {
      v.pause();
      // active-dən çıxanda posteri geri gətirmirik (buffer istidə qalsın).
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Aktiv videonun səsini qlobal state ilə sinxron saxla.
  useEffect(() => {
    const v = videoRef.current;
    if (v && role === "active") v.muted = globalMuted;
  }, [globalMuted, role]);

  // ─── İzlənmə sayğacı: aktiv + oynayır ≥2s → bir dəfə POST ────────────────
  useEffect(() => {
    if (role !== "active" || viewedThisSession.has(item.id)) return;
    const threshold = Math.min(2000, Math.max(800, item.durationMs * 0.5 || 2000));
    const t = setTimeout(() => {
      if (viewedThisSession.has(item.id)) return;
      viewedThisSession.add(item.id);
      fetch(`/api/reels/${item.id}/view`, { method: "POST", keepalive: true }).catch(() => {});
    }, threshold);
    return () => clearTimeout(t);
  }, [role, item.id, item.durationMs]);

  // ─── Buffer təmizliyi ────────────────────────────────────────────────────
  // Slot window-dan çıxanda <video> onsuz da React tərəfindən DOM-dan silinir
  // (role="dormant" → render olunmur) və brauzer resursu buraxır. Manual
  // removeAttribute("src")+load() ETMİRİK — StrictMode (dev) effect-i iki dəfə
  // çağırdığından bu, aktiv videonun src-ni silib oynatmağı bloklayırdı.
  useEffect(() => {
    const v = videoRef.current;
    return () => {
      v?.pause();
    };
  }, []);

  // ─── Reaksiyalar (optimistik) ────────────────────────────────────────────
  async function react(value: 1 | -1) {
    if (!user) {
      router.push("/login?next=/reels");
      return;
    }
    const prev = myReaction;
    const next = prev === value ? 0 : value;

    // Optimistik say fərqləri
    setLikeDelta((d) => d + (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0));
    setDislikeDelta((d) => d + (next === -1 ? 1 : 0) - (prev === -1 ? 1 : 0));
    setLocalReaction(item.id, next);

    try {
      const res = await fetch(`/api/reels/${item.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (res.ok && typeof data.myReaction === "number") {
        setLocalReaction(item.id, data.myReaction);
      }
    } catch {
      // rollback
      setLocalReaction(item.id, prev);
      setLikeDelta((d) => d - ((next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0)));
      setDislikeDelta((d) => d - ((next === -1 ? 1 : 0) - (prev === -1 ? 1 : 0)));
    }
  }

  function buy() {
    const p = item.cta.product;
    if (p) {
      if (!has(p.id)) {
        add({
          id: p.id,
          title: p.title,
          imageUrl: p.imageUrl,
          finalAzn: p.finalAzn,
          productType: p.productType,
          ...(p.store && p.store !== "SERVICE" ? { store: p.store } : {}),
        });
      }
      router.push("/cart");
    } else if (item.cta.href) {
      window.open(item.cta.href, "_blank", "noopener");
    }
  }

  // Mərkəz ikonunu göstər; oynayırsa ~700ms sonra gizlət (Instagram tərzi),
  // pauzada isə görünən qalsın.
  function flashIcon(playing: boolean) {
    setIconVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setIconVisible(false), 700);
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Ekrana toxunuş = pauza/oynat (səs üçün sağ paneldə ayrıca düymə var).
  function togglePlayback() {
    const v = videoRef.current;
    if (!v) return;
    if (needsTap) {
      v.play().then(() => {
        setNeedsTap(false);
        flashIcon(true);
      }).catch(() => {});
      return;
    }
    if (v.paused) {
      v.muted = globalMuted;
      v.play().then(() => {
        setPaused(false);
        flashIcon(true);
      }).catch(() => {});
    } else {
      v.pause();
      setPaused(true);
      flashIcon(false); // pauzada ikon görünən qalır
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Poster — anında paint (unoptimized birbaşa CDN). Window-dan kənarda lazy.
          Poster yoxdursa (URL idxalında CORS taint) video first-frame-ə düşürük. */}
      {item.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.posterUrl}
          alt={item.title}
          loading={role === "dormant" ? "lazy" : "eager"}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            posterHidden ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {/* Video — yalnız window-da (dormant deyil) mount olunur. */}
      {role !== "dormant" && (
        <video
          ref={videoRef}
          src={item.videoUrl}
          poster={item.posterUrl}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          loop
          muted={role === "active" ? globalMuted : true}
          preload="auto"
          onPlaying={() => {
            setPosterHidden(true);
            setPaused(false);
          }}
          onCanPlay={(e) => {
            // Yükləmə/StrictMode race-ində play() qaçırılıbsa özü bərpa olsun.
            if (role === "active" && e.currentTarget.paused) {
              e.currentTarget.muted = globalMuted;
              e.currentTarget.play().catch(() => {});
            }
          }}
        />
      )}

      {/* Tam ekran toxunuş qatı — ortaya (və ya hər yerə) basanda pauza/oynat.
          z-10; action rail düymələri z-20-də üstdədir, ona görə onlara mane olmur. */}
      <button
        onClick={togglePlayback}
        aria-label={paused || needsTap ? "Oynat" : "Dayandır"}
        className="absolute inset-0 z-10"
      />

      {/* Mərkəz ikonu — Instagram tərzi: normalda gizli, toxunanda görünür,
          oynayarkən ~700ms sonra itir; pauzada görünən qalır. Klikləri udmur. */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 grid place-items-center transition-opacity duration-200 ${
          iconVisible || needsTap ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="grid h-[76px] w-[76px] place-items-center rounded-full bg-black/45 text-white backdrop-blur">
          {paused || needsTap ? (
            <Play className="h-9 w-9 fill-white" />
          ) : (
            <Pause className="h-9 w-9 fill-white" />
          )}
        </span>
      </div>

      {/* Alt gradient (mətn oxunaqlığı) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Platforma nişanı */}
      {item.platform.label && (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
          {item.platform.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.platform.logoUrl} alt="" className="h-4 w-4 rounded" />
          )}
          {item.platform.label}
        </div>
      )}

      {/* Başlıq + action rail. Konteyner pointer-events-none-dir ki, boş orta
          hissə mərkəz toxunuşunu udmasın; yalnız action rail düymələri kliklənir. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-4 pr-2">
        <div className="min-w-0 flex-1 pb-2 text-white">
          <h2 className="text-base font-bold drop-shadow">{item.title}</h2>
          {item.caption && (
            <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow">{item.caption}</p>
          )}
        </div>

        <div className="pointer-events-auto">
          <ReelActionRail
            item={item}
            myReaction={myReaction}
            likes={item.counts.likes + likeDelta}
            dislikes={item.counts.dislikes + dislikeDelta}
            comments={item.counts.comments + commentDelta}
            muted={globalMuted}
            onLike={() => react(1)}
            onDislike={() => react(-1)}
            onComments={() => setShowComments(true)}
            onBuy={buy}
            onToggleMute={onToggleMute}
          />
        </div>
      </div>

      {showComments && (
        <ReelCommentsSheet
          reelId={item.id}
          onClose={() => setShowComments(false)}
          onCountChange={(d) => setCommentDelta((c) => c + d)}
        />
      )}
    </div>
  );
}

const ReelSlot = memo(ReelSlotImpl);
export default ReelSlot;
