"use client";

import { Heart, MessageCircle, ShoppingCart, Share2, Check } from "lucide-react";
import type { ReelFeedItem } from "./types";

export function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

/**
 * Reels sağ hərəkət paneli (mobil overlay) — QƏSDƏN yalnız 3 ikon.
 *
 * Ekranda 12 element "Səbətə at" düyməsi ilə yarışırdı. Silinənlər və səbəb:
 *  • dislike — heç bir yerdə istifadə olunmur (sıralama `lib/reelRanking.ts`-dədir,
 *    reaksiyaya baxmır), ticarət feed-ində mənfi siqnal yersizdir
 *  • baxış sayı — müştəriyə heç nə vermir; kiçik rəqəm ("3") məhsulun boş olduğunu
 *    elan edir, yəni ZƏRƏR verir
 *  • saxla — oyun məhsul səhifəsindən favoritə düşür
 *  • səs — slot-un sağ üst küncündəki "Səs üçün toxun" nişanı ilə birləşdi
 *
 * Alt yazılar da yoxdur (TikTok/Instagram eynisini edir) və **say yalnız 0-dan
 * böyük olanda** göstərilir — hər ikonun altındakı "0" boşluqdan pisdir.
 *
 * ⚠️ API-lər toxunulmayıb: `react(-1)` və `toggleSave` hook-da qalır, sadəcə onları
 * çağıran düymə yoxdur. Geri qaytarmaq bir düymədir, mövcud data itmir.
 */
export default function ReelActionRail({
  item,
  myReaction,
  likes,
  comments,
  onLike,
  onComments,
  onShare,
  copied,
  onBuy,
  hideBuy = false,
}: {
  item: ReelFeedItem;
  myReaction: number;
  likes: number;
  comments: number;
  onLike: () => void;
  onComments: () => void;
  onShare: () => void;
  /** Link buferə kopyalandı (native paylaşma yoxdursa) — ikon qısa müddət Check olur. */
  copied: boolean;
  onBuy: () => void;
  /** Altdakı alış paneli göstərilirsə true — rail-dəki səbət düyməsi təkrar olur. */
  hideBuy?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-white">
      <RailButton
        count={likes}
        onClick={onLike}
        active={myReaction === 1}
        activeClass="text-rose-500"
        label="Bəyən"
      >
        <Heart className={`h-7 w-7 ${myReaction === 1 ? "fill-rose-500" : ""}`} />
      </RailButton>

      <RailButton count={comments} onClick={onComments} label="Şərhlər">
        <MessageCircle className="h-7 w-7" />
      </RailButton>

      <RailButton count={0} onClick={onShare} label="Paylaş">
        {copied ? <Check className="h-7 w-7" /> : <Share2 className="h-7 w-7" />}
      </RailButton>

      {!hideBuy && (item.cta.product || item.cta.href) && (
        <button
          onClick={onBuy}
          className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 shadow-lg shadow-violet-600/40 transition active:scale-95"
          title={item.cta.label}
          aria-label={item.cta.label}
        >
          <ShoppingCart className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

function RailButton({
  children,
  count,
  label,
  onClick,
  active,
  activeClass,
}: {
  children: React.ReactNode;
  /** 0 olanda say GÖSTƏRİLMİR — sıfırlar rail-i lüzumsuz doldururdu. */
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
      className={`flex flex-col items-center gap-1 drop-shadow-lg transition active:scale-90 ${
        active ? activeClass : "text-white"
      }`}
    >
      {children}
      {count > 0 && <span className="text-xs font-semibold">{fmtCount(count)}</span>}
    </button>
  );
}
