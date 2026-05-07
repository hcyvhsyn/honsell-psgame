"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
} from "@/lib/reviewAffiliateConstants";

export type ReviewComposerGameOption = {
  id: string;
  title: string;
};

type Props = {
  /** Hansı oyun(lar) üçün yaza bilər. Boş array → seçim yoxdur. */
  games: ReviewComposerGameOption[];
  /** Sabit oyun (məs. oyun səhifəsindən açılırsa). Verilərsə dropdown gizlənir. */
  fixedGameId?: string;
  /** Submit uğurla bitdikdən sonra çağırılır. */
  onSuccess?: () => void;
};

type FieldError = {
  game?: string;
  rating?: string;
  body?: string;
  general?: string;
};

export default function ReviewComposer({ games, fixedGameId, onSuccess }: Props) {
  const [gameId, setGameId] = useState(fixedGameId ?? games[0]?.id ?? "");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldError>({});
  const [submitted, setSubmitted] = useState(false);

  const trimmedLength = body.trim().length;
  const tooShort = trimmedLength > 0 && trimmedLength < REVIEW_BODY_MIN;
  const tooLong = trimmedLength > REVIEW_BODY_MAX;

  function validate(): FieldError {
    const e: FieldError = {};
    if (!gameId) e.game = "Oyun seçin.";
    if (rating < REVIEW_RATING_MIN || rating > REVIEW_RATING_MAX) {
      e.rating = "Reytinq verin (1–5 ulduz).";
    }
    if (trimmedLength < REVIEW_BODY_MIN) {
      e.body = `Rəy ən azı ${REVIEW_BODY_MIN} simvol olmalıdır.`;
    } else if (trimmedLength > REVIEW_BODY_MAX) {
      e.body = `Rəy maksimum ${REVIEW_BODY_MAX} simvol ola bilər.`;
    }
    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ve = validate();
    setErrors(ve);
    if (Object.keys(ve).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/game-reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, rating, body: body.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ general: json.error || "Rəy göndərilmədi." });
        return;
      }
      setSubmitted(true);
      setBody("");
      setRating(0);
      onSuccess?.();
    } catch {
      setErrors({ general: "Şəbəkə xətası — yenidən cəhd edin." });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-700 bg-emerald-900/20 p-5 text-emerald-200">
        <div className="font-semibold">Rəyiniz göndərildi.</div>
        <div className="mt-1 text-sm opacity-80">
          Admin moderasiyasından sonra public siyahıda görünəcək. Təşəkkür edirik.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">Rəy yazın</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Rəyiniz onaylandıqdan sonra public görünəcək. Linkinizdən alış edən hər kəsə görə
          satışın 5%-i referal balansınıza əlavə olunur.
        </p>
      </div>

      {!fixedGameId ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Oyun</label>
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            <option value="" disabled>
              Oyun seçin...
            </option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          {errors.game ? (
            <div className="mt-1 text-xs text-rose-400">{errors.game}</div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">Reytinq</label>
        <div
          className="flex items-center gap-1"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              onMouseEnter={() => setHoverRating(i)}
              className="rounded-md p-1 transition hover:bg-zinc-900"
              aria-label={`${i} ulduz`}
            >
              <Star
                className={`h-7 w-7 ${
                  i <= (hoverRating || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-zinc-700"
                }`}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-zinc-500">
            {rating > 0 ? `${rating}/5` : "Ulduz seçin"}
          </span>
        </div>
        {errors.rating ? (
          <div className="mt-1 text-xs text-rose-400">{errors.rating}</div>
        ) : null}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">
          Detallı fikriniz
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder={`Oyun haqqında ən azı ${REVIEW_BODY_MIN} simvolluq detallı rəy yazın...`}
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span
            className={
              tooShort
                ? "text-amber-400"
                : tooLong
                  ? "text-rose-400"
                  : trimmedLength >= REVIEW_BODY_MIN
                    ? "text-emerald-400"
                    : "text-zinc-500"
            }
          >
            {trimmedLength}/{REVIEW_BODY_MIN}+ simvol
          </span>
          <span className="text-zinc-600">Maksimum {REVIEW_BODY_MAX}</span>
        </div>
        {errors.body ? (
          <div className="mt-1 text-xs text-rose-400">{errors.body}</div>
        ) : null}
      </div>

      {errors.general ? (
        <div className="rounded-lg border border-rose-700 bg-rose-900/20 p-3 text-sm text-rose-300">
          {errors.general}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-base font-bold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Göndərilir...
          </>
        ) : (
          "Rəyi göndər"
        )}
      </button>
    </form>
  );
}
