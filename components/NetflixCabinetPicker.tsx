"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ShoppingCart, Users } from "lucide-react";
import { useCart } from "@/lib/cart";
import { TermsModal, netflixTheme, resolveTerms } from "@/components/StreamingPlanPicker";
import type { VariantFeature } from "@/lib/streamingVariants";

export type NetflixCabinetTier = {
  /** `?paket=` dəyəri. */
  key: string;
  /** `metadata.service`, məs. NETFLIX_YANIMDA. */
  code: string;
  name: string;
  features: VariantFeature[];
};

export type NetflixCabinetProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
};

type Row = NetflixCabinetProduct & { code: string; seats: number; months: number };

function toRow(p: NetflixCabinetProduct): Row {
  const m = p.metadata ?? {};
  return {
    ...p,
    code: String(m.service ?? "").toUpperCase(),
    seats: Number(m.seats) || 1,
    months: Number(m.durationMonths) || 0,
  };
}

const uniqueSorted = (values: number[]) => Array.from(new Set(values)).sort((a, b) => a - b);

/** İkinci addım (otaq): paket → nəfər → müddət, hamısı bir səhifədə. */
export default function NetflixCabinetPicker({
  tiers,
  products,
  initialKey,
}: {
  tiers: NetflixCabinetTier[];
  products: NetflixCabinetProduct[];
  initialKey?: string;
}) {
  const cart = useCart();
  const rows = useMemo(() => products.map(toRow).filter((r) => r.months > 0), [products]);
  const available = useMemo(() => tiers.filter((t) => rows.some((r) => r.code === t.code)), [tiers, rows]);

  const [tierKey, setTierKey] = useState(initialKey ?? "");
  const [seatsWanted, setSeatsWanted] = useState(1);
  const [monthsWanted, setMonthsWanted] = useState(0);
  const [termsOpen, setTermsOpen] = useState(false);

  // Seçim mövcud birləşməyə düşmürsə ən yaxın mövcud dəyər götürülür (paket dəyişəndə də).
  const tier = available.find((t) => t.key === tierKey) ?? available[0] ?? null;
  const tierRows = rows.filter((r) => r.code === tier?.code);
  const seatOptions = uniqueSorted(tierRows.map((r) => r.seats));
  const seats = seatOptions.includes(seatsWanted) ? seatsWanted : seatOptions[0] ?? 1;
  const seatRows = tierRows.filter((r) => r.seats === seats);
  const monthOptions = uniqueSorted(seatRows.map((r) => r.months));
  const months = monthOptions.includes(monthsWanted) ? monthsWanted : monthOptions[0] ?? 0;
  const selected = seatRows.find((r) => r.months === months) ?? null;

  if (!tier) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-400">
        Netflix üçün aktiv paket yoxdur.
      </div>
    );
  }

  const terms = resolveTerms(tier.code, tier.name);
  const inCart = cart.hydrated && !!selected && cart.items.some((i) => i.id === selected.id);

  function addToCart() {
    if (!selected) return;
    cart.add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl,
      finalAzn: selected.priceAznCents / 100,
      productType: "STREAMING",
    });
    setTermsOpen(false);
  }

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-sm font-bold transition ${
      active ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-white/[0.04] text-zinc-200 hover:border-zinc-200 dark:hover:border-white/30"
    }`;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h2 className="text-3xl font-black text-white sm:text-4xl">Otağını seç</h2>

      <section aria-label="Paket">
        <p className="mb-3 text-sm font-bold text-zinc-300">Paket</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {available.map((t) => {
            const active = t.key === tier.key;
            // Birinci ekrandakı "ayda X ₼-dan" ilə eyni hesab: nəfərə bölünmür.
            const fromPpm = Math.min(
              ...rows.filter((r) => r.code === t.code).map((r) => r.priceAznCents / r.months),
            );
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                onClick={() => setTierKey(t.key)}
                className={`relative flex flex-col rounded-2xl border p-4 text-left transition ${
                  active ? "border-violet-500 bg-violet-500/10" : "border-zinc-200 dark:border-white/10 bg-zinc-950 hover:border-zinc-200 dark:hover:border-white/25"
                }`}
              >
                <span className="pr-6 text-lg font-black text-white">{t.name}</span>
                {active && <Check className="absolute right-3 top-4 h-5 w-5 text-violet-700 dark:text-violet-300" />}
                <span className="mt-1 text-xs font-semibold text-zinc-400">
                  Ayda {(fromPpm / 100).toFixed(2)} ₼-dan
                </span>
                <span className="mt-3 text-xs leading-5 text-zinc-300">{t.features[0]?.text}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Neçə nəfər">
        <p className="mb-3 text-sm font-bold text-zinc-300">Neçə nəfər?</p>
        <div className="flex flex-wrap items-center gap-2">
          {seatOptions.map((n) => (
            <button key={n} type="button" aria-pressed={n === seats} onClick={() => setSeatsWanted(n)} className={`inline-flex items-center gap-1.5 ${chip(n === seats)}`}>
              <Users className="h-4 w-4" />
              {n} nəfər
            </button>
          ))}
          <span className="text-xs text-zinc-500">Hər nəfərə ayrıca otaq verilir</span>
        </div>
      </section>

      <section aria-label="Neçə ay">
        <p className="mb-3 text-sm font-bold text-zinc-300">Neçə ay?</p>
        <div className="flex flex-wrap gap-2">
          {monthOptions.map((n) => (
            <button key={n} type="button" aria-pressed={n === months} onClick={() => setMonthsWanted(n)} className={chip(n === months)}>
              {n} ay
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-300">
            {tier.name} · {seats} nəfər · {months} ay
          </p>
          {selected && (
            <p className="mt-1 text-3xl font-black tabular-nums text-white">
              {(selected.priceAznCents / 100).toFixed(2)} ₼
            </p>
          )}
        </div>
        {inCart ? (
          <Link href="/cart" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-6 text-sm font-black text-emerald-700 dark:text-emerald-50">
            <Check className="h-4 w-4" />
            Səbətdədir, keç
          </Link>
        ) : (
          <button
            type="button"
            disabled={!selected}
            onClick={() => (terms ? setTermsOpen(true) : addToCart())}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-6 text-sm font-black text-white disabled:opacity-50 ${netflixTheme.cta}`}
          >
            <ShoppingCart className="h-4 w-4" />
            Səbətə əlavə et
          </button>
        )}
      </section>

      {termsOpen && terms && (
        <TermsModal
          terms={terms}
          serviceLabel={`Netflix ${tier.name}`}
          theme={netflixTheme}
          mode="confirm"
          onClose={() => setTermsOpen(false)}
          onConfirm={addToCart}
        />
      )}
    </div>
  );
}
