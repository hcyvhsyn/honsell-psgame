"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

type Mode = "AUTO" | "MARGIN" | "FIXED";

const MODES: { value: Mode; label: string }[] = [
  { value: "AUTO", label: "Avto" },
  { value: "MARGIN", label: "Faiz" },
  { value: "FIXED", label: "Sabit ₼" },
];

/**
 * Oyuna xüsusi qiymət redaktoru. Cədvəl `overflow-x-auto` olduğu üçün popover
 * kəsilərdi — redaktor xananın içində açılır.
 */
export default function PriceEditor({
  gameId,
  customMarginPct,
  customPriceAznCents,
  costAzn,
  autoPct,
}: {
  gameId: string;
  customMarginPct: number | null;
  customPriceAznCents: number | null;
  /** Hazırkı maya (aktiv endirim varsa endirimli TRY-dan). */
  costAzn: number;
  /** Avto rejimdə bu mayaya düşən pillə faizi. */
  autoPct: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current: Mode =
    customPriceAznCents != null ? "FIXED" : customMarginPct != null ? "MARGIN" : "AUTO";
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(current);
  const [pct, setPct] = useState(String(customMarginPct ?? autoPct));
  const [price, setPrice] = useState(
    customPriceAznCents != null ? (customPriceAznCents / 100).toFixed(2) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const preview =
    mode === "MARGIN"
      ? costAzn * (1 + (Number(pct) || 0) / 100)
      : mode === "FIXED"
        ? Number(price) || 0
        : null;
  const belowCost = preview != null && preview > 0 && preview < costAzn;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/games/${gameId}/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, marginPct: Number(pct), priceAzn: Number(price) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const badge =
    current === "FIXED"
      ? { text: `Sabit ${(customPriceAznCents! / 100).toFixed(2)} ₼`, cls: "bg-amber-500/15 text-amber-700 ring-amber-500/40" }
      : current === "MARGIN"
        ? { text: `Custom ${customMarginPct}%`, cls: "bg-violet-500/15 text-violet-700 ring-violet-500/30" }
        : { text: `Avto · ${autoPct}%`, cls: "bg-admin-card text-zinc-700 ring-admin-line" };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setMode(current);
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs ring-1 transition hover:bg-admin-chip2 ${badge.cls}`}
      >
        {badge.text}
        <Pencil className="h-3 w-3 opacity-60" />
      </button>
    );
  }

  return (
    <div className="w-56 space-y-2 rounded-md bg-admin-card p-2 text-xs ring-1 ring-admin-line2">
      <div className="flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`flex-1 rounded px-2 py-1 ring-1 ${
              mode === m.value
                ? "bg-violet-500/15 text-violet-700 ring-violet-500/30"
                : "text-zinc-700 ring-admin-line hover:bg-admin-chip2"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "AUTO" && (
        <p className="text-zinc-600">Pillə faizi tətbiq olunur ({autoPct}%).</p>
      )}
      {mode === "MARGIN" && (
        <label className="flex items-center gap-2">
          <input
            type="number"
            step={0.5}
            min={0}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="w-20 rounded border border-admin-line2 bg-admin-card px-2 py-1 text-zinc-900 focus:border-violet-500 focus:outline-none"
          />
          <span className="text-zinc-600">% mayanın üstünə</span>
        </label>
      )}
      {mode === "FIXED" && (
        <label className="flex items-center gap-2">
          <input
            type="number"
            step={0.01}
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24 rounded border border-admin-line2 bg-admin-card px-2 py-1 text-zinc-900 focus:border-violet-500 focus:outline-none"
          />
          <span className="text-zinc-600">₼ (PS endirimi işləmir)</span>
        </label>
      )}

      {preview != null && (
        <p className={belowCost ? "text-rose-700" : "text-zinc-600"}>
          Satış {preview.toFixed(2)} ₼ · maya {costAzn.toFixed(2)} ₼
          {belowCost && " — mayadan aşağıdır!"}
        </p>
      )}
      {error && <p className="text-rose-700">{error}</p>}

      <div className="flex gap-1">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex-1 rounded bg-violet-600 px-2 py-1 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "…" : "Yadda saxla"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-2 py-1 text-zinc-600 ring-1 ring-admin-line hover:bg-admin-chip2"
        >
          Ləğv et
        </button>
      </div>
    </div>
  );
}
