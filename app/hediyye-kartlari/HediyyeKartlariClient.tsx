"use client";

import { useMemo } from "react";
import { Crown, Minus, Plus, ShoppingCart, Trash2, TrendingDown, Zap } from "lucide-react";
import { useCart } from "@/lib/cart";
import { fmtThousands } from "@/lib/format";
import ProductImage from "@/components/ProductImage";
import ReferralBadge from "@/components/ReferralBadge";

type Plan = {
  id: string;
  title: string;
  imageUrl?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  _count: { codes: number };
};

function tryAmountOf(c: Plan): number {
  const n = Number((c.metadata as Record<string, unknown> | null)?.tryAmount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Serverin sətir başına limiti (app/api/cart/checkout → `Math.min(20, …)`). */
const MAX_PER_LINE = 20;

export default function HediyyeKartlariClient({ cards }: { cards: Plan[] }) {
  const { add, setQty, items, hydrated } = useCart();

  // Baseline = ən pis AZN/TRY kursu (adətən ən kiçik paket). Hər kartın qənaəti
  // bu baseline-a görə ölçülür.
  const baselineAznPerTry = useMemo(() => {
    let max = 0;
    for (const c of cards) {
      const t = tryAmountOf(c);
      if (!t) continue;
      const rate = c.priceAznCents / 100 / t;
      if (rate > max) max = rate;
    }
    return max;
  }, [cards]);

  // Ən sərfəli kart (ən aşağı AZN/TRY) — vizual olaraq öndə göstərilir. Bu
  // MƏHSUL qərarıdır: müştəri axtarmadan ən yaxşı təklifi görməlidir.
  const bestValueId = useMemo(() => {
    let bestId: string | null = null;
    let bestRate = Infinity;
    for (const c of cards) {
      const t = tryAmountOf(c);
      if (!t) continue;
      const rate = c.priceAznCents / 100 / t;
      if (rate < bestRate) {
        bestRate = rate;
        bestId = c.id;
      }
    }
    return bestId;
  }, [cards]);

  function addToCart(selected: Plan) {
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? null,
      finalAzn: selected.priceAznCents / 100,
      productType: "TRY_BALANCE",
    });
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c) => {
        // Faktiki say — `has()` yalnız bool qaytarır, sayğac üçün kifayət etmir.
        // Hədiyyə sətirləri (`gift`) ayrıca sətirdir, ona görə kənarlaşdırılır.
        const qty = hydrated
          ? (items.find((i) => i.id === c.id && !i.gift)?.qty ?? 0)
          : 0;
        const isBest = c.id === bestValueId;
        // Stokda kod varsa checkout dərhal SUCCESS verir, yoxsa sifariş PENDING
        // olur (app/api/cart/checkout → OUT_OF_STOCK). Ona görə «Anında» etiketi
        // yalnız real stokda göstərilir — yalan vəd vermirik.
        const instant = c._count.codes > 0;
        /**
         * Limit «anında və manual çatdırılmanı QARIŞDIRMA» prinsipinə görədir:
         *   • stok var  → say stokla kəsilir, yəni bütün nüsxələr anında gəlir;
         *   • stok yox  → server limiti (20), bütün sifariş manual gedir.
         *
         * Stok 0 olanda kart SATIŞDAN ÇIXARILMIR: checkout onsuz da PENDING
         * (`OUT_OF_STOCK`) sifariş yaradır və admin əl ilə çatdırır — bu işlək
         * biznes axınıdır. Bloklamaq mövcud satışı itirmək olardı. Müştəri
         * fərqi «Anında» nişanının olmamasından görür.
         */
        const maxQty = c._count.codes > 0 ? Math.min(MAX_PER_LINE, c._count.codes) : MAX_PER_LINE;

        const tryAmt = tryAmountOf(c);
        const azn = c.priceAznCents / 100;
        let savingsPct = 0;
        let savingsAzn = 0;
        if (baselineAznPerTry > 0 && tryAmt > 0) {
          const expected = baselineAznPerTry * tryAmt;
          savingsAzn = expected - azn;
          savingsPct = (savingsAzn / expected) * 100;
        }
        const showSavings = savingsPct >= 1;

        return (
          <li key={c.id} className="group relative">
            {isBest && (
              <span className="absolute -top-2.5 left-4 z-20 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] !text-white shadow-lg shadow-violet-600/30">
                <Crown className="h-3 w-3" />
                Ən sərfəli
              </span>
            )}

            <div
              className={`flex h-full flex-col overflow-hidden rounded-[22px] bg-white transition-all duration-300 dark:bg-[#0c0a14] ${
                isBest
                  ? "ring-2 ring-violet-500 dark:ring-violet-500/70"
                  : "ring-1 ring-zinc-200 dark:ring-white/10"
              } hover:-translate-y-1.5 hover:shadow-[0_18px_40px_-16px_rgba(109,40,217,0.35)] hover:ring-violet-400 dark:hover:ring-violet-500/60`}
            >
              {/* ─── Şəkil + nominal ──────────────────────────────────── */}
              <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/40">
                <ProductImage
                  src={c.imageUrl}
                  alt={c.title}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                  badge="Gift Card"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  {showSavings && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black !text-white shadow-lg shadow-emerald-500/30">
                      <TrendingDown className="h-3 w-3" />
                      {Math.round(savingsPct)}%
                    </span>
                  )}
                  {instant && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold !text-white backdrop-blur">
                      <Zap className="h-3 w-3 text-amber-300" />
                      Anında
                    </span>
                  )}
                </div>

              </div>

              {/* ─── Nominal + qiymət + CTA ───────────────────────────── */}
              <div className="flex flex-1 flex-col p-4">
                {/* Nominal şəklin ÜSTÜNDƏ deyil, burda göstərilir: admin
                    şəkillərinin bir qismi məbləği artıq öz üzərində yazır və
                    overlay ilə cütləşib "250₺ 250 TRY" kimi görünürdü. */}
                {tryAmt > 0 ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[1.75rem] font-black leading-none tracking-tight text-zinc-950 dark:text-white">
                      {fmtThousands(tryAmt)}
                    </span>
                    <span className="text-lg font-bold text-violet-600 dark:text-violet-300">₺</span>
                    <span className="ml-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      hədiyyə kartı
                    </span>
                  </div>
                ) : (
                  <h3 className="line-clamp-2 text-base font-bold text-zinc-950 dark:text-white">
                    {c.title}
                  </h3>
                )}

                <div className="mt-3 flex items-end justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-white/5">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      Qiymət
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <span className="text-xl font-black leading-none tracking-tight text-zinc-950 dark:text-white">
                        {azn.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        AZN
                      </span>
                    </div>
                  </div>
                  {showSavings && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {savingsAzn.toFixed(2)} AZN qənaət
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <ReferralBadge category="giftCards" productName={c.title} />
                </div>

                {/* ─── CTA / sayğac ────────────────────────────────────────
                    Üç halın hamısı EYNİ `h-12` hündürlüyündədir — səbətə əlavə
                    edəndə kart hündürlüyü sıçramasın. Sayğac
                    `StreamingPlanPicker`-dəki nümunənin eynisidir. */}
                <div className="mt-4 flex flex-1 flex-col justify-end">
                  {qty > 0 ? (
                    <div className="inline-flex h-12 w-full items-center justify-between gap-1 rounded-xl bg-emerald-50 px-1.5 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/25">
                      <button
                        type="button"
                        onClick={() => setQty(c.id, qty - 1)}
                        aria-label={
                          qty <= 1 ? `${c.title} səbətdən çıxar` : `${c.title} sayını azalt`
                        }
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                      >
                        {qty <= 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      </button>
                      <span className="min-w-0 flex-1 text-center text-sm font-black tabular-nums text-emerald-800 dark:text-emerald-200">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={qty >= maxQty}
                        onClick={() => setQty(c.id, qty + 1)}
                        aria-label={`${c.title} sayını artır`}
                        title={
                          qty < maxQty
                            ? undefined
                            : c._count.codes > 0 && c._count.codes <= MAX_PER_LINE
                              ? `Stokda ${c._count.codes} ədəd var`
                              : `Bir sifarişdə maksimum ${MAX_PER_LINE} ədəd`
                        }
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-35 dark:text-emerald-300"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(c)}
                      aria-label={`${c.title} səbətə əlavə et`}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-bold !text-white shadow-lg shadow-violet-600/20 transition-all duration-200 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-600/35"
                    >
                      {/* Mobildə yalnız ikon, sm-dən yuxarı ikon + yazı. */}
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
