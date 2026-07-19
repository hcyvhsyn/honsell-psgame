"use client";

import { useState } from "react";
import { Loader2, Send, Check } from "lucide-react";
import { WINBACK_REASONS, type WinbackReasonCode } from "@/lib/winbackShared";

export default function WinbackReasonClient({ token }: { token: string }) {
  const [reason, setReason] = useState<WinbackReasonCode | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason) {
      setError("Zəhmət olmasa bir səbəb seç.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/niye/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, reasonText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Göndərilmədi. Yenidən cəhd et.");
        return;
      }
      setDone(true);
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd et.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-200">
        <Check className="mb-2 h-6 w-6" />
        Cavabın üçün təşəkkürlər! Fikrini nəzərə alacağıq. 💚
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        {WINBACK_REASONS.map((r) => {
          const checked = reason === r.code;
          return (
            <label
              key={r.code}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                checked
                  ? "border-violet-400/60 bg-violet-500/15 text-violet-100"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r.code}
                checked={checked}
                onChange={() => setReason(r.code)}
                className="h-4 w-4 accent-violet-500"
              />
              <span>{r.label}</span>
            </label>
          );
        })}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">
          Əlavə etmək istədiyin varsa (istəyə bağlı)
        </label>
        <textarea
          rows={3}
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          maxLength={1000}
          placeholder="Nəyi dəyişsək geri qayıdardın?"
          className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Göndər
      </button>
    </form>
  );
}
