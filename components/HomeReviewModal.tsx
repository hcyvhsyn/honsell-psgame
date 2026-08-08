"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Star, Loader2, CheckCircle2, X, PenLine, ShoppingBag, Gift, Sparkles } from "lucide-react";
import { REVIEW_TEXT_MIN, REVIEW_TEXT_MAX } from "@/lib/reviewTextLimits";

type ReviewablePurchase = {
  transactionId: string;
  title: string;
  platform: string;
  priceAznCents: number;
};

const PLATFORM_LABELS: Record<string, string> = {
  GAME: "Oyun",
  PS_PLUS: "PS Plus",
  GIFT_CARD: "Gift Card",
  ACCOUNT_CREATION: "Hesab açma",
};

/**
 * Alışa bağlı OLMAYAN ("ümumi") rəy seçimi. Alışı olmayan — və ya bütün
 * alışlarına artıq rəy yazmış — istifadəçi də rəy yaza bilsin deyə var.
 * Bu seçimlə göndərilən rəydə `transactionId` yoxdur → cashback verilmir.
 */
const GENERAL_KEY = "__general__";

/**
 * Anasayfada "Rəy yaz" düyməsi + modal forma. Daxil olmuş hər istifadəçiyə
 * render olunur. Modal açılanda müştərinin rəy yazılmamış alışlarını (məhsul +
 * qiymət) çəkir; müştəri ya konkret alışı seçir (təsdiqdən sonra həmin alışın
 * müəyyən %-i cashback), ya da "ümumi rəy" seçir (cashbacksiz).
 */
export default function HomeReviewModal({
  defaultName,
  hasPurchases = false,
}: {
  defaultName: string;
  /** Sessiyadan gələn siqnal — yalnız düymə mətnindəki cashback vədi üçün. */
  hasPurchases?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [purchases, setPurchases] = useState<ReviewablePurchase[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cashbackRatePct, setCashbackRatePct] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [earnedAzn, setEarnedAzn] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => hover ?? rating, [hover, rating]);
  const selectedPurchase = useMemo(
    () => purchases?.find((p) => p.transactionId === selected) ?? null,
    [purchases, selected],
  );
  const isGeneral = selected === GENERAL_KEY;
  const cashbackFor = (cents: number) => (cents * cashbackRatePct) / 100 / 100;

  // Modal ilk dəfə açılanda rəy yazıla bilən alışları çək.
  useEffect(() => {
    if (!open || purchases !== null || loading) return;
    setLoading(true);
    fetch("/api/reviews/my-products")
      .then((r) => r.json())
      .then((d) => {
        const list: ReviewablePurchase[] = Array.isArray(d.purchases) ? d.purchases : [];
        setPurchases(list);
        if (typeof d.cashbackRatePct === "number") setCashbackRatePct(d.cashbackRatePct);
        // Tək alış varsa onu, heç alış yoxdursa ümumi rəyi avtomatik seç —
        // müştəri boş formaya baxıb "niyə göndərə bilmirəm?" deməsin.
        if (list.length === 1) setSelected(list[0].transactionId);
        else if (list.length === 0) setSelected(GENERAL_KEY);
      })
      .catch(() => {
        setPurchases([]);
        setSelected(GENERAL_KEY);
      })
      .finally(() => setLoading(false));
  }, [open, purchases, loading]);

  function reset() {
    setSelected(null);
    setRating(5);
    setText("");
    setError(null);
    setDone(false);
    setEarnedAzn(0);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  function submit() {
    setError(null);
    if (!selected) {
      setError("Rəy yazdığın məhsulu seç.");
      return;
    }
    if (text.trim().length < REVIEW_TEXT_MIN) {
      setError(`Rəy ən azı ${REVIEW_TEXT_MIN} simvol olmalıdır.`);
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Ümumi rəydə transactionId ümumiyyətlə göndərilmir — server onu
        // "alışa bağlı deyil" kimi oxuyur və cashback hesablamır.
        body: JSON.stringify({
          rating,
          text: text.trim(),
          ...(isGeneral ? {} : { transactionId: selected }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Göndərmək alınmadı.");
        return;
      }
      if (selectedPurchase) setEarnedAzn(cashbackFor(selectedPurchase.priceAznCents));
      setDone(true);
    });
  }

  const textLen = text.trim().length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-950 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
      >
        <PenLine className="h-4 w-4" />
        {hasPurchases ? `Rəy yaz · ${cashbackRatePct}% cashback` : "Rəy yaz"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} aria-hidden />
          <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950 sm:rounded-3xl">
            <button
              type="button"
              onClick={close}
              aria-label="Bağla"
              className="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>

            {done ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h2 className="mt-3 text-lg font-black text-zinc-900 dark:text-white">Təşəkkürlər!</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Rəyin alındı. Yoxlanıb təsdiqləndikdən sonra anasayfada görünəcək
                  {earnedAzn > 0 && (
                    <>
                      {" "}və <span className="font-bold text-emerald-600">{earnedAzn.toFixed(2)}₼ cashback</span> hesabına keçəcək.
                    </>
                  )}
                  {earnedAzn === 0 && "."}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500"
                >
                  Bağla
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-black text-zinc-900 dark:text-white">Təcrübəni paylaş</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Rəyin <span className="font-semibold">{defaultName}</span> adı ilə görünəcək.
                </p>

                {/* Cashback məlumat zolağı — cashback yalnız alışa bağlı rəydə
                    verilir, ona görə ümumi rəydə vəd verməyən neytral mətn. */}
                {isGeneral ? (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
                    <PenLine className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Bu rəy alışa bağlı deyil — <b>cashback qazandırmır</b>, amma təsdiqdən
                      sonra anasayfada görünəcək. Ən azı {REVIEW_TEXT_MIN} simvol yaz.
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <Gift className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Ən azı {REVIEW_TEXT_MIN} simvolluq rəy yaz — təsdiqdən sonra məhsulun{" "}
                      <b>{cashbackRatePct}%-i cashback</b> hesabına keçsin.
                    </span>
                  </div>
                )}

                {/* Alış seçimi — istifadəçinin real alışları */}
                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Hansı məhsula rəy yazırsan?
                  </div>

                  {loading || purchases === null ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Alışların yüklənir...
                    </div>
                  ) : (
                    <div className="mt-2 grid max-h-44 gap-1.5 overflow-y-auto pr-1">
                      {purchases.length === 0 && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Rəy yazılmamış sifarişin yoxdur — cashbacksiz ümumi rəy yaza
                          bilərsən. Məhsul aldıqdan sonra həmin alışa rəy yazıb cashback
                          qazanmaq mümkündür.
                        </p>
                      )}
                      {purchases.map((p) => {
                        const active = selected === p.transactionId;
                        return (
                          <button
                            key={p.transactionId}
                            type="button"
                            onClick={() => setSelected(p.transactionId)}
                            className={[
                              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                              active
                                ? "border-violet-500 bg-violet-50 dark:border-violet-400/60 dark:bg-violet-500/10"
                                : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.04]",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                                active
                                  ? "bg-violet-600 text-white"
                                  : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-300",
                              ].join(" ")}
                            >
                              <ShoppingBag className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">
                                {p.title}
                              </span>
                              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                                {PLATFORM_LABELS[p.platform] ?? "Məhsul"} · {(p.priceAznCents / 100).toFixed(2)}₼
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                              +{cashbackFor(p.priceAznCents).toFixed(2)}₼
                            </span>
                          </button>
                        );
                      })}

                      {/* Alışa bağlı olmayan ümumi rəy — cashbacksiz. */}
                      <button
                        type="button"
                        onClick={() => setSelected(GENERAL_KEY)}
                        className={[
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                          isGeneral
                            ? "border-violet-500 bg-violet-50 dark:border-violet-400/60 dark:bg-violet-500/10"
                            : "border-dashed border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                            isGeneral
                              ? "bg-violet-600 text-white"
                              : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-300",
                          ].join(" ")}
                        >
                          <PenLine className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">
                            Ümumi rəy
                          </span>
                          <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                            Konkret alışa bağlı deyil
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                          Cashbacksiz
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {purchases !== null && (
                  <>
                    <div className="mt-5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Qiymətləndirmə
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onMouseEnter={() => setHover(n)}
                            onMouseLeave={() => setHover(null)}
                            onClick={() => setRating(n)}
                            aria-label={`${n} ulduz`}
                            className="rounded p-1 transition hover:scale-110"
                          >
                            <Star
                              className={`h-7 w-7 ${
                                n <= shown
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-zinc-200 text-zinc-300 dark:fill-zinc-800 dark:text-zinc-700"
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-xs text-zinc-500">{shown}/5</span>
                      </div>
                    </div>

                    <label className="mt-5 block">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Rəyin</span>
                      <textarea
                        rows={5}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Təcrübən necə oldu? Çatdırılma, dəstək, qiymət, məhsulun keyfiyyəti — hər nə vacibdirsə ən azı bir neçə cümlə yaz..."
                        maxLength={REVIEW_TEXT_MAX}
                        className="mt-1 w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <div className="mt-1 flex items-center justify-between text-[10px]">
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Sparkles className="h-3 w-3" /> Orfoqrafik səhvlər AI ilə avtomatik düzəldilir
                        </span>
                        <span className={textLen < REVIEW_TEXT_MIN ? "text-rose-500" : "text-emerald-600"}>
                          {textLen}/{REVIEW_TEXT_MAX} (min {REVIEW_TEXT_MIN})
                        </span>
                      </div>
                    </label>

                    {error && (
                      <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={pending}
                      onClick={submit}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
                    >
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                      {selectedPurchase && !isGeneral
                        ? `Rəyi göndər · +${cashbackFor(selectedPurchase.priceAznCents).toFixed(2)}₼`
                        : "Rəyi göndər"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
