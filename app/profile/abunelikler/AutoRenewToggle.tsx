"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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

  // Yalnız keçid — "Avtomatik uzat" başlığı və məbləğ kartın içindədir (SiteSubscriptions → AutoRenewRow).
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Avtomatik uzat"
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition disabled:opacity-60 ${
          enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`absolute grid h-6 w-6 place-items-center rounded-full bg-white shadow transition-all ${
            enabled ? "left-[1.375rem]" : "left-0.5"
          }`}
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />}
        </span>
      </button>
      {error && <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-300">{error}</span>}
    </div>
  );
}
