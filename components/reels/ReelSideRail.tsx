"use client";

import { Heart, MessageCircle, ShoppingCart, Share2, Check } from "lucide-react";
import { fmtCount } from "./ReelActionRail";
import { hasBuyPanel } from "./ReelBuyPanel";
import { useReelInteractions } from "./useReelInteractions";
import type { ReelFeedItem } from "./types";

/**
 * Desktop yan panel — YouTube Shorts tərzi: düymələr videonun KƏNARINDA (sağda),
 * dairəvi, tünd fonda. Aktiv reel üçün render olunur. `key={item.id}` ilə remount
 * edilməlidir ki, interaksiya baseline-i düzgün sıfırlansın.
 *
 * Tərkib mobil rail ilə EYNİDİR (bəyən / şərh / paylaş) — səbəblər
 * [ReelActionRail.tsx](components/reels/ReelActionRail.tsx) şərhindədir. İki panel
 * fərqli düymə dəsti göstərsə istifadəçi cihaz dəyişəndə funksiya itirdiyini sanır.
 */
export default function ReelSideRail({
  item,
  commentDelta,
  onOpenComments,
}: {
  item: ReelFeedItem;
  commentDelta: number;
  onOpenComments: () => void;
}) {
  const { myReaction, displayLikes, inCart, copied, react, buy, share } =
    useReelInteractions(item);
  // Videonun altındakı alış paneli varsa (sürüm çipləri + qiymət) buradakı səbət
  // düyməsi eyni işi görür və iki fərqli qiymət mənbəyi təəssüratı yaradır.
  const hasCta = Boolean(item.cta.product || item.cta.href) && !hasBuyPanel(item);

  return (
    <div className="flex flex-col items-center gap-5 text-white">
      <RailBtn
        count={displayLikes}
        label="Bəyən"
        onClick={() => react(1)}
        active={myReaction === 1}
        activeClass="bg-rose-600/90"
      >
        <Heart className={`h-6 w-6 ${myReaction === 1 ? "fill-white" : ""}`} />
      </RailBtn>

      <RailBtn
        count={item.counts.comments + commentDelta}
        label="Şərhlər"
        onClick={onOpenComments}
      >
        <MessageCircle className="h-6 w-6" />
      </RailBtn>

      <RailBtn count={0} label={copied ? "Kopyalandı" : "Paylaş"} onClick={share}>
        {copied ? <Check className="h-6 w-6" /> : <Share2 className="h-6 w-6" />}
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
  count,
  label,
  onClick,
  active,
  activeClass,
}: {
  children: React.ReactNode;
  /** 0 olanda say GÖSTƏRİLMİR (mobil rail ilə eyni qayda). */
  count: number;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex flex-col items-center gap-1.5"
    >
      <span
        className={`grid h-12 w-12 place-items-center rounded-full transition active:scale-90 ${
          active ? activeClass : "bg-white/10 hover:bg-white/20"
        }`}
      >
        {children}
      </span>
      {count > 0 && (
        <span className="text-xs font-semibold text-white/85">{fmtCount(count)}</span>
      )}
    </button>
  );
}
