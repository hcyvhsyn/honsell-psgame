"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";

export type GamesProfitDay = {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  revenueAznCents: number;
  costAznCents: number;
  profitAznCents: number;
  orderCount: number;
};

export type UnknownCostGame = {
  gameId: string;
  title: string;
  orderCount: number;
  revenueAznCents: number;
};

function fmtAzn(cents: number): string {
  return `${(cents / 100).toFixed(2)} AZN`;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export default function GamesProfitChart({
  days,
  totals,
  unknown,
}: {
  days: GamesProfitDay[];
  totals: { revenue: number; cost: number; profit: number; orders: number };
  unknown: {
    orderCount: number;
    revenueAznCents: number;
    games: UnknownCostGame[];
  };
}) {
  const [hover, setHover] = useState<number | null>(null);

  const maxValue = useMemo(() => {
    let max = 0;
    for (const d of days) {
      if (d.revenueAznCents > max) max = d.revenueAznCents;
    }
    return Math.max(max, 1);
  }, [days]);

  const marginPct =
    totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  const focused = hover != null ? days[hover] : null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-white">
              PlayStation oyun mənfəəti — son 30 gün
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Hər oyun üçün maya dəyəri (TRY × FX) ilə müştəri qiyməti arasındakı fərq.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <Stat label="Dövriyyə" value={fmtAzn(totals.revenue)} tone="zinc" />
          <Stat label="Maya" value={fmtAzn(totals.cost)} tone="rose" />
          <Stat label="Mənfəət" value={fmtAzn(totals.profit)} tone="emerald" />
          <Stat
            label="Marja"
            value={`${marginPct.toFixed(1)}%`}
            tone="violet"
          />
          <Stat label="Sifariş" value={String(totals.orders)} tone="zinc" />
        </div>
      </header>

      <div className="mt-5">
        <div className="relative h-56 w-full">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[1, 0.75, 0.5, 0.25, 0].map((p) => (
              <div
                key={p}
                className="flex items-center gap-2"
              >
                <span className="w-14 shrink-0 text-right text-[10px] text-zinc-600 tabular-nums">
                  {fmtAzn(maxValue * p)}
                </span>
                <div className="h-px flex-1 bg-zinc-800/70" />
              </div>
            ))}
          </div>

          <div
            className="absolute inset-0 ml-16 flex items-end gap-[2px]"
            onMouseLeave={() => setHover(null)}
          >
            {days.map((d, i) => {
              const revH = (d.revenueAznCents / maxValue) * 100;
              const costH = (d.costAznCents / maxValue) * 100;
              const isHover = hover === i;
              return (
                <div
                  key={d.date}
                  className="group relative flex h-full flex-1 cursor-pointer flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                >
                  <div
                    className={`relative w-full rounded-t-sm transition-colors ${
                      isHover ? "bg-emerald-400/40" : "bg-emerald-500/25"
                    }`}
                    style={{ height: `${revH}%` }}
                  >
                    <div
                      className={`absolute bottom-0 left-0 right-0 ${
                        isHover ? "bg-rose-400/70" : "bg-rose-500/50"
                      }`}
                      style={{ height: `${(costH / Math.max(revH, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-1 ml-16 flex justify-between text-[10px] text-zinc-600">
          {days.length > 0 ? (
            <>
              <span>{shortDate(days[0].date)}</span>
              {days.length > 14 ? (
                <span>{shortDate(days[Math.floor(days.length / 2)].date)}</span>
              ) : null}
              <span>{shortDate(days[days.length - 1].date)}</span>
            </>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
          <Legend color="bg-emerald-500/25" label="Dövriyyə (müştəri ödəyir)" />
          <Legend color="bg-rose-500/50" label="Maya (TRY × FX)" />
          <span className="text-zinc-600">Fərq = mənfəət</span>
        </div>

        {focused ? (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-zinc-300">{focused.date}</span>
              <span className="text-zinc-500">{focused.orderCount} sifariş</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <div className="text-zinc-500">Dövriyyə</div>
                <div className="font-semibold text-zinc-200">
                  {fmtAzn(focused.revenueAznCents)}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">Maya</div>
                <div className="font-semibold text-rose-300">
                  {fmtAzn(focused.costAznCents)}
                </div>
              </div>
              <div>
                <div className="text-zinc-500">Mənfəət</div>
                <div className="font-semibold text-emerald-300">
                  {fmtAzn(focused.profitAznCents)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {unknown.orderCount > 0 ? (
        <UnknownCostPanel unknown={unknown} />
      ) : null}
    </section>
  );
}

function UnknownCostPanel({
  unknown,
}: {
  unknown: {
    orderCount: number;
    revenueAznCents: number;
    games: UnknownCostGame[];
  };
}) {
  const [open, setOpen] = useState(false);
  const visibleGames = open ? unknown.games : unknown.games.slice(0, 3);

  return (
    <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <h3 className="text-sm font-semibold text-amber-100">
              Maya dəyəri naməlum olan sifarişlər
            </h3>
            <p className="mt-0.5 text-[11px] text-amber-200/80">
              Bu sifarişlər mənfəət hesabına daxil edilmir. Səbəb: scrape-də TRY
              qiyməti yoxdur, ya da köhnə tranzaksiyadır (alış snapshot-u yoxdur).
              Oyunu yenidən scrape edin və ya admin paneldən qiymət təyin edin.
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-amber-200/70">
            Naməlum
          </div>
          <div className="text-sm font-semibold text-amber-200">
            {unknown.orderCount} sifariş · {fmtAzn(unknown.revenueAznCents)}
          </div>
        </div>
      </div>

      {visibleGames.length > 0 ? (
        <ul className="mt-3 divide-y divide-amber-500/15 border-t border-amber-500/15">
          {visibleGames.map((g) => (
            <li
              key={g.gameId}
              className="flex items-center justify-between gap-3 py-1.5 text-xs"
            >
              <span className="truncate text-amber-100">{g.title}</span>
              <span className="shrink-0 font-mono text-[11px] text-amber-200/80">
                {g.orderCount}× · {fmtAzn(g.revenueAznCents)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {unknown.games.length > 3 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-[11px] font-medium text-amber-300 hover:underline"
        >
          {open
            ? "Yığ"
            : `Daha ${unknown.games.length - 3} oyun göstər →`}
        </button>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "rose" | "violet" | "zinc";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "rose"
        ? "text-rose-300"
        : tone === "violet"
          ? "text-violet-300"
          : "text-zinc-200";
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-3 rounded-sm ${color}`} />
      <span>{label}</span>
    </span>
  );
}
