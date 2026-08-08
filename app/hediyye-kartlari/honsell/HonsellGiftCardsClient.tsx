"use client";

import Image from "next/image";
import { BadgeCheck, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { fmtThousands } from "@/lib/format";
import ReferralBadge from "@/components/ReferralBadge";

type Card = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
  denominationAzn: number;
};

/** Serverin sətir başına limiti (app/api/cart/checkout → `Math.min(20, …)`). */
const MAX_PER_LINE = 20;

/**
 * Nominal pillələri — 8 kart eyni rəngdə olanda siyahı monoton görünür və
 * müştəri dəyər fərqini oxumur. Üç pillə həm vizual ritm verir, həm «böyük
 * nominal = daha dəyərli» mesajını çatdırır.
 */
function tierOf(azn: number) {
  if (azn >= 500) {
    return {
      face: "from-[#b45309] via-[#a21caf] to-[#4c1d95]",
      ring: "ring-amber-400/40",
      glow: "shadow-amber-500/20",
      label: "text-amber-200",
    };
  }
  if (azn >= 50) {
    return {
      face: "from-[#a21caf] via-[#7a00ff] to-[#2b1170]",
      ring: "ring-fuchsia-400/35",
      glow: "shadow-fuchsia-500/20",
      label: "text-fuchsia-200",
    };
  }
  return {
    face: "from-[#7a00ff] via-[#5b21b6] to-[#1e1b4b]",
    ring: "ring-violet-400/35",
    glow: "shadow-violet-500/20",
    label: "text-violet-200",
  };
}

export default function HonsellGiftCardsClient({ cards }: { cards: Card[] }) {
  const { add, setQty, items, hydrated } = useCart();

  function addToCart(card: Card) {
    add({
      id: card.id,
      title: card.title,
      imageUrl: card.imageUrl ?? null,
      finalAzn: card.priceAznCents / 100,
      productType: "HONSELL_GIFT_CARD",
    });
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => {
        // Hədiyyə sətirləri (`gift`) ayrıca sətirdir, ona görə kənarlaşdırılır.
        const qty = hydrated ? (items.find((i) => i.id === c.id && !i.gift)?.qty ?? 0) : 0;
        const price = c.priceAznCents / 100;
        // Nominal ilə ödəniş fərqlidirsə (endirimli satış) ikisi də göstərilir;
        // 1:1 olanda qiyməti təkrar yazmaq şüuru yükləyir.
        const hasMarkup = Math.abs(price - c.denominationAzn) >= 0.01;
        const tier = tierOf(c.denominationAzn);

        return (
          <li key={c.id} className="group relative">
            <div
              className={`flex h-full flex-col overflow-hidden rounded-[22px] bg-white ring-1 ring-zinc-200 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_-16px_rgba(168,85,247,0.4)] hover:ring-fuchsia-400 dark:bg-[#0c0a14] dark:ring-white/10 dark:hover:ring-fuchsia-500/60`}
            >
              {/* ─── Kart üzü ─────────────────────────────────────────────
                  Məhsulların `imageUrl`-i yoxdur, ona görə boş şəkil qutusu
                  əvəzinə nominalın özü vizual olur. Admin şəkil yükləsə,
                  şəkil üstünlük alır. */}
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                {c.imageUrl ? (
                  <>
                    <Image
                      src={c.imageUrl}
                      alt={c.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                      unoptimized
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  </>
                ) : (
                  <div
                    className={`relative flex h-full w-full flex-col justify-between bg-gradient-to-br p-4 ${tier.face} ring-1 ${tier.ring} ring-inset`}
                  >
                    <span aria-hidden className="gc-sheen pointer-events-none absolute inset-0" />
                    <div className="relative flex items-start justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] !text-white/85">
                        Honsell
                      </span>
                      <span className="grid h-5 w-7 shrink-0 place-items-center rounded-[4px] bg-gradient-to-br from-amber-200 to-amber-400 shadow-inner">
                        <span className="h-2.5 w-3.5 rounded-[1px] border border-amber-600/40" />
                      </span>
                    </div>
                    <div className="relative">
                      <div className="text-[2.5rem] font-black leading-none tracking-tight !text-white">
                        {fmtThousands(c.denominationAzn)}
                        <span className="ml-1 text-xl !text-white/75">₼</span>
                      </div>
                      <div
                        className={`mt-1.5 font-mono text-[10px] tracking-[0.2em] !text-white/45`}
                      >
                        ••••-••••-•••
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Məlumat + CTA ───────────────────────────────────────── */}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[1.75rem] font-black leading-none tracking-tight text-zinc-950 dark:text-white">
                    {fmtThousands(c.denominationAzn)}
                  </span>
                  <span className="text-lg font-bold text-fuchsia-600 dark:text-fuchsia-300">₼</span>
                  <span className="ml-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    balans
                  </span>
                </div>

                {/* Nominal ilə ödəniş bərabər olanda qiyməti təkrar yazmırıq:
                    «1.000 ₼» ilə «1000.00 AZN» yan-yana həm artıq, həm də
                    ayırıcıları fərqli olduğu üçün səliqəsiz görünürdü. */}
                <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-white/5">
                  {hasMarkup ? (
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          Ödəniş
                        </div>
                        <div className="mt-0.5 flex items-baseline gap-1">
                          <span className="text-xl font-black leading-none tracking-tight text-zinc-950 dark:text-white">
                            {price.toFixed(2)}
                          </span>
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            AZN
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                      Komissiyasız — ödəniş nominal qədərdir
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <ReferralBadge category="giftCards" productName={c.title} />
                </div>

                {/* Üç halın hamısı eyni `h-12` hündürlüyündədir — kart sıçramır. */}
                <div className="mt-4 flex flex-1 flex-col justify-end">
                  {qty > 0 ? (
                    <div className="inline-flex h-12 w-full items-center justify-between gap-1 rounded-xl bg-fuchsia-50 px-1.5 ring-1 ring-fuchsia-200 dark:bg-fuchsia-500/10 dark:ring-fuchsia-500/25">
                      <button
                        type="button"
                        onClick={() => setQty(c.id, qty - 1)}
                        aria-label={
                          qty <= 1 ? `${c.title} səbətdən çıxar` : `${c.title} sayını azalt`
                        }
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-fuchsia-700 transition hover:bg-fuchsia-500/20 dark:text-fuchsia-300"
                      >
                        {qty <= 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      </button>
                      <span className="min-w-0 flex-1 text-center text-sm font-black tabular-nums text-fuchsia-800 dark:text-fuchsia-200">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={qty >= MAX_PER_LINE}
                        onClick={() => setQty(c.id, qty + 1)}
                        aria-label={`${c.title} sayını artır`}
                        title={
                          qty >= MAX_PER_LINE
                            ? `Bir sifarişdə maksimum ${MAX_PER_LINE} ədəd`
                            : undefined
                        }
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-fuchsia-700 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-35 dark:text-fuchsia-300"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(c)}
                      aria-label={`${c.title} səbətə əlavə et`}
                      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 text-sm font-bold !text-white shadow-lg ${tier.glow} transition-all duration-200 hover:from-violet-500 hover:to-fuchsia-500`}
                    >
                      <ShoppingCart className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline">Səbətə əlavə et</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
