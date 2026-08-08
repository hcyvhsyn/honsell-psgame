"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Play, Pause, VolumeX, Volume2 } from "lucide-react";
import { useReelState } from "./ReelStateProvider";
import ReelActionRail from "./ReelActionRail";
import ReelBuyPanel, { hasBuyPanel } from "./ReelBuyPanel";
import { useReelInteractions } from "./useReelInteractions";
import { markReelSeen } from "./reelSeen";
import type { ReelFeedItem, ReelRole } from "./types";

/** İzlənməsi bu session-da artıq sayılmış reels (təkrar POST-un qarşısını alır). */
const viewedThisSession = new Set<string>();

/** Bir reel slot-u — poster (anında) + <video> (role-a görə) + mobil overlay rail.
 *  Desktop-da action düymələri videonun kənarında (ReelSideRail) göstərilir, ona görə
 *  buradakı overlay rail yalnız mobil-də (xl:hidden) görünür. */
function ReelSlotImpl({
  item,
  role,
  globalMuted,
  onToggleMute,
  onSoundBlocked,
  commentDelta,
  onOpenComments,
  onSeen,
}: {
  item: ReelFeedItem;
  role: ReelRole;
  globalMuted: boolean;
  onToggleMute: () => void;
  /** Brauzer səsli avtoplay-a icazə vermədi — UI səssiz vəziyyətə qayıtmalıdır. */
  onSoundBlocked: () => void;
  commentDelta: number;
  onOpenComments: (id: string) => void;
  /** Video sonuna çatdı → feed onu "görülmüş" kimi qeyd edir. */
  onSeen?: (id: string) => void;
}) {
  const { ensure } = useReelState();
  // `displayDislikes` / `isSaved` / `toggleSave` qəsdən götürülmür — düymələri
  // silinib, amma hook-dakı məntiq və API-lər qalır (izah ReelActionRail-dədir).
  const { myReaction, displayLikes, copied, react, buy, share } = useReelInteractions(item);
  const showBuyPanel = hasBuyPanel(item);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [posterHidden, setPosterHidden] = useState(false);
  const [needsTap, setNeedsTap] = useState(false); // autoplay bloklananda
  const [paused, setPaused] = useState(false); // istifadəçi əl ilə dayandırıb
  const [iconVisible, setIconVisible] = useState(false); // mərkəz ikonu (Instagram tərzi)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bu reel artıq "görülmüş" kimi qeyd olunub — loop-da təkrar qeyd etməsin. */
  const seenMarkedRef = useRef(false);

  // Görünən reels üçün per-user vəziyyəti çək.
  useEffect(() => {
    if (role !== "dormant") ensure([item.id]);
  }, [role, item.id, ensure]);

  // ─── Oynatma state machine (role → play/pause) ───────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (role === "active") {
      setPaused(false);
      v.muted = globalMuted;
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.then(() => setNeedsTap(false)).catch((err: DOMException) => {
          if (err?.name !== "NotAllowedError") return;
          if (!v.muted) {
            // Səsli avtoplay bloklandı (brauzer siyasəti). Videonu tamamilə
            // dayandırmaq əvəzinə SƏSSİZ oynadırıq — istifadəçi ən azı görüntünü
            // görür və bir toxunuşla səsi aça bilir. Saxlanmış "səs açıq" seçimi
            // POZULMUR: növbəti girişdə brauzer icazə verə bilər.
            v.muted = true;
            onSoundBlocked();
            v.play().catch(() => setNeedsTap(true));
            return;
          }
          setNeedsTap(true);
        });
      }
    } else {
      v.pause();
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

  useEffect(() => {
    const v = videoRef.current;
    return () => {
      v?.pause();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  function flashIcon(playing: boolean) {
    setIconVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setIconVisible(false), 700);
  }

  function togglePlayback() {
    const v = videoRef.current;
    if (!v) return;

    // Səssiz ikən İLK toxunuş səsi açır (TikTok/Instagram davranışı) — pauza yox.
    // Səs açıldıqdan sonra toxunuş yenidən adi pauza/oynat olur.
    if (globalMuted && !needsTap) {
      v.muted = false;
      onToggleMute();
      if (v.paused) v.play().catch(() => {});
      flashIcon(true);
      return;
    }

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
      flashIcon(false);
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Poster — anında paint. Poster yoxdursa video first-frame-ə düşürük. */}
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

      {/* Video — yalnız window-da mount olunur. */}
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
          onTimeUpdate={(e) => {
            // ⚠️ `loop` atributu səbəbindən `ended` hadisəsi HEÇ VAXT işə düşmür —
            // video sona çatanda sadəcə başa qayıdır. Ona görə tamamlanma burada,
            // vaxta baxaraq aşkarlanır.
            if (seenMarkedRef.current) return;
            const v = e.currentTarget;
            if (!Number.isFinite(v.duration) || v.duration <= 0) return;
            if (v.currentTime >= v.duration - 0.3) {
              seenMarkedRef.current = true;
              markReelSeen(item.id);
              onSeen?.(item.id);
            }
          }}
          onCanPlay={(e) => {
            if (role === "active" && e.currentTarget.paused) {
              e.currentTarget.muted = globalMuted;
              e.currentTarget.play().catch(() => {});
            }
          }}
        />
      )}

      {/* Tam ekran toxunuş qatı — pauza/oynat. */}
      <button
        onClick={togglePlayback}
        aria-label={paused || needsTap ? "Oynat" : "Dayandır"}
        className="absolute inset-0 z-10"
      />

      {/* Mərkəz ikonu — Instagram tərzi. */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 grid place-items-center transition-opacity duration-200 ${
          iconVisible || needsTap ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="grid h-[76px] w-[76px] place-items-center rounded-full bg-black/45 text-white backdrop-blur">
          {paused || needsTap ? <Play className="h-9 w-9 fill-white" /> : <Pause className="h-9 w-9 fill-white" />}
        </span>
      </div>

      {/* Səs — sağ üst küncdə. Əvvəllər BURADA "Səs üçün toxun" nişanı, rail-də isə
          ayrıca səs düyməsi vardı; ikisi eyni şeyi deyirdi. İndi bir elementdir:
          səssiz ikən yazı ilə genişlənir (səssiz avtoplay brauzer tələbidir, ona görə
          istifadəçi bir toxunuşla açılacağını görməlidir), səs açılanda ikona yığılır. */}
      {role === "active" && (
        <button
          onClick={onToggleMute}
          aria-label={globalMuted ? "Səsi aç" : "Səsi bağla"}
          className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition active:scale-95"
        >
          {globalMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {globalMuted && !needsTap && "Səs üçün toxun"}
        </button>
      )}

      {/* Alt gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

      {/* Platforma nişanı — YALNIZ film/serial reels-ində. Oyun reels-ində "PS5"
          onsuz da alış panelindəki sürüm çipində yazılır, ona görə burada təkrar idi;
          Netflix/Prime nişanı isə həqiqətən məlumat daşıyır. */}
      {item.category === "STREAMING" && item.platform.label && (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
          {item.platform.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.platform.logoUrl} alt="" className="h-4 w-4 rounded" />
          )}
          {item.platform.label}
        </div>
      )}

      {/* Başlıq (hər ölçüdə) + mobil overlay rail (yalnız mobil; desktop-da yan panel var). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 pr-2">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1 pb-2 text-white">
            {/* Başlıq boş ola bilər (Telegram-dan caption-suz gələn video) —
                boş <h2> alt gradientdə yersiz boşluq yaradır. */}
            {item.title && <h2 className="text-base font-bold drop-shadow">{item.title}</h2>}
            {item.caption && (
              <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow">{item.caption}</p>
            )}
          </div>

          <div className="pointer-events-auto xl:hidden">
            <ReelActionRail
              item={item}
              myReaction={myReaction}
              likes={displayLikes}
              comments={item.counts.comments + commentDelta}
              onLike={() => react(1)}
              onComments={() => onOpenComments(item.id)}
              onShare={share}
              copied={copied}
              onBuy={buy}
              // Panel varkən rail-dəki səbət düyməsi eyni işi görür — təkrarı gizlət.
              hideBuy={showBuyPanel}
            />
          </div>
        </div>

        {/* Alış paneli — videonun altında, sürüm çipləri + canlı qiymət. */}
        {showBuyPanel && (
          <div className="mt-2.5">
            <ReelBuyPanel item={item} />
          </div>
        )}
      </div>
    </div>
  );
}

const ReelSlot = memo(ReelSlotImpl);
export default ReelSlot;
