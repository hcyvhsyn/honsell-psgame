"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useReelState } from "./ReelStateProvider";
import type { ReelFeedItem } from "./types";

/**
 * Videonun altındakı məhsul kartı — kaver + ad + qiymət + səbət düyməsi.
 *
 * ⚠️ **YALNIZ ƏN UCUZ SÜRÜM göstərilir.** Əvvəllər burada sürüm çipləri sırası vardı
 * (2–4 ədəd, hər biri öz qiyməti ilə); feed-də sürətlə sürüşdürülən video altında bu,
 * müştəridən qərar tələb edirdi və kartı 3 sətir uzadırdı. Sürümlər onsuz da
 * UCUZDAN BAHAYA gəlir, ona görə `editions[0]` götürülür — müştəri ən sərfəli
 * variantı seçim etmədən görür, tam siyahı isə məhsul səhifəsindədir.
 *
 * Qiymət/endirim serverdən gəlir (`computeDisplayPrice`) — bitmiş endirimləri o özü
 * ləğv edir, burada ayrıca "endirim bitib" məntiqi YOXDUR.
 */

/**
 * Bu reel üçün alış kartı göstərilirmi? Rail-lərdəki köhnə səbət düyməsi kart varkən
 * təkrardır — hər iki tərəf EYNİ şərti işlətsin deyə burada saxlanılır.
 */
export function hasBuyPanel(item: ReelFeedItem): boolean {
  return item.cta.editions.length > 0;
}

export default function ReelBuyPanel({ item }: { item: ReelFeedItem }) {
  const router = useRouter();
  const { add, has } = useCart();
  // Sürümlər ucuzdan bahaya sıralıdır → [0] ən ucuzdur.
  const selected = item.cta.editions[0] ?? null;

  // Seçim hələ də CONTEXT-də saxlanılır: "Saxla" düyməsi qaytarılsa favoritə məhz
  // göstərilən sürüm düşməlidir (izah ReelStateProvider-dədir). Çip sırası silinib,
  // ona görə dəyər həmişə ən ucuz sürümdür.
  const { setSelectedEdition } = useReelState();
  useEffect(() => {
    if (selected) setSelectedEdition(item.id, selected.id);
  }, [selected, item.id, setSelectedEdition]);

  // Sürüm YOXDURSA (URL CTA-sı və ya silinmiş məhsul) kart göstərilmir —
  // o hallarda rail-dəki mövcud CTA düyməsi işini görür.
  if (!selected) return null;

  const inCart = has(selected.id);

  function onAdd() {
    if (!selected) return;
    if (inCart) {
      router.push("/cart");
      return;
    }
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl,
      finalAzn: selected.finalAzn,
      originalAzn: selected.originalAzn,
      productType: selected.productType,
      ...(selected.store && selected.store !== "SERVICE" ? { store: selected.store } : {}),
    });
  }

  return (
    <div className="pointer-events-auto w-full rounded-3xl border border-violet-500/40 bg-black/60 p-3 shadow-lg shadow-black/40 backdrop-blur-md">
      <div className="flex items-start gap-3">
        {/* Kaver — Next optimizer-dən keçmir (birbaşa CDN), digər məhsul kartları
            ilə eyni prinsip. */}
        {selected.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected.imageUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-2xl object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-black leading-tight text-white">
            {selected.title}
          </h3>
          {/* Platforma burada TƏKRARLANMIR — aşağıdakı çipdədir. */}
          <p className="mt-0.5 truncate text-sm text-white/60">
            {selected.editionName ?? "Standart"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-2xl font-black leading-none text-white">
              {selected.finalAzn.toFixed(2)} ₼
            </span>
            {selected.originalAzn != null && (
              <span className="text-sm font-semibold text-white/45 line-through">
                {selected.originalAzn.toFixed(2)} ₼
              </span>
            )}
            {selected.discountPct != null && (
              <span className="rounded-lg bg-violet-600 px-2 py-0.5 text-xs font-black text-white">
                −{selected.discountPct}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {selected.platform ? (
          <span className="shrink-0 rounded-lg border border-white/20 px-2.5 py-1 text-xs font-bold text-white/80">
            {selected.platform}
          </span>
        ) : (
          <span />
        )}

        <button
          onClick={onAdd}
          className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-lg transition active:scale-95 ${
            inCart
              ? "bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-500"
              : "bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-violet-600/40 hover:from-violet-500 hover:to-fuchsia-500"
          }`}
        >
          {inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {/* `ctaLabel` qəsdən işlədilmir: onun defaultu "Hesab al"dır və oyun
              sürümü üçün yanlış səslənir. Kartın özü səbət hərəkətidir. */}
          {inCart ? "Səbətdə" : "Səbətə əlavə et"}
        </button>
      </div>
    </div>
  );
}
