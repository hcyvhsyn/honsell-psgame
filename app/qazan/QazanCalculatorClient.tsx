"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Brain,
  BriefcaseBusiness,
  ChevronDown,
  Gamepad2,
  Info,
  Layers3,
  Music2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Trophy,
  Tv,
  Users,
} from "lucide-react";
import type {
  ReferralCalculatorCategory,
  ReferralCalculatorOption,
} from "@/lib/referralCalculatorOptions";

type CalculatorRow = {
  id: string;
  category: ReferralCalculatorCategory;
  optionId: string;
  referralCount: number;
  monthlySpendAzn: number;
};

type ApiResponse = {
  options?: ReferralCalculatorOption[];
};

const PERIODS = [1, 3, 6, 12] as const;

const CATEGORY_STYLES: Record<
  ReferralCalculatorCategory,
  {
    shortLabel: string;
    icon: ComponentType<{ className?: string }>;
    chip: string;
    glow: string;
    bar: string;
  }
> = {
  STREAMING: {
    shortLabel: "Yayım Platformaları",
    icon: Tv,
    chip: "border-violet-400/20 bg-violet-500/10 text-violet-200",
    glow: "from-violet-500/20 to-indigo-500/10",
    bar: "from-violet-500 to-fuchsia-500",
  },
  MUSIC: {
    shortLabel: "Musiqi Platformaları",
    icon: Music2,
    chip: "border-pink-400/20 bg-pink-500/10 text-pink-200",
    glow: "from-pink-500/20 to-rose-500/10",
    bar: "from-pink-500 to-rose-400",
  },
  PLAYSTATION: {
    shortLabel: "PlayStation",
    icon: Gamepad2,
    chip: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    glow: "from-sky-500/20 to-blue-500/10",
    bar: "from-sky-400 to-blue-500",
  },
  AI: {
    shortLabel: "Süni İntellekt",
    icon: Brain,
    chip: "border-purple-400/20 bg-purple-500/10 text-purple-200",
    glow: "from-purple-500/20 to-violet-500/10",
    bar: "from-violet-500 to-indigo-500",
  },
  WORK: {
    shortLabel: "İş Platformaları",
    icon: BriefcaseBusiness,
    chip: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
    glow: "from-cyan-500/20 to-blue-500/10",
    bar: "from-cyan-400 to-sky-500",
  },
};

const DEFAULT_SPEND_BY_CATEGORY: Record<ReferralCalculatorCategory, number> = {
  PLAYSTATION: 15,
  STREAMING: 8,
  MUSIC: 6,
  AI: 20,
  WORK: 10,
};

const DEFAULT_REFERRALS = [25, 20, 10, 12, 8, 5];

function formatPct(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function uniqueCategories(options: ReferralCalculatorOption[]) {
  const seen = new Set<ReferralCalculatorCategory>();
  return options.filter((option) => {
    if (seen.has(option.category)) return false;
    seen.add(option.category);
    return true;
  });
}

function buildInitialRows(options: ReferralCalculatorOption[]): CalculatorRow[] {
  const streaming = options.filter((o) => o.category === "STREAMING").slice(0, 2);
  const preferred = [
    ...streaming,
    options.find((o) => o.category === "MUSIC"),
    options.find((o) => o.category === "PLAYSTATION"),
    options.find((o) => o.category === "AI"),
    options.find((o) => o.category === "WORK"),
  ].filter((option): option is ReferralCalculatorOption => Boolean(option));

  const source = preferred.length > 0 ? preferred : options.slice(0, 1);

  return source.map((option, index) => ({
    id: `row-${index}-${option.id}`,
    category: option.category,
    optionId: option.id,
    referralCount: DEFAULT_REFERRALS[index] ?? 10,
    monthlySpendAzn: DEFAULT_SPEND_BY_CATEGORY[option.category],
  }));
}

export default function QazanCalculatorClient({
  initialOptions,
}: {
  initialOptions: ReferralCalculatorOption[];
}) {
  const [options, setOptions] = useState(initialOptions);
  const [refreshing, setRefreshing] = useState(false);
  const [periodMonths, setPeriodMonths] = useState<(typeof PERIODS)[number]>(1);
  const [totalReferees, setTotalReferees] = useState(100);
  const [rows, setRows] = useState<CalculatorRow[]>(() => buildInitialRows(initialOptions));

  useEffect(() => {
    let alive = true;

    async function load() {
      setRefreshing(true);
      try {
        const res = await fetch("/api/qazan/calculator-options", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ApiResponse;
        if (alive && Array.isArray(data.options)) setOptions(data.options);
      } finally {
        if (alive) setRefreshing(false);
      }
    }

    const interval = window.setInterval(load, 15000);
    window.addEventListener("focus", load);

    return () => {
      alive = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
    };
  }, []);

  const categories = useMemo(() => uniqueCategories(options), [options]);

  const normalizedRows = useMemo(() => {
    return rows
      .map((row) => {
        const current = options.find((o) => o.id === row.optionId);
        if (current) return row;
        const fallback = options.find((o) => o.category === row.category) ?? options[0];
        return fallback ? { ...row, category: fallback.category, optionId: fallback.id } : null;
      })
      .filter((row): row is CalculatorRow => Boolean(row));
  }, [options, rows]);

  const totals = useMemo(() => {
    const breakdown = normalizedRows.map((row) => {
      const option = options.find((o) => o.id === row.optionId);
      const ratePct = option?.ratePct ?? 0;
      const monthly = row.referralCount * row.monthlySpendAzn * (ratePct / 100);
      return { row, option, monthly, period: monthly * periodMonths };
    });

    const monthly = breakdown.reduce((sum, item) => sum + item.monthly, 0);
    const period = monthly * periodMonths;
    const activeReferralCount = breakdown.reduce((sum, item) => sum + item.row.referralCount, 0);
    const activePlatformCount = new Set(breakdown.map((item) => item.row.optionId)).size;
    const top = [...breakdown].sort((a, b) => b.monthly - a.monthly)[0] ?? null;

    const byCategory = categories.map((categoryOption) => {
      const amount = breakdown
        .filter((item) => item.row.category === categoryOption.category)
        .reduce((sum, item) => sum + item.monthly, 0);
      return {
        category: categoryOption.category,
        label: categoryOption.categoryLabel,
        amount,
        pct: monthly > 0 ? (amount / monthly) * 100 : 0,
      };
    });

    return { breakdown, monthly, period, activeReferralCount, activePlatformCount, top, byCategory };
  }, [categories, normalizedRows, options, periodMonths]);

  function updateRow(rowId: string, patch: Partial<CalculatorRow>) {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const first = options[0];
    if (!first) return;
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        category: first.category,
        optionId: first.id,
        referralCount: Math.min(totalReferees, 10),
        monthlySpendAzn: DEFAULT_SPEND_BY_CATEGORY[first.category],
      },
    ]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  }

  if (options.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-700 bg-slate-950/50 p-12 text-center text-sm text-slate-500">
        Kalkulyator üçün aktiv platforma tapılmadı.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
      <section className="rounded-[22px] border border-violet-400/45 bg-slate-950/70 p-4 shadow-[0_24px_120px_-60px_rgba(124,58,237,0.85)] sm:p-6">
        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              Hesablama müddəti
              <Info className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setPeriodMonths(period)}
                  className={`h-12 rounded-lg border text-sm font-semibold transition ${
                    periodMonths === period
                      ? "border-violet-300/60 bg-violet-600 text-white shadow-[0_0_32px_-12px_rgba(124,58,237,0.95)]"
                      : "border-slate-700 bg-slate-900/75 text-slate-300 hover:border-violet-400/50"
                  }`}
                >
                  {period} ay
                </button>
              ))}
            </div>
          </div>

          <NumberInput
            label="Ümumi referal sayı"
            help="Gözlədiyiniz ümumi auditoriya və ya referal sayı."
            value={totalReferees}
            min={1}
            max={10000}
            step={1}
            onChange={setTotalReferees}
          />
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/55">
          <div className="hidden grid-cols-[58px_1.1fr_1.2fr_92px_118px_110px_130px_42px] gap-3 border-b border-slate-800 px-3 py-3 text-xs font-semibold text-slate-400 xl:grid">
            <span />
            <span>Kateqoriya</span>
            <span>Platforma</span>
            <span>Referal sayı</span>
            <span>Orta aylıq xərc</span>
            <span>Referal faizi</span>
            <span>Təxmini qazanc</span>
            <span />
          </div>

          <div className="divide-y divide-slate-800/80">
            {totals.breakdown.map(({ row, option, monthly }) => {
              const style = CATEGORY_STYLES[row.category];
              const Icon = style.icon;
              const rowOptions = options.filter((o) => o.category === row.category);

              return (
                <div
                  key={row.id}
                  className="grid gap-3 px-3 py-3 xl:grid-cols-[58px_1.1fr_1.2fr_92px_118px_110px_130px_42px] xl:items-center"
                >
                  <div
                    className={`grid h-10 w-14 place-items-center rounded-lg border bg-gradient-to-br ${style.chip} ${style.glow}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <SelectField
                    label="Kateqoriya"
                    value={row.category}
                    onChange={(value) => {
                      const category = value as ReferralCalculatorCategory;
                      const first = options.find((o) => o.category === category) ?? options[0];
                      updateRow(row.id, {
                        category,
                        optionId: first.id,
                        monthlySpendAzn: DEFAULT_SPEND_BY_CATEGORY[category],
                      });
                    }}
                    options={categories.map((categoryOption) => ({
                      value: categoryOption.category,
                      label: categoryOption.categoryLabel,
                    }))}
                  />

                  <SelectField
                    label="Platforma"
                    value={row.optionId}
                    onChange={(value) => updateRow(row.id, { optionId: value })}
                    options={rowOptions.map((platform) => ({
                      value: platform.id,
                      label: platform.platformLabel,
                    }))}
                  />

                  <CompactNumberInput
                    label="Referal sayı"
                    value={row.referralCount}
                    min={0}
                    max={100000}
                    onChange={(value) => updateRow(row.id, { referralCount: value })}
                  />

                  <CompactNumberInput
                    label="Orta aylıq xərc"
                    value={row.monthlySpendAzn}
                    min={0}
                    max={10000}
                    unit="AZN"
                    onChange={(value) => updateRow(row.id, { monthlySpendAzn: value })}
                  />

                  <div>
                    <p className="mb-1 text-xs text-slate-500 xl:hidden">Referal faizi</p>
                    <div className="flex h-10 items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-sm font-semibold text-white">
                      {formatPct(option?.ratePct ?? 0)}
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>

                  <div className="text-base font-bold tabular-nums text-emerald-300">
                    {formatMoney(monthly)} AZN
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={normalizedRows.length <= 1}
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Sətri sil"
                    title="Sətri sil"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,360px)_1fr]">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-lg border border-dashed border-violet-400/70 bg-violet-500/5 px-4 text-lg font-bold text-violet-200 transition hover:bg-violet-500/10"
          >
            <Plus className="h-5 w-5" /> Platforma əlavə et
          </button>
          <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-3 text-sm text-slate-300">
            <Info className="h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <p className="text-slate-400">Hesablama formulu</p>
              <p className="font-semibold text-white">
                Qazanc = referal sayı x orta aylıq xərc x referal faizi
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7">
          <p className="text-sm font-medium text-slate-300">
            Platforma seçmək üçün kateqoriyalar
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {categories.map((categoryOption) => {
              const style = CATEGORY_STYLES[categoryOption.category];
              const Icon = style.icon;
              const platforms = options.filter((o) => o.category === categoryOption.category);
              return (
                <div
                  key={categoryOption.category}
                  className="rounded-lg border border-slate-800 bg-slate-900/45 p-3"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg border ${style.chip}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {categoryOption.categoryLabel}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {platforms.slice(0, 4).map((platform) => (
                      <span
                        key={platform.id}
                        className="rounded-md bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300"
                      >
                        {platform.platformLabel}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="rounded-[22px] border border-slate-800 bg-slate-950/75 p-5 shadow-[0_24px_100px_-70px_rgba(59,130,246,0.75)] sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
          Canlı nəticə
          {refreshing && <RefreshCw className="ml-auto h-4 w-4 animate-spin text-violet-300" />}
        </div>

        <div className="relative overflow-hidden rounded-xl border border-violet-500/50 bg-gradient-to-br from-violet-950 via-slate-900 to-fuchsia-950 p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_22%,rgba(217,70,239,0.35),transparent_32%)]" />
          <p className="relative flex items-center gap-2 text-sm font-semibold text-violet-200">
            Aylıq qazanc <Info className="h-4 w-4 text-violet-400" />
          </p>
          <div className="relative mt-4 flex items-end justify-between gap-4">
            <p className="text-4xl font-black tabular-nums text-white sm:text-5xl">
              {formatMoney(totals.monthly)}
              <span className="ml-2 text-xl font-bold">AZN</span>
            </p>
            <MiniChart />
          </div>
          {periodMonths > 1 && (
            <p className="relative mt-3 text-xs text-violet-100/70">
              {periodMonths} ay üçün təxmin:{" "}
              <span className="font-bold text-white">{formatMoney(totals.period)} AZN</span>
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <MetricCard
            icon={<Trophy className="h-6 w-6 text-violet-300" />}
            label="Ən çox qazandıran"
            value={totals.top?.option?.platformLabel ?? "—"}
            sub={totals.top ? `${formatMoney(totals.top.monthly)} AZN` : ""}
          />
          <MetricCard
            icon={<Layers3 className="h-6 w-6 text-sky-300" />}
            label="Aktiv platforma sayı"
            value={String(totals.activePlatformCount)}
          />
          <MetricCard
            icon={<Users className="h-6 w-6 text-blue-300" />}
            label="Ümumi referal sayı"
            value={String(totals.activeReferralCount)}
          />
        </div>

        <div className="mt-6">
          <p className="font-semibold text-slate-200">Kateqoriyalar üzrə təxmini qazanc</p>
          <div className="mt-4 space-y-4">
            {totals.byCategory
              .filter((item) => item.amount > 0)
              .map((item) => {
                const style = CATEGORY_STYLES[item.category];
                return (
                  <div key={item.category}>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <span className="text-sm text-slate-400">{item.label}</span>
                      <span className="text-right text-sm font-bold text-white">
                        {formatMoney(item.amount)} AZN
                        <span className="block text-xs font-normal text-slate-400">
                          {item.pct.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${style.bar}`}
                        style={{ width: `${Math.max(4, Math.min(100, item.pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="mt-7 flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/65 p-4 text-sm text-slate-300">
          <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
          <p>
            Bu təxminidir. Real qazanc müştərilərin faktiki xərcləmə məbləğlərinə və
            referal faizlərinə görə dəyişə bilər. Faizlər 0-a endirilə, artırıla və ya
            azaldıla bilər.
          </p>
        </div>
      </aside>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500 xl:hidden">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900/80 px-3 pr-8 text-sm text-white outline-none transition focus:border-violet-400"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </span>
    </label>
  );
}

function NumberInput({
  label,
  help,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clampNumber(e.target.value, min, max))}
        className="mt-3 h-12 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 text-lg font-semibold text-white outline-none transition focus:border-violet-400"
      />
      {help && <span className="mt-2 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}

function CompactNumberInput({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500 xl:hidden">{label}</span>
      <span className="relative block">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clampNumber(e.target.value, min, max))}
          className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-sm font-semibold text-white outline-none transition focus:border-violet-400"
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
            {unit}
          </span>
        )}
      </span>
    </label>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
      <div className="mx-auto grid h-8 w-8 place-items-center">{icon}</div>
      <p className="mt-2 min-h-[32px] text-[11px] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function MiniChart() {
  return (
    <svg viewBox="0 0 190 80" className="h-20 w-44 shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="qazan-chart-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="60%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <filter id="qazan-chart-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polyline
        points="5,64 28,58 52,42 78,50 105,30 133,43 160,22 184,10"
        fill="none"
        stroke="url(#qazan-chart-line)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#qazan-chart-glow)"
      />
      {[52, 105, 160, 184].map((x, index) => {
        const y = [42, 30, 22, 10][index];
        return <circle key={x} cx={x} cy={y} r="3.5" fill="#f5d0fe" />;
      })}
    </svg>
  );
}

function clampNumber(raw: string, min: number, max: number) {
  const next = Number(raw);
  if (!Number.isFinite(next)) return min;
  return Math.max(min, Math.min(max, next));
}
