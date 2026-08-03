"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2, Loader2, Package, Wallet } from "lucide-react";

import ProductImage from "../ProductImage";
import {
  formatAzn,
  LOOT_BOX_OUTCOME_LABELS,
  PRIZE_TIER_LABELS,
  type LootBoxOutcome,
  type PrizeTier,
} from "@/lib/lootBoxShared";

type Opening = {
  id: string;
  orderCode: string;
  boxSlug: string;
  boxTitle: string;
  pricePaidCents: number;
  title: string;
  imageUrl: string | null;
  store: string | null;
  valueAznCents: number;
  tier: PrizeTier;
  outcome: LootBoxOutcome;
  sellBackCents: number;
  chosenAt: string | null;
  createdAt: string;
};

const OUTCOME_BADGE: Record<LootBoxOutcome, string> = {
  PENDING_CHOICE: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  CLAIMED_GAME: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  SOLD_BACK: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

/** Profil bölməsi: qutu açılışları + seçim gözləyən hədiyyələr. */
export default function LootBoxHistory() {
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/loot-boxes/openings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { openings: [] }))
      .then((d: { openings?: Opening[] }) => setOpenings(d.openings ?? []))
      .catch(() => setOpenings([]));
  }, []);

  useEffect(load, [load]);

  async function choose(opening: Opening, choice: "GAME" | "SELL_BACK") {
    setBusyId(opening.id);
    setError(null);
    try {
      const res = await fetch(`/api/loot-boxes/openings/${opening.id}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Əməliyyat alınmadı (HTTP ${res.status}).`);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (openings == null) {
    return <div className="h-32 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />;
  }

  if (openings.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
        <Package className="mx-auto h-10 w-10 text-slate-400" />
        <p className="mt-2 text-sm text-slate-500">Hələ qutu açmamısınız.</p>
        <Link
          href="/qutular"
          className="mt-3 inline-block rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-5 py-2 text-sm font-bold text-white"
        >
          Qutulara bax
        </Link>
      </div>
    );
  }

  const pending = openings.filter((o) => o.outcome === "PENDING_CHOICE");

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-300">
          {pending.length} hədiyyə seçim gözləyir — oyunu götürün və ya balansa satın.
        </div>
      )}

      <div className="space-y-3">
        {openings.map((o) => (
          <div
            key={o.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
          >
            {/* `relative` məcburidir — ProductImage `fill` işlədir. */}
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl">
              <ProductImage src={o.imageUrl} alt={o.title} className="h-full w-full object-cover" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-black text-slate-900 dark:text-white">{o.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${OUTCOME_BADGE[o.outcome]}`}>
                  {LOOT_BOX_OUTCOME_LABELS[o.outcome]}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {PRIZE_TIER_LABELS[o.tier]}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {o.boxTitle} · {formatAzn(o.pricePaidCents)} ödənildi · dəyəri{" "}
                <strong className="text-amber-600 dark:text-amber-400">{formatAzn(o.valueAznCents)}</strong>
                {o.outcome === "SOLD_BACK" && ` · ${formatAzn(o.sellBackCents)} balansa yazıldı`}
              </div>
              <div className="text-[11px] text-slate-400">Kod: {o.orderCode}</div>
            </div>

            {o.outcome === "PENDING_CHOICE" && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busyId === o.id}
                  onClick={() => choose(o, "GAME")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {busyId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gamepad2 className="h-3.5 w-3.5" />}
                  Oyunu götür
                </button>
                <button
                  type="button"
                  disabled={busyId === o.id}
                  onClick={() => choose(o, "SELL_BACK")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {formatAzn(o.sellBackCents)}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
