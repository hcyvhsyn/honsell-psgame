"use client";

import { Heart, ThumbsDown, MessageCircle, ShoppingCart, Volume2, VolumeX } from "lucide-react";
import { fmtCount } from "./ReelActionRail";
import { useReelInteractions } from "./useReelInteractions";
import type { ReelFeedItem } from "./types";

/**
 * Desktop yan panel — YouTube Shorts tərzi: düymələr videonun KƏNARINDA (sağda),
 * dairəvi, tünd fonda. Aktiv reel üçün render olunur. `key={item.id}` ilə remount
 * edilməlidir ki, interaksiya baseline-i düzgün sıfırlansın.
 */
export default function ReelSideRail({
  item,
  commentDelta,
  muted,
  onToggleMute,
  onOpenComments,
}: {
  item: ReelFeedItem;
  commentDelta: number;
  muted: boolean;
  onToggleMute: () => void;
  onOpenComments: () => void;
}) {
  const { myReaction, displayLikes, displayDislikes, inCart, react, buy } = useReelInteractions(item);
  const hasCta = Boolean(item.cta.product || item.cta.href);

  return (
    <div className="flex flex-col items-center gap-5 text-white">
      <RailBtn
        label={fmtCount(displayLikes)}
        onClick={() => react(1)}
        active={myReaction === 1}
        activeClass="bg-rose-600/90"
      >
        <Heart className={`h-6 w-6 ${myReaction === 1 ? "fill-white" : ""}`} />
      </RailBtn>

      <RailBtn
        label={fmtCount(displayDislikes)}
        onClick={() => react(-1)}
        active={myReaction === -1}
        activeClass="bg-sky-600/90"
      >
        <ThumbsDown className={`h-6 w-6 ${myReaction === -1 ? "fill-white" : ""}`} />
      </RailBtn>

      <RailBtn label={fmtCount(item.counts.comments + commentDelta)} onClick={onOpenComments}>
        <MessageCircle className="h-6 w-6" />
      </RailBtn>

      <RailBtn label={muted ? "Səs" : "Səs"} onClick={onToggleMute}>
        {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
      </RailBtn>

      {/* Səbətə əlavə — aktiv məhsulun CTA-sı */}
      {hasCta && (
        <button
          onClick={buy}
          className="mt-1 flex flex-col items-center gap-1"
          title={item.cta.label}
        >
          <span
            className={`grid h-14 w-14 place-items-center rounded-full shadow-lg transition active:scale-95 ${
              inCart ? "bg-emerald-600" : "bg-violet-600 shadow-violet-600/40 hover:bg-violet-500"
            }`}
          >
            <ShoppingCart className="h-6 w-6" />
          </span>
          <span className="max-w-[84px] truncate text-xs font-bold">
            {inCart ? "Səbətdə ✓" : item.cta.label}
          </span>
        </button>
      )}
    </div>
  );
}

function RailBtn({
  children,
  label,
  onClick,
  active,
  activeClass,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span
        className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-90 ${
          active ? activeClass : "bg-white/10 hover:bg-white/20"
        }`}
      >
        {children}
      </span>
      <span className="text-xs font-semibold text-white/85">{label}</span>
    </button>
  );
}
