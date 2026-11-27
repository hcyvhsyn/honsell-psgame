"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

type Props = {
  game: {
    id: string;
    title: string;
    imageUrl: string | null;
    finalAzn: number;
    originalAzn?: number | null;
    productType: string;
  };
  /** Müşahidə olunan qiymət kartının id-si (page.tsx-dəki `<aside>`). */
  targetId?: string;
};

/**
 * Telefonda (< lg) qiymət kartı ekrandan YUXARI çıxanda altda yapışan qiymət + "Səbətə at".
 * Müştəri treylerə/ekran görüntülərinə baxarkən alış üçün geri sürüşməli olmasın.
 *
 * - Alt menyunun (`MobileBottomNav`, ~62px + safe-area) ÜSTÜNDƏ oturur.
 * - `backdrop-blur` YOXDUR (CLAUDE.md → performans qaydaları) — tutqun fon.
 * - Görünəndə `<body data-sticky-buy="1">` qoyur ki, AI düyməsi (AskAiFloat) yuxarı qalxsın
 *   və zolağın düyməsini örtməsin; qiymət kartı ekrandaykən isə `data-buy-box-in-view="1"` —
 *   AI düyməsi telefonda gizlənir (globals.css).
 */
export default function StickyBuyBar({ game, targetId = "game-buy-box" }: Props) {
  const { add, has, hydrated } = useCart();
  const inCart = hydrated && has(game.id);
  const [visible, setVisible] = useState(false);
  const [boxInView, setBoxInView] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Yalnız kart yuxarıda qalanda (aşağı sürüşüb keçəndə) göstər — səhifə açılanda kart
        // hələ görünmürsə (aşağıdadırsa) zolaq onu təkrarlamasın.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        setBoxInView(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  useEffect(() => {
    if (visible) document.body.dataset.stickyBuy = "1";
    else delete document.body.dataset.stickyBuy;
    return () => {
      delete document.body.dataset.stickyBuy;
    };
  }, [visible]);

  // Qiymət kartı ekrandadırsa AI düyməsi (sağ alt künc) "Səbətə əlavə et"-i örtürdü — o vaxt gizlənir.
  useEffect(() => {
    if (boxInView) document.body.dataset.buyBoxInView = "1";
    else delete document.body.dataset.buyBoxInView;
    return () => {
      delete document.body.dataset.buyBoxInView;
    };
  }, [boxInView]);

  return (
    <div
      aria-hidden={!visible}
      className={`honsell-sticky-buy fixed inset-x-0 z-[65] px-3 transition duration-200 lg:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 70px)" }}
    >
      <div className="mx-auto flex max-w-[30rem] items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-2 pl-4 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-zinc-950/95">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{game.title}</p>
          <p className="flex items-baseline gap-2">
            <span className="text-lg font-black leading-tight text-zinc-950 dark:text-white">
              {game.finalAzn.toFixed(2)}₼
            </span>
            {game.originalAzn != null && (
              <span className="text-xs font-semibold text-zinc-400 line-through">
                {game.originalAzn.toFixed(2)}₼
              </span>
            )}
          </p>
        </div>
        {inCart ? (
          <Link
            href="/cart"
            tabIndex={visible ? 0 : -1}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
          >
            <Check className="h-4 w-4" /> Səbətdədir
          </Link>
        ) : (
          <button
            type="button"
            tabIndex={visible ? 0 : -1}
            onClick={() => add(game)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#6D28D9] px-4 text-sm font-bold text-white transition hover:bg-[#5B21B6]"
          >
            <ShoppingCart className="h-4 w-4" /> Səbətə at
          </button>
        )}
      </div>
    </div>
  );
}
