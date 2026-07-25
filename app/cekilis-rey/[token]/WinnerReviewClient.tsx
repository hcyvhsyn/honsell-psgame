"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, ImagePlus, X, CheckCircle2 } from "lucide-react";
import { uploadAdminImage } from "@/lib/uploadImageClient";

export default function WinnerReviewClient({
  token,
  name,
  prizeLabel,
}: {
  token: string;
  name: string;
  prizeLabel: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    const res = await uploadAdminImage(`/api/cekilis-rey/${token}/image-upload`, file);
    setUploading(false);
    if (!res.ok) {
      setError(res.error || "Şəkil yüklənmədi.");
      return;
    }
    setImageUrl(res.url);
  }

  async function submit() {
    if (text.trim().length < 3) {
      setError("Zəhmət olmasa qısa rəy yaz.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cekilis-rey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), rating, imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Göndərmək alınmadı.");
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd et.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-sm text-zinc-300">
        Salam <span className="font-semibold text-white">{name || "qalib"}</span> 👋
      </p>

      {/* Reytinq */}
      <div className="mt-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Qiymətləndir
        </label>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="transition"
              aria-label={`${n} ulduz`}
            >
              <Star
                className={`h-8 w-8 ${
                  n <= (hover || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-zinc-600"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Rəy mətni */}
      <div className="mt-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Rəyin
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={`${prizeLabel} mükafatını necə aldın, təcrübən necə keçdi?`}
          className="w-full resize-none rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
      </div>

      {/* Foto (opsional) */}
      <div className="mt-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Foto <span className="normal-case text-zinc-500">(opsional — mükafatın şəkli)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={pickImage}
          className="hidden"
        />
        {imageUrl ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Mükafat fotosu"
              className="max-h-56 rounded-xl border border-white/10 object-cover"
            />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="absolute -right-2 -top-2 rounded-full bg-zinc-800 p-1 text-zinc-300 ring-1 ring-white/10 hover:text-white"
              aria-label="Şəkli sil"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-zinc-300 hover:border-violet-500/50 hover:text-white disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {uploading ? "Yüklənir…" : "Şəkil əlavə et"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || uploading}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3.5 text-sm font-black text-white transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Rəyi göndər
      </button>
    </div>
  );
}
