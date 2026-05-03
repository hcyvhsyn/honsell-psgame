"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Star, Loader2, CheckCircle2 } from "lucide-react";

export default function ReviewForm({
  token,
  productTitle,
  defaultName,
}: {
  token: string;
  productTitle: string;
  defaultName: string;
}) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState(defaultName);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => hover ?? rating, [hover, rating]);

  function submit() {
    setError(null);
    if (text.trim().length < 10) {
      setError("Rəy ən azı 10 simvol olmalıdır.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text: text.trim(), name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Göndərmək alınmadı.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <div className="mb-3 flex items-center gap-2 text-emerald-200">
          <CheckCircle2 className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Təşəkkürlər!</h2>
        </div>
        <p className="text-sm text-zinc-300">
          Rəyin uğurla göndərildi və artıq saytda göstərilir.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/#reyler"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Rəylərə bax
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Ana səhifə
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Məhsul</div>
      <div className="mb-5 text-sm font-semibold text-white">{productTitle}</div>

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Adın</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Saytda görünəcək ad"
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
        />
      </label>

      <div className="mt-5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Qiymətləndirmə</div>
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
                  n <= shown ? "fill-amber-400 text-amber-400" : "fill-zinc-800 text-zinc-700"
                }`}
              />
            </button>
          ))}
          <span className="ml-2 text-xs text-zinc-500">{shown}/5</span>
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Rəyin</span>
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Təcrübən necə oldu? Çatdırılma, dəstək, qiymət — hər nə vacibdirsə..."
          maxLength={1000}
          className="mt-1 w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
        />
        <div className="mt-1 flex justify-end text-[10px] text-zinc-600">
          {text.length}/1000 (min 10)
        </div>
      </label>

      {error && (
        <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Rəyi göndər
      </button>
    </div>
  );
}
