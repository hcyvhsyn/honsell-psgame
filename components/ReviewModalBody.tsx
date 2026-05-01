"use client";

import { useMemo, useState, useTransition } from "react";
import { Star } from "lucide-react";

export default function ReviewModalBody({ onDone }: { onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [platform, setPlatform] = useState<"GAME" | "PS_PLUS" | "GIFT_CARD" | "ACCOUNT_CREATION">(
    "GAME"
  );
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const shown = useMemo(() => hover ?? rating, [hover, rating]);

  function submit() {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, platform, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Göndərmək alınmadı." });
        return;
      }
      setMessage({
        ok: true,
        text: "Rəyin göndərildi. Təşəkkürlər!",
      });
      setTimeout(() => onDone(), 600);
    });
  }

  return (
    <div className="p-6 sm:p-7">
      <h2 className="text-xl font-semibold tracking-tight text-white">Rəy yaz</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Xidmətimizi necə qiymətləndirirsən?
      </p>

      <div className="mt-5">
        <label className="text-xs text-zinc-400">Platforma</label>
        <select
          value={platform}
          onChange={(e) =>
            setPlatform(
              (e.target.value as typeof platform) ?? "GAME"
            )
          }
          className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
        >
          <option value="GAME">Oyun</option>
          <option value="PS_PLUS">PS Plus</option>
          <option value="GIFT_CARD">Hədiyyə kartı</option>
          <option value="ACCOUNT_CREATION">Hesab açma</option>
        </select>
      </div>

      <div className="mt-5 flex items-center gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const idx = i + 1;
          const active = idx <= shown;
          return (
            <button
              key={idx}
              type="button"
              onMouseEnter={() => setHover(idx)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setRating(idx)}
              className="rounded-md p-1.5"
              aria-label={`${idx} ulduz`}
            >
              <Star
                className={
                  active
                    ? "h-6 w-6 fill-amber-400 text-amber-400"
                    : "h-6 w-6 fill-white/10 text-white/20"
                }
              />
            </button>
          );
        })}
        <span className="ml-2 text-sm font-medium text-zinc-300">
          {rating}/5
        </span>
      </div>

      <div className="mt-5">
        <label className="text-xs text-zinc-400">Rəy</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Qısa fikrini yaz..."
          className="mt-1 min-h-[120px] w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
        />
        <p className="mt-2 text-xs text-zinc-500">
          Minimum 10 simvol.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          Göndər
        </button>
        {message && (
          <span className={message.ok ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

