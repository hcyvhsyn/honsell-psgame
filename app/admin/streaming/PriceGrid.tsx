"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MoreHorizontal, RotateCcw } from "lucide-react";
import { STREAMING_DURATION_OPTIONS } from "@/lib/streamingAccess";
import { btn, postStreaming } from "./adminUi";
import { formatAzn, readProductMeta, type AdminProduct, type TierView } from "./streamingAdminModel";

type CellKey = `${number}:${number}`;

const cellKey = (months: number, seats: number): CellKey => `${months}:${seats}`;

function parseInput(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Plan üçün qiymət cədvəli: müddət × nəfər. Xanaya qiymət yaz → paket satışdadır; boşalt →
 * satışdan çıxır (silinmir). Dəyişikliklər "Yadda saxla" ilə bir sorğuda gedir (SAVE_PRICE_GRID).
 */
export default function PriceGrid({
  tier,
  onSaved,
  onOpenPackage,
}: {
  tier: TierView;
  onSaved: () => Promise<void>;
  onOpenPackage: (product: AdminProduct) => void;
}) {
  // Hər xana üçün: aktiv paket (varsa) → onun qiyməti; deaktiv paket → boş, amma "⋯" açılır.
  const cells = useMemo(() => {
    const map = new Map<CellKey, { active: AdminProduct | null; any: AdminProduct | null }>();
    for (const p of tier.products) {
      const m = readProductMeta(p);
      const key = cellKey(m.durationMonths, m.seats);
      const cur = map.get(key) ?? { active: null, any: null };
      if (p.isActive && !cur.active) cur.active = p;
      if (!cur.any) cur.any = p;
      map.set(key, cur);
    }
    return map;
  }, [tier.products]);

  const initial = useMemo(() => {
    const out: Record<string, string> = {};
    for (const months of STREAMING_DURATION_OPTIONS) {
      for (const seats of tier.seats) {
        const active = cells.get(cellKey(months, seats))?.active;
        out[cellKey(months, seats)] = active ? formatAzn(active.priceAznCents) : "";
      }
    }
    return out;
  }, [cells, tier.seats]);

  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Server təzə data qaytaranda cədvəl yenilənir — yalnız BU planın qiymətləri dəyişibsə
  // (başqa planın "Yadda saxla"-sı bu cədvəldəki yazılmamış dəyişiklikləri silməsin).
  const initialSig = JSON.stringify(initial);
  useEffect(() => {
    setDraft(JSON.parse(initialSig) as Record<string, string>);
  }, [initialSig]);

  const changed = Object.keys(initial).filter((k) => {
    const a = parseInput(initial[k]);
    const b = parseInput(draft[k] ?? "");
    return a !== b && !(Number.isNaN(a) && Number.isNaN(b));
  });
  const invalid = Object.entries(draft).filter(([, v]) => {
    const n = parseInput(v);
    return n != null && (Number.isNaN(n) || n <= 0);
  });

  async function save() {
    if (changed.length === 0 || invalid.length > 0) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await postStreaming<{ created: number; updated: number; disabled: number }>({
      action: "SAVE_PRICE_GRID",
      service: tier.code,
      variantSlug: tier.variantSlug,
      cells: changed.map((k) => {
        const [months, seats] = k.split(":").map(Number);
        return { durationMonths: months, seats, priceAzn: parseInput(draft[k] ?? "") };
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const parts = [
      res.data.created ? `${res.data.created} yeni paket` : "",
      res.data.updated ? `${res.data.updated} yeniləndi` : "",
      res.data.disabled ? `${res.data.disabled} satışdan çıxdı` : "",
    ].filter(Boolean);
    setNotice(parts.length ? parts.join(" · ") : "Dəyişiklik yoxdur");
    await onSaved();
  }

  function input(months: number, seats: number) {
    const key = cellKey(months, seats);
    const value = draft[key] ?? "";
    const n = parseInput(value);
    const bad = n != null && (Number.isNaN(n) || n <= 0);
    const dirty = changed.includes(key);
    const product = cells.get(key)?.active ?? cells.get(key)?.any ?? null;
    const inactive = product && !product.isActive;
    const perMonth = n != null && !bad && months > 1 ? n / months : null;
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <input
              inputMode="decimal"
              value={value}
              aria-label={`${months} ay${seats > 1 ? `, ${seats} nəfər` : ""} qiyməti`}
              placeholder={inactive ? formatAzn(product!.priceAznCents) : "—"}
              title={inactive ? "Satışdan çıxarılıb — qiymət yazsan yenidən satışa çıxar" : undefined}
              onChange={(e) => {
                setNotice(null);
                setDraft((d) => ({ ...d, [key]: e.target.value }));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              className={`block w-full rounded-lg border bg-admin-card py-1.5 pl-2.5 pr-7 text-sm tabular-nums text-zinc-900 outline-none transition placeholder:text-[11px] placeholder:text-zinc-400 focus:border-violet-500 ${
                bad ? "border-rose-500" : dirty ? "border-amber-500" : "border-admin-line"
              }`}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">₼</span>
          </div>
          {product ? (
            <button
              type="button"
              onClick={() => onOpenPackage(product)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-admin-chip hover:text-violet-700"
              title="Paket detalları (ad, köhnə qiymət, şəkil)"
              aria-label="Paket detalları"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          ) : (
            // Xanalar eyni endə qalsın.
            <span className="h-7 w-7 shrink-0" aria-hidden />
          )}
        </div>
        <p className="mt-0.5 h-4 truncate text-[10px] tabular-nums text-zinc-500">
          {perMonth != null ? `≈ ${perMonth.toFixed(2)} ₼/ay` : inactive && !value ? "söndürülüb" : ""}
        </p>
      </div>
    );
  }

  const singleSeat = tier.seats.length === 1;

  return (
    <div>
      {singleSeat ? (
        <div className="grid max-w-3xl grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-5">
          {STREAMING_DURATION_OPTIONS.map((months) => (
            <div key={months}>
              <p className="mb-1 text-[11px] font-semibold text-zinc-500">{months} ay</p>
              {input(months, 1)}
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-xl overflow-x-auto">
          <table className="w-full min-w-[300px] border-separate border-spacing-x-2 border-spacing-y-0.5">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-zinc-500">
                <th className="w-16 pb-1 font-semibold">Müddət</th>
                {tier.seats.map((s) => (
                  <th key={s} className="pb-1 font-semibold">
                    {s} nəfər
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STREAMING_DURATION_OPTIONS.map((months) => (
                <tr key={months}>
                  <td className="pt-1.5 align-top text-sm font-semibold text-zinc-700">{months} ay</td>
                  {tier.seats.map((s) => (
                    <td key={s} className="align-top">
                      {input(months, s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={saving || changed.length === 0 || invalid.length > 0} className={btn.primary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Yadda saxla{changed.length > 0 ? ` (${changed.length})` : ""}
        </button>
        {changed.length > 0 && !saving && (
          <button type="button" onClick={() => setDraft(initial)} className={btn.ghost}>
            <RotateCcw className="h-3.5 w-3.5" /> Geri qaytar
          </button>
        )}
        {invalid.length > 0 && <span className="text-xs text-rose-600">Qiymət müsbət rəqəm olmalıdır.</span>}
        {error && <span className="text-xs text-rose-600">{error}</span>}
        {notice && !error && <span className="text-xs text-emerald-700">✓ {notice}</span>}
      </div>
    </div>
  );
}
