"use client";

import { useState } from "react";
import { TicketPercent, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export type CouponItemPayload = {
  id: string;
  productType: string;
  store?: string;
  qty: number;
  finalAzn: number;
};

export type AppliedCoupon = { code: string; discountCents: number };

/** Kupon endpoint-ini çağırır (həm apply, həm CartView-un re-validasiyası üçün). */
export async function validateCoupon(
  code: string,
  items: CouponItemPayload[],
): Promise<{ ok: true; code: string; discountCents: number } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/cart/coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, items }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, code: String(data.code ?? code), discountCents: Number(data.discountCents ?? 0) };
    }
    return { ok: false, message: String(data.message ?? "Kupon tətbiq olunmadı.") };
  } catch {
    return { ok: false, message: "Şəbəkə xətası. Yenidən cəhd et." };
  }
}

export default function CouponCodeBox({
  items,
  applied,
  onApply,
  onRemove,
}: {
  items: CouponItemPayload[];
  applied: AppliedCoupon | null;
  onApply: (c: AppliedCoupon) => void;
  onRemove: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    const res = await validateCoupon(c, items);
    setBusy(false);
    if (res.ok) {
      onApply({ code: res.code, discountCents: res.discountCents });
      setCode("");
    } else {
      setError(res.message);
    }
  }

  if (applied) {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm text-emerald-200">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold tracking-wide">{applied.code}</span>
            <span className="text-emerald-300/80">tətbiq olundu</span>
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Kuponu sil"
            className="rounded-md p-1 text-emerald-300/80 transition hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <TicketPercent className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Endirim kodu"
            className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/50 py-2.5 pl-8 pr-3 text-sm text-zinc-100 uppercase outline-none transition placeholder:normal-case placeholder:text-zinc-500 focus:border-indigo-500/60"
          />
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={busy || !code.trim()}
          className="shrink-0 rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700/60 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tətbiq et"}
        </button>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
