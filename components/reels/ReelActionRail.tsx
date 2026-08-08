"use client";

import {
  Heart,
  ThumbsDown,
  MessageCircle,
  Eye,
  ShoppingCart,
  Volume2,
  VolumeX,
  Share2,
  Check,
  Bookmark,
} from "lucide-react";
import type { ReelFeedItem } from "./types";

export function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

/**
 * Reels sağ hərəkət paneli (TikTok tərzi): bəyən / dislike / şərh / izlənmə +
 * "tək toxunuşla al" düyməsi və səs toggle-ı.
 */
export default function ReelActionRail({
  item,
  myReaction,
  likes,
  dislikes,
  comments,
  muted,
  onLike,
  onDislike,
  onComments,
  onShare,
  copied,
  onToggleSave,
  isSaved,
  onBuy,
  onToggleMute,
  hideBuy = false,
}: {
  item: ReelFeedItem;
  myReaction: number;
  likes: number;
  dislikes: number;
  comments: number;
  muted: boolean;
  onLike: () => void;
  onDislike: () => void;
  onComments: () => void;
  onShare: () => void;
  /** Link buferə kopyalandı (native paylaşma yoxdursa) — qısa müddət göstərilir. */
  copied: boolean;
  onToggleSave: () => void;
  /** Oyun → favoritlərdədir; film/serial → izləmə siyahısındadır. */
  isSaved: boolean;
  onBuy: () => void;
  onToggleMute: () => void;
  /** Altdakı alış paneli göstərilirsə true — rail-dəki səbət düyməsi təkrar olur. */
  hideBuy?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-white">
      <RailButton
        label={fmtCount(likes)}
        active={myReaction === 1}
        onClick={onLike}
        activeClass="text-rose-500"
      >
        <Heart className={`h-7 w-7 ${myReaction === 1 ? "fill-rose-500" : ""}`} />
      </RailButton>

      <RailButton
        label={fmtCount(dislikes)}
        active={myReaction === -1}
        onClick={onDislike}
        activeClass="text-sky-400"
      >
        <ThumbsDown className={`h-7 w-7 ${myReaction === -1 ? "fill-sky-400" : ""}`} />
      </RailButton>

      <RailButton label={fmtCount(comments)} onClick={onComments}>
        <MessageCircle className="h-7 w-7" />
      </RailButton>

      <RailButton
        label={isSaved ? "Saxlanıldı" : "Saxla"}
        onClick={onToggleSave}
        active={isSaved}
        activeClass="text-amber-400"
      >
        <Bookmark className={`h-7 w-7 ${isSaved ? "fill-amber-400" : ""}`} />
      </RailButton>

      <RailButton label={copied ? "Kopyalandı" : "Paylaş"} onClick={onShare}>
        {copied ? <Check className="h-7 w-7" /> : <Share2 className="h-7 w-7" />}
      </RailButton>

      <div className="flex flex-col items-center gap-1">
        <Eye className="h-6 w-6 opacity-90" />
        <span className="text-xs font-semibold">{fmtCount(item.counts.views)}</span>
      </div>

      {!hideBuy && (item.cta.product || item.cta.href) && (
        <button
          onClick={onBuy}
          className="flex flex-col items-center gap-1"
          title={item.cta.label}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 shadow-lg shadow-violet-600/40 transition active:scale-95">
            <ShoppingCart className="h-6 w-6" />
          </span>
          <span className="max-w-[64px] truncate text-[11px] font-bold">{item.cta.label}</span>
        </button>
      )}

      <button
        onClick={onToggleMute}
        className="grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur"
        title={muted ? "Səsi aç" : "Səsi bağla"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
    </div>
  );
}

function RailButton({
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
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition active:scale-90 ${
        active ? activeClass : "text-white"
      }`}
    >
      {children}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
