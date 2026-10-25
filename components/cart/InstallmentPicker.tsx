"use client";

import { useState } from "react";
import { CalendarDays, Check, X } from "lucide-react";
import { useInstallmentOffer } from "@/components/useInstallmentOffer";
import InstallmentCardLogo from "@/components/InstallmentCardLogo";
import {
  cheapestMonthly,
  installmentAvailable,
  installmentChargeCents,
  installmentMarkupPct,
  monthlyAzn,
  type InstallmentOption,
} from "@/lib/installmentsShared";

export type InstallmentChoice = { cardId: string; months: number };

function formatPct(pct: number) {
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

/** Seçilmiş müddət üçün taksitli yekun (komissiya daxil) — server də eyni formulu işlədir. */
function quote(amountAzn: number, option: InstallmentOption) {
  const totalAzn = installmentChargeCents(Math.round(amountAzn * 100), option.feePct) / 100;
  return {
    totalAzn,
    extraAzn: totalAzn - amountAzn,
    markupPct: installmentMarkupPct(option.feePct),
    monthly: monthlyAzn(totalAzn, option.months),
  };
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-500/15 text-[11px] text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
        {n}
      </span>
      {children}
    </p>
  );
}

/**
 * Səbətdə taksit — addım-addım ki, müştəri çaşmasın:
 *   bağlı düymə (loqolar + "ayda X ₼-dan") → 1. bank → 2. müddət → yekun + ödə.
 * Hər addım əvvəlki seçiləndən sonra açılır; bank dəyişəndə müddət sıfırlanır.
 * Taksit söndürülübsə və ya məbləğ minimumdan azdırsa heç nə render olunmur.
 */
export default function InstallmentPicker({
  amountAzn,
  busy,
  onPay,
}: {
  amountAzn: number;
  busy: boolean;
  onPay: (choice: InstallmentChoice) => void;
}) {
  const offer = useInstallmentOffer(amountAzn);
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [months, setMonths] = useState<number | null>(null);

  if (!offer || !installmentAvailable(offer, amountAzn)) return null;

  const best = cheapestMonthly(amountAzn, offer.cards);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          // Tək bank varsa birinci addımı atla.
          if (offer.cards.length === 1) setCardId(offer.cards[0].id);
        }}
        className="w-full rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-3 text-left transition hover:border-violet-400/70 hover:bg-violet-500/15 active:scale-[0.98]"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            Taksitlə ödə
          </span>
          {best ? (
            <span className="text-xs font-semibold tabular-nums text-violet-700 dark:text-violet-200">
              ayda {best.monthlyAzn.toFixed(2)} ₼-dan
            </span>
          ) : null}
        </span>
        <span className="mt-2.5 flex flex-wrap gap-1.5">
          {offer.cards.map((card) => (
            <InstallmentCardLogo key={card.id} name={card.name} heightPx={14} />
          ))}
        </span>
      </button>
    );
  }

  const card = offer.cards.find((c) => c.id === cardId) ?? null;
  const option = card?.options.find((o) => o.months === months) ?? null;
  const selected = option ? quote(amountAzn, option) : null;

  return (
    <div className="space-y-4 rounded-xl border border-violet-400/40 bg-white/70 p-3.5 dark:bg-zinc-950/60">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          Taksitlə ödə
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCardId(null);
            setMonths(null);
          }}
          aria-label="Taksiti bağla"
          className="rounded-md p-1 text-zinc-500 transition hover:bg-black/5 hover:text-zinc-800 dark:hover:bg-white/5 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <StepLabel n={1}>Bankı seç</StepLabel>
        <div className="grid grid-cols-3 gap-2">
          {offer.cards.map((c) => {
            const active = c.id === cardId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCardId(c.id);
                  setMonths(null);
                }}
                aria-pressed={active}
                className={`relative grid h-12 place-items-center rounded-lg bg-white px-2 ring-2 transition ${
                  active ? "ring-violet-500" : "ring-zinc-200 hover:ring-zinc-400 dark:ring-transparent dark:hover:ring-white/30"
                }`}
              >
                <InstallmentCardLogo name={c.name} heightPx={18} />
                {active ? (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-violet-500 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {card ? (
        <div className="space-y-2">
          <StepLabel n={2}>Müddəti seç</StepLabel>
          <div className="space-y-1.5">
            {card.options.map((o) => {
              const q = quote(amountAzn, o);
              const active = o.months === months;
              return (
                <button
                  key={o.months}
                  type="button"
                  onClick={() => setMonths(o.months)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left tabular-nums transition ${
                    active
                      ? "border-violet-400 bg-violet-500/15"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                      active ? "border-violet-400 bg-violet-500" : "border-zinc-400 dark:border-zinc-600"
                    }`}
                  >
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                  <span className="w-12 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{o.months} ay</span>
                  <span className="flex-1 text-sm text-zinc-600 dark:text-zinc-300">ayda {q.monthly.toFixed(2)} ₼</span>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">+{formatPct(q.markupPct)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selected && card && option ? (
        <div className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
              <dt>Səbət</dt>
              <dd className="tabular-nums">{amountAzn.toFixed(2)} ₼</dd>
            </div>
            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
              <dt>Taksit faizi (+{formatPct(selected.markupPct)}%)</dt>
              <dd className="tabular-nums text-amber-600 dark:text-amber-300">+{selected.extraAzn.toFixed(2)} ₼</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="text-sm text-zinc-800 dark:text-zinc-200">Taksitlə yekun</dt>
              <dd className="text-lg font-bold tabular-nums text-zinc-950 dark:text-white">
                {selected.totalAzn.toFixed(2)} ₼
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => onPay({ cardId: card.id, months: option.months })}
            disabled={busy}
            className="flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "İşlənir..." : `${option.months} ay × ${selected.monthly.toFixed(2)} ₼ — Davam et`}
          </button>
          <p className="text-center text-[11px] leading-snug text-zinc-500">
            Bankın səhifəsində kartın ilk 8 rəqəmini yazıb eyni bankı və müddəti təsdiqləyəcəksən.
          </p>
        </div>
      ) : null}
    </div>
  );
}
