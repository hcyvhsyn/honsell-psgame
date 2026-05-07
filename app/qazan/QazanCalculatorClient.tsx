"use client";

import { useMemo, useState } from "react";

export default function QazanCalculatorClient({
  gamePct,
  streamingPct,
}: {
  gamePct: number;
  streamingPct: number;
}) {
  const [referralsPerMonth, setReferralsPerMonth] = useState(5);
  const [avgGameSpend, setAvgGameSpend] = useState(50); // AZN — orta oyun alışı
  const [avgStreamingSpend, setAvgStreamingSpend] = useState(15); // AZN — orta streaming
  const [purchasesPerReferral, setPurchasesPerReferral] = useState(2); // ayda neçə alış edir

  const monthly = useMemo(() => {
    // İdealdan sadələşmiş model: hər referee ayda X dəfə alış edir,
    // alışların yarısı oyun, yarısı streaming.
    const totalPurchases = referralsPerMonth * purchasesPerReferral;
    const gamePurchases = totalPurchases / 2;
    const streamingPurchases = totalPurchases / 2;
    // Oyunlarda komissiya — biz profit-in faizini veririk; sadəlik üçün
    // marka 20% qəbul edirik və o profitin gamePct-ini ödəyirik.
    // Yəni effektiv ≈ avgGameSpend * 0.2 * gamePct/100.
    const effectiveGameRate = (0.2 * gamePct) / 100;
    const gameEarn = gamePurchases * avgGameSpend * effectiveGameRate;
    const streamingEarn = streamingPurchases * avgStreamingSpend * (streamingPct / 100);
    return {
      perMonth: gameEarn + streamingEarn,
      perYear: (gameEarn + streamingEarn) * 12,
      gameEarn,
      streamingEarn,
    };
  }, [referralsPerMonth, purchasesPerReferral, avgGameSpend, avgStreamingSpend, gamePct, streamingPct]);

  return (
    <div className="grid gap-6 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-700/10 via-purple-700/5 to-zinc-950/40 p-5 backdrop-blur sm:p-7 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Slider
          label="Aylıq dəvət sayı"
          value={referralsPerMonth}
          onChange={setReferralsPerMonth}
          min={1}
          max={50}
          unit=""
        />
        <Slider
          label="Hər referee-nin ayda alış sayı"
          value={purchasesPerReferral}
          onChange={setPurchasesPerReferral}
          min={1}
          max={10}
          unit=""
        />
        <Slider
          label="Orta oyun alışı"
          value={avgGameSpend}
          onChange={setAvgGameSpend}
          min={10}
          max={300}
          step={5}
          unit="AZN"
        />
        <Slider
          label="Orta streaming alışı"
          value={avgStreamingSpend}
          onChange={setAvgStreamingSpend}
          min={5}
          max={100}
          step={1}
          unit="AZN"
        />
      </div>

      <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-zinc-950/40 p-5 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-300">Aylıq qazanc</p>
        <p className="mt-2 text-4xl font-black tabular-nums text-white sm:text-5xl">
          {monthly.perMonth.toFixed(2)}
        </p>
        <p className="text-sm font-medium text-zinc-400">AZN</p>
        <div className="mt-5 space-y-1 text-xs text-zinc-300">
          <p>
            <span className="text-zinc-500">Oyunlardan: </span>
            <span className="font-semibold text-white">{monthly.gameEarn.toFixed(2)} AZN</span>
          </p>
          <p>
            <span className="text-zinc-500">Streaming: </span>
            <span className="font-semibold text-white">{monthly.streamingEarn.toFixed(2)} AZN</span>
          </p>
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">İllik təxmin</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
            {monthly.perYear.toFixed(0)} AZN
          </p>
        </div>
        <p className="mt-4 text-[10px] leading-relaxed text-zinc-500">
          * Bu yalnız təxmindir. Faktiki qazanc seçilmiş məhsullara və admin tərəfindən
          təsdiqlənmiş sifarişlərin tarifi olan komissiya faizinə görə dəyişə bilər.
        </p>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="font-bold tabular-nums text-white">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-fuchsia-500"
      />
    </label>
  );
}
