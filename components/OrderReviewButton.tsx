"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, CheckCircle2, X, PenLine } from "lucide-react";
import { REVIEW_TEXT_MIN, REVIEW_TEXT_MAX } from "@/lib/reviewTextLimits";

/**
 * Sifarişlər siyahısında hər rəy yazılmamış uğurlu alış üçün "Rəy yaz" düyməsi
 * + cashback nişanı. Rəy session-əsaslı /api/reviews-ə göndərilir (Testimonial,
 * konkret alışa bağlı). Admin təsdiqindən sonra həmin alışın faizi qədər
 * cashback yazılır (reviewCashbackRatePct).
 */
export default function OrderReviewButton({
  transactionId,
  productTitle,
  cashbackPct,
}: {
  transactionId: string;
  productTitle: string;
  cashbackPct: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = hover ?? rating;
  const trimmedLen = text.trim().length;
  const tooShort = trimmedLen < REVIEW_TEXT_MIN;

  function submit() {
    setError(null);
    if (tooShort) {
      setError(`Rəy ən azı ${REVIEW_TEXT_MIN} simvol olmalıdır.`);
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text: text.trim(), transactionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Rəy göndərmək alınmadı.");
        return;
      }
      setDone(true);
      // Sarı alert və düymə vəziyyəti yenilənsin (server komponentdir).
      router.refresh();
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Rəy göndərildi — təsdiq gözlənilir
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
      >
        <PenLine className="h-3.5 w-3.5" />
        Rəy yaz
        <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">
          +{cashbackPct}% cashback
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!pending) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-5">
              <div className="min-w-0">
                <p className="font-semibold text-white">Rəy yaz</p>
                <p className="mt-0.5 truncate text-sm text-zinc-400">{productTitle}</p>
              </div>
              <button
                type="button"
                aria-label="Bağla"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Rəyiniz təsdiqləndikdən sonra bu sifarişin <b>{cashbackPct}%</b>-i
                  cashback olaraq balansınıza əlavə olunacaq.
                </span>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500">
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
                            : "fill-zinc-800 text-zinc-700"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs text-zinc-500">{shown}/5</span>
                </div>
              </div>

              <label className="block">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Rəyin</span>
                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Təcrübən necə oldu? Çatdırılma, dəstək, qiymət — hər nə vacibdirsə..."
                  maxLength={REVIEW_TEXT_MAX}
                  className="mt-1 w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
                <div
                  className={`mt-1 flex justify-end text-[10px] ${
                    tooShort ? "text-zinc-600" : "text-emerald-500/70"
                  }`}
                >
                  {trimmedLen}/{REVIEW_TEXT_MAX} (min {REVIEW_TEXT_MIN})
                </div>
              </label>

              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {error}
                </div>
              )}

              <button
                type="button"
                disabled={pending || tooShort}
                onClick={submit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Rəyi göndər
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
