"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import type { ReelFeedItem, ReelProduct } from "./types";

/**
 * Videonun altındakı alış paneli — sürüm çipləri + canlı qiymət + səbət düyməsi.
 *
 *  • Sürümlər feed-dən UCUZDAN BAHAYA gəlir, ona görə default seçim `[0]` —
 *    müştəri ən ucuzu axtarmadan görür.
 *  • Endirim varsa köhnə qiymət üstündən xətli + faiz nişanı göstərilir. Endirim
 *    bitibsə server (computeDisplayPrice) onsuz da tam qiymət qaytarır, burada
 *    ayrıca "bitib" məntiqi YOXDUR — tək həqiqət mənbəyi serverdir.
 *  • Tək sürüm varsa çip sətri gizlənir (boş yerə yer tutmasın).
 */
/**
 * Bu reel üçün alış paneli göstərilirmi? Rail-lərdəki köhnə səbət düyməsi panel
 * varkən təkrardır — hər iki tərəf EYNİ şərti işlətsin deyə burada saxlanılır.
 */
export function hasBuyPanel(item: ReelFeedItem): boolean {
  return item.cta.editions.length > 0;
}

export default function ReelBuyPanel({ item }: { item: ReelFeedItem }) {
  const router = useRouter();
  const { add, has } = useCart();
  const editions = item.cta.editions;

  const [selectedId, setSelectedId] = useState<string | null>(editions[0]?.id ?? null);

  // Feed səhifələnəndə/sürümlər dəyişəndə seçimi ən ucuza qaytar. Silinmiş
  // sürümün id-si state-də qalsa panel qiymətsiz görünərdi.
  useEffect(() => {
    setSelectedId((prev) => (prev && editions.some((e) => e.id === prev) ? prev : (editions[0]?.id ?? null)));
  }, [editions]);

  const selected: ReelProduct | null = useMemo(
    () => editions.find((e) => e.id === selectedId) ?? editions[0] ?? null,
    [editions, selectedId],
  );

  // Sürüm YOXDURSA (URL CTA-sı və ya silinmiş məhsul) panel göstərilmir —
  // o hallarda yan/alt rail-dəki mövcud CTA düyməsi işini görür.
  if (!selected) return null;

  const inCart = has(selected.id);
  const cheapestId = editions[0]?.id;

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
      productType: selected.productType,
      ...(selected.store && selected.store !== "SERVICE" ? { store: selected.store } : {}),
    });
  }

  return (
    <div className="pointer-events-auto w-full rounded-2xl bg-black/55 p-2.5 backdrop-blur-md">
      {/* Sürüm çipləri — yalnız birdən çox sürüm varsa. */}
      {editions.length > 1 && (
        <div
          className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: "none" }}
        >
          {editions.map((e) => {
            const active = e.id === selected.id;
            return (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                aria-pressed={active}
                className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-left transition ${
                  active
                    ? "border-white bg-white text-zinc-900"
                    : "border-white/25 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold leading-tight">
                    {e.editionName ?? "Sürüm"}
                  </span>
                  {e.id === cheapestId && editions.length > 1 && (
                    <span
                      className={`rounded px-1 py-px text-[9px] font-black uppercase ${
                        active ? "bg-emerald-600 text-white" : "bg-emerald-500/90 text-white"
                      }`}
                    >
                      ən ucuz
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-xs font-black">{e.finalAzn.toFixed(2)} ₼</span>
                  {e.discountPct != null && (
                    <span
                      className={`text-[9px] font-bold ${active ? "text-rose-600" : "text-rose-300"}`}
                    >
                      −{e.discountPct}%
                    </span>
                  )}
                  {e.platform && (
                    <span className={`text-[9px] ${active ? "text-zinc-500" : "text-white/50"}`}>
                      {e.platform}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Qiymət + səbət */}
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black leading-none text-white">
              {selected.finalAzn.toFixed(2)} ₼
            </span>
            {selected.originalAzn != null && (
              <span className="text-xs font-semibold text-white/50 line-through">
                {selected.originalAzn.toFixed(2)} ₼
              </span>
            )}
            {selected.discountPct != null && (
              <span className="rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                −{selected.discountPct}%
              </span>
            )}
          </div>
          {editions.length > 1 && (
            <p className="mt-0.5 truncate text-[11px] text-white/60">
              {selected.editionName ?? "Sürüm"}
              {selected.platform ? ` · ${selected.platform}` : ""}
            </p>
          )}
        </div>

        <button
          onClick={onAdd}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-black transition active:scale-95 ${
            inCart
              ? "bg-emerald-500 text-white hover:bg-emerald-400"
              : "bg-white text-zinc-900 hover:bg-zinc-100"
          }`}
        >
          {inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {/* `ctaLabel` qəsdən işlədilmir: onun defaultu "Hesab al"dır və oyun
              sürümü üçün yanlış səslənir. Panelin özü səbət hərəkətidir. */}
          {inCart ? "Səbətdə" : "Səbətə at"}
        </button>
      </div>
    </div>
  );
}
