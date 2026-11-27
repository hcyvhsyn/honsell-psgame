"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

export default function AutoRenewToggle({
  subscriptionId,
  initial,
}: {
  subscriptionId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEnabled(!next);
        setError(data.error ?? "Dəyişiklik yadda saxlanmadı");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:opacity-50 ${
          enabled
            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40 hover:bg-emerald-500/25"
            : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
        }`}
        title="Avtomatik yenilə"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Avtomatik yenilə
        <span
          aria-hidden
          className={`relative inline-flex h-3.5 w-7 items-center rounded-full transition ${
            enabled ? "bg-emerald-500" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute h-3 w-3 rounded-full bg-white transition ${
              enabled ? "left-3.5" : "left-0.5"
            }`}
          />
        </span>
      </button>
      {error && <span className="text-[10px] text-rose-300">{error}</span>}
    </div>
  );
}
