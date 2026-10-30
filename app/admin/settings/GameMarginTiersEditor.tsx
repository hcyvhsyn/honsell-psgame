"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  normalizeGameMarginTiers,
  tieredGameAzn,
  type GameMarginTier,
} from "@/lib/gameMargin";

const DEFAULT_TIERS: GameMarginTier[] = [
  { upToAzn: 20, pct: 50 },
  { upToAzn: 100, pct: 20 },
  { upToAzn: null, pct: 10 },
];

const PREVIEW_COSTS = [10, 19.99, 20.01, 30, 60, 100, 105, 150, 250];

const INPUT =
  "w-24 rounded-md border border-admin-line2 bg-admin-card px-2 py-1.5 text-zinc-900 focus:border-violet-500 focus:outline-none";

/**
 * Oyunlar üçün mayaya görə pilləli mənfəət. Boş massiv → tək faiz
 * (`profitMarginGamesPct`) işləyir. Hesablama: lib/gameMargin.ts.
 */
export default function GameMarginTiersEditor({
  tiers,
  fallbackPct,
  onChange,
}: {
  tiers: GameMarginTier[];
  fallbackPct: number;
  onChange: (tiers: GameMarginTier[]) => void;
}) {
  const enabled = tiers.length > 0;
  const effective = normalizeGameMarginTiers(tiers);

  function update(index: number, patch: Partial<GameMarginTier>) {
    onChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addRow() {
    // Yeni sətir son ("daha baha") pillədən əvvələ düşür.
    const bounded = tiers.filter((t) => t.upToAzn != null);
    const last = bounded[bounded.length - 1]?.upToAzn ?? 0;
    const open = tiers.find((t) => t.upToAzn == null) ?? { upToAzn: null, pct: 10 };
    onChange([...bounded, { upToAzn: last + 50, pct: open.pct }, open]);
  }

  return (
    <div className="rounded-lg border border-admin-line bg-admin-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">
            Oyunlar — qiymətə görə pillələr
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Pillə mayaya (TRY × məzənnə) görə seçilir. Sərhəddə qiymət düşmür: maya bir
            pillədən o birinə keçəndə satış qiyməti əvvəlki pillənin tavanından aşağı
            olmur. Oyuna xüsusi faiz/qiymət <a href="/admin/games" className="font-semibold text-violet-700 underline">Games</a> səhifəsindən verilir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(enabled ? [] : DEFAULT_TIERS)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ring-1 ${
            enabled
              ? "bg-admin-chip text-zinc-700 ring-admin-line2 hover:bg-admin-chip2"
              : "bg-violet-600 text-white ring-violet-600 hover:bg-violet-500"
          }`}
        >
          {enabled ? "Pillələri söndür" : "Pillələri aktiv et"}
        </button>
      </div>

      {!enabled ? (
        <p className="mt-3 text-xs text-zinc-600">
          Söndürülüb — bütün oyunlara tək faiz tətbiq olunur ({fallbackPct}%).
        </p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-2 text-sm">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                {tier.upToAzn == null ? (
                  <span className="w-[8.5rem] text-zinc-700">Daha baha</span>
                ) : (
                  <>
                    <span className="text-zinc-600">Maya ≤</span>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      value={tier.upToAzn}
                      onChange={(e) => update(i, { upToAzn: Number(e.target.value) })}
                      className={INPUT}
                    />
                    <span className="text-zinc-600">₼</span>
                  </>
                )}
                <span className="text-zinc-500">→</span>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={tier.pct}
                  onChange={(e) => update(i, { pct: Number(e.target.value) })}
                  className={INPUT}
                />
                <span className="text-zinc-600">%</span>
                {tier.upToAzn != null && tiers.length > 2 && (
                  <button
                    type="button"
                    onClick={() => onChange(tiers.filter((_, j) => j !== i))}
                    className="rounded p-1 text-zinc-500 hover:bg-admin-chip hover:text-rose-600"
                    aria-label="Pilləni sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-700 hover:bg-admin-chip"
            >
              <Plus className="h-3.5 w-3.5" /> Pillə əlavə et
            </button>
          </div>

          <table className="w-full text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 text-left font-medium">Maya</th>
                <th className="py-1 text-left font-medium">Satış</th>
                <th className="py-1 text-left font-medium">Mənfəət</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line text-zinc-800">
              {PREVIEW_COSTS.map((cost) => {
                const price = tieredGameAzn(cost, effective, fallbackPct);
                return (
                  <tr key={cost}>
                    <td className="py-1">{cost.toFixed(2)} ₼</td>
                    <td className="py-1 font-medium">{price.toFixed(2)} ₼</td>
                    <td className="py-1 text-zinc-600">
                      {(price - cost).toFixed(2)} ₼ · {(((price - cost) / cost) * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
