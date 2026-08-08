"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useReelState } from "./ReelStateProvider";
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

  // Seçim CONTEXT-dədir: desktop yan raildəki "Saxla" düyməsi də EYNİ sürümü
  // görməlidir (izah ReelStateProvider-dədir), yoxsa istifadəçi Ultimate sürümə
  // baxıb saxlayanda favoritlərə Standart düşər.
  const { selectedEditions, setSelectedEdition } = useReelState();
  const selectedId = selectedEditions[item.id] ?? null;

  // Sürümlər dəyişəndə (feed səhifələnəndə) seçimi ən ucuza qaytar — silinmiş
  // sürümün id-si qalsa panel qiymətsiz görünərdi.
  useEffect(() => {
    const valid = selectedId && editions.some((e) => e.id === selectedId);
    if (!valid && editions[0]) setSelectedEdition(item.id, editions[0].id);
  }, [editions, selectedId, item.id, setSelectedEdition]);

  const selected: ReelProduct | null = useMemo(
    () => editions.find((e) => e.id === selectedId) ?? editions[0] ?? null,
    [editions, selectedId],
  );

  // Sürüm YOXDURSA (URL CTA-sı və ya silinmiş məhsul) panel göstərilmir —
  // o hallarda yan/alt rail-dəki mövcud CTA düyməsi işini görür.
  if (!selected) return null;

  const inCart = has(selected.id);
  // "ən ucuz" nişanı YALNIZ həqiqi qiymət fərqi olanda. Sürümlərin hamısı eyni
  // qiymətdədirsə birinə "ən ucuz" yazmaq müştərini aldadır (skrinşotda iki çip də
  // 66.26 ₼ idi, biri nişanla).
  const cheapestId =
    editions.length > 1 && editions[0].finalAzn < editions[1].finalAzn ? editions[0].id : null;

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
                onClick={() => setSelectedEdition(item.id, e.id)}
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
                  {e.platform && (
                    <span className={`text-[9px] ${active ? "text-zinc-500" : "text-white/50"}`}>
                      {e.platform}
                    </span>
                  )}
                  {e.id === cheapestId && (
                    <span
                      className={`rounded px-1 py-px text-[9px] font-black uppercase ${
                        active ? "bg-emerald-600 text-white" : "bg-emerald-500/90 text-white"
                      }`}
                    >
                      ən ucuz
                    </span>
                  )}
                </span>
                {/* Endirim faizi QƏSDƏN yoxdur — 4 çipdə 4 qırmızı nişan olurdu və
                    aşağıdakı böyük sətir onsuz da endirimi göstərir. Çipin işi
                    sürümlər arasında qiymət MÜQAYİSƏSİDİR. */}
                <span className="mt-0.5 block text-xs font-black">
                  {e.finalAzn.toFixed(2)} ₼
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
          {/* "Standart · PS5" alt sətri QƏSDƏN silinib — seçili çip onsuz da ağ fonla
              işarələnib, sətir eyni məlumatı üçüncü dəfə təkrarlayırdı. */}
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
