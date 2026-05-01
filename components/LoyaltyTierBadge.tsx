"use client";

import { useState } from "react";
import {
  Crown,
  Lock,
  Sparkles,
  Check,
  ChevronRight,
} from "lucide-react";
import Modal from "./Modal";
import {
  LOYALTY_TIERS,
  type LoyaltyAccent,
  type LoyaltyTier,
  type LoyaltyTierDef,
} from "@/lib/loyalty";

const ACCENTS: Record<
  LoyaltyAccent,
  {
    /** Bright, *current*-tier badge style (used in the header). */
    badge: string;
    /** Glow shadow color (used together with badge). */
    glow: string;
    /** Rounded square containing the crown/lock icon (in the modal). */
    iconBox: string;
    /** Outer card background (when this tier is the current one in the modal). */
    panel: string;
    /** Soft blob behind the panel (decorative). */
    panelBlur: string;
    /** Cashback chip on each tier card. */
    chip: string;
  }
> = {
  indigo: {
    badge:
      "border-indigo-400/60 bg-gradient-to-r from-indigo-500/40 via-indigo-500/25 to-indigo-500/10 text-indigo-50 ring-1 ring-indigo-400/40",
    glow: "shadow-[0_8px_28px_-8px_rgba(99,102,241,0.55)]",
    iconBox: "bg-indigo-500/20 text-indigo-200 ring-indigo-400/40",
    panel:
      "border-indigo-500/40 bg-gradient-to-br from-indigo-950/40 via-zinc-900/40 to-zinc-950",
    panelBlur: "bg-indigo-500/15",
    chip: "bg-indigo-500/20 text-indigo-100 ring-indigo-400/30",
  },
  amber: {
    badge:
      "border-amber-400/60 bg-gradient-to-r from-amber-500/40 via-amber-500/25 to-amber-500/10 text-amber-50 ring-1 ring-amber-400/40",
    glow: "shadow-[0_8px_28px_-8px_rgba(245,158,11,0.55)]",
    iconBox: "bg-amber-500/20 text-amber-200 ring-amber-400/40",
    panel:
      "border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-zinc-900/40 to-zinc-950",
    panelBlur: "bg-amber-500/15",
    chip: "bg-amber-500/20 text-amber-100 ring-amber-400/30",
  },
  slate: {
    badge:
      "border-slate-300/50 bg-gradient-to-r from-slate-300/30 via-slate-300/15 to-slate-400/10 text-white ring-1 ring-slate-300/30",
    glow: "shadow-[0_8px_28px_-8px_rgba(148,163,184,0.45)]",
    iconBox: "bg-slate-300/15 text-slate-100 ring-slate-300/40",
    panel:
      "border-slate-400/40 bg-gradient-to-br from-slate-900/60 via-zinc-900/40 to-zinc-950",
    panelBlur: "bg-slate-300/12",
    chip: "bg-slate-300/15 text-slate-100 ring-slate-300/30",
  },
  yellow: {
    badge:
      "border-yellow-300/60 bg-gradient-to-r from-yellow-400/40 via-amber-400/25 to-yellow-500/15 text-yellow-50 ring-1 ring-yellow-300/40",
    glow: "shadow-[0_8px_28px_-8px_rgba(250,204,21,0.55)]",
    iconBox: "bg-yellow-400/20 text-yellow-200 ring-yellow-300/40",
    panel:
      "border-yellow-500/40 bg-gradient-to-br from-yellow-900/40 via-amber-950/30 to-zinc-950",
    panelBlur: "bg-yellow-400/15",
    chip: "bg-yellow-400/20 text-yellow-100 ring-yellow-300/30",
  },
  cyan: {
    badge:
      "border-cyan-300/60 bg-gradient-to-r from-cyan-400/40 via-sky-400/25 to-cyan-500/15 text-cyan-50 ring-1 ring-cyan-300/40",
    glow: "shadow-[0_8px_28px_-8px_rgba(34,211,238,0.6)]",
    iconBox: "bg-cyan-400/20 text-cyan-200 ring-cyan-300/40",
    panel:
      "border-cyan-500/40 bg-gradient-to-br from-cyan-950/40 via-sky-950/30 to-zinc-950",
    panelBlur: "bg-cyan-400/20",
    chip: "bg-cyan-400/20 text-cyan-100 ring-cyan-300/30",
  },
};

export default function LoyaltyTierBadge({ tier }: { tier: LoyaltyTier }) {
  const [open, setOpen] = useState(false);
  const a = ACCENTS[tier.accent];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Bütün səviyyələrə bax"
        className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${a.badge} ${a.glow}`}
      >
        <Crown className="h-3.5 w-3.5 drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
        <span className="tracking-wide">{tier.label}</span>
        {tier.cashbackPct > 0 && (
          <span className="rounded-md bg-black/30 px-1.5 py-px text-[10px] font-bold tracking-wide">
            {tier.cashbackPct}% cashback
          </span>
        )}
        <ChevronRight className="h-3 w-3 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="lg">
        <TiersInfo tier={tier} />
      </Modal>
    </>
  );
}

function TiersInfo({ tier }: { tier: LoyaltyTier }) {
  const a = ACCENTS[tier.accent];
  return (
    <div className="p-6 sm:p-7">
      <header className="mb-5 flex items-start gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${a.iconBox}`}
        >
          <Crown className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Loyalty səviyyələri
          </h2>
          <p className="text-sm text-zinc-400">
            Hər səviyyədə daha çox cashback qazanırsan. Cari səviyyən:{" "}
            <span className="text-white">{tier.label}</span>
            {tier.cashbackPct > 0 && (
              <span className="text-zinc-500">
                {" "}
                · {tier.cashbackPct}% cashback
              </span>
            )}
          </p>
        </div>
      </header>

      <ol className="space-y-3">
        {LOYALTY_TIERS.map((def) => (
          <TierRow
            key={def.label}
            def={def}
            current={def.label === tier.label}
            unlocked={tier.spentAzn >= def.minSpendAzn}
            spentAzn={tier.spentAzn}
          />
        ))}
      </ol>

      <p className="mt-5 text-center text-[11px] text-zinc-500">
        Səviyyələr ümumi xərcə görə avtomatik yenilənir. Cashback alış başa
        çatdıqdan sonra cashback balansına köçürülür.
      </p>
    </div>
  );
}

function TierRow({
  def,
  current,
  unlocked,
  spentAzn,
}: {
  def: LoyaltyTierDef;
  current: boolean;
  unlocked: boolean;
  spentAzn: number;
}) {
  const a = ACCENTS[def.accent];
  const remaining = unlocked ? 0 : Math.max(0, def.minSpendAzn - spentAzn);

  return (
    <li
      className={`relative overflow-hidden rounded-2xl border p-4 transition ${
        current
          ? `${a.panel} ring-1 ring-inset ring-white/5`
          : unlocked
            ? "border-zinc-800 bg-zinc-900/40"
            : "border-zinc-800/60 bg-zinc-900/20"
      }`}
    >
      {current && (
        <div
          className={`absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl ${a.panelBlur}`}
        />
      )}

      <div className="relative flex flex-wrap items-start gap-4">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 ${
            unlocked ? a.iconBox : "bg-zinc-800/60 text-zinc-600 ring-zinc-700/60"
          }`}
        >
          {unlocked ? (
            <Crown className="h-5 w-5" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-base font-semibold ${unlocked ? "text-white" : "text-zinc-400"}`}
            >
              {def.label}
            </h3>
            {current && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                <Sparkles className="h-3 w-3" /> Cari
              </span>
            )}
            <span className="text-xs text-zinc-500">
              {def.minSpendAzn === 0
                ? "Başlanğıc"
                : `${def.minSpendAzn.toLocaleString("en-US")} AZN xərcdən sonra`}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {def.cashbackPct > 0 ? (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${a.chip}`}
              >
                {def.cashbackPct}% cashback
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400 ring-1 ring-zinc-700/60">
                Standart səviyyə
              </span>
            )}
          </div>

          <ul className="mt-3 space-y-1">
            {def.rewards.map((r) => (
              <li
                key={r}
                className={`flex items-start gap-2 text-xs ${
                  unlocked ? "text-zinc-300" : "text-zinc-500"
                }`}
              >
                <Check
                  className={`mt-0.5 h-3 w-3 shrink-0 ${
                    unlocked ? "text-emerald-400" : "text-zinc-600"
                  }`}
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>

          {!unlocked && remaining > 0 && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-md bg-zinc-800/70 px-2 py-1 text-[11px] text-zinc-400">
              <Lock className="h-3 w-3" />
              Açmaq üçün {remaining.toLocaleString("en-US")} AZN qaldı
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
