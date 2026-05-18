"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

type Props = {
  label: string;
  value: string;
  /** `true` olduqda mətn üzərinə kliklənənə qədər nöqtələrlə gizlədilir (şifrə kimi). */
  masked?: boolean;
  /** Mono font istifadə et (kod / şifrə üçün). */
  mono?: boolean;
};

export default function CopyableField({ label, value, masked = false, mono = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </div>
        <div
          className={`mt-0.5 truncate text-sm text-zinc-100 ${mono ? "font-mono" : ""}`}
          title={revealed ? value : undefined}
        >
          {revealed ? value : "•".repeat(Math.min(value.length, 12))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {masked && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Gizlət" : "Göstər"}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          aria-label="Kopyala"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
