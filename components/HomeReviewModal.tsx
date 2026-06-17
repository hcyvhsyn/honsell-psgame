"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Star, Loader2, CheckCircle2, X, PenLine, ShoppingBag } from "lucide-react";

type PurchasedProduct = { key: string; title: string; platform: string };

const PLATFORM_LABELS: Record<string, string> = {
  GAME: "Oyun",
  PS_PLUS: "PS Plus",
  GIFT_CARD: "Gift Card",
  ACCOUNT_CREATION: "Hesab açma",
};

/**
 * Anasayfada "Rəy yaz" düyməsi + modal forma. Yalnız uyğun (ən azı bir uğurlu
 * sifarişi olan) istifadəçiyə render olunur. Modal açılanda müştərinin aldığı
 * REAL məhsulları çəkir; müştəri konkret məhsulu seçib ona rəy yazır.
 * /api/reviews-ə göndərir; rəy `isActive:false` ilə yaranır və admin
 * təsdiqindən sonra anasayfada görünür.
 */
export default function HomeReviewModal({ defaultName }: { defaultName: string }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<PurchasedProduct[] | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => hover ?? rating, [hover, rating]);

  // Modal ilk dəfə açılanda aldığı məhsulları çək.
  useEffect(() => {
    if (!open || products !== null || loadingProducts) return;
    setLoadingProducts(true);
    fetch("/api/reviews/my-products")
      .then((r) => r.json())
      .then((d) => {
        const list: PurchasedProduct[] = Array.isArray(d.products) ? d.products : [];
        setProducts(list);
        if (list.length === 1) setSelected(list[0].title);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [open, products, loadingProducts]);

  function reset() {
    setSelected(null);
    setRating(5);
    setText("");
    setError(null);
    setDone(false);
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
    if (text.trim().length < 10) {
      setError("Rəy ən azı 10 simvol olmalıdır.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text: text.trim(), productTitle: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Göndərmək alınmadı.");
        return;
      }
      setDone(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-950 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
      >
        <PenLine className="h-4 w-4" />
        Rəy yaz
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
                  Rəyin alındı. Yoxlamadan sonra anasayfada görünəcək.
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

                {/* Məhsul seçimi — istifadəçinin aldığı real məhsullar */}
                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Hansı məhsula rəy yazırsan?
                  </div>

                  {loadingProducts || products === null ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Məhsulların yüklənir...
                    </div>
                  ) : products.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
                      Hələ tamamlanmış sifarişin yoxdur. Rəy yazmaq üçün əvvəlcə bir məhsul al.
                    </div>
                  ) : (
                    <div className="mt-2 grid max-h-44 gap-1.5 overflow-y-auto pr-1">
                      {products.map((p) => {
                        const active = selected === p.title;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setSelected(p.title)}
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
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">
                                {p.title}
                              </span>
                              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                                {PLATFORM_LABELS[p.platform] ?? "Məhsul"}
                              </span>
                            </span>
                            {active && (
                              <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {products && products.length > 0 && (
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
                        rows={4}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Təcrübən necə oldu? Çatdırılma, dəstək, qiymət — hər nə vacibdirsə..."
                        maxLength={1000}
                        className="mt-1 w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <div className="mt-1 flex justify-end text-[10px] text-zinc-400">
                        {text.length}/1000 (min 10)
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
                      Rəyi göndər
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
