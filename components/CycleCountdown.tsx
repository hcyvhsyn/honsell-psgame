"use client";

import { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";

/**
 * Days/hours/minutes/seconds until the active cycle ends. The server passes
 * the absolute end time (ISO) so the countdown is timezone-stable across
 * clients and we never have to ship the user's clock to compute it.
 *
 * Hydration: never compute time on the server — `Date.now()` between SSR
 * and client mount differs by seconds and breaks the "san" cell. We render
 * dashes on the server pass and swap to live values on first effect tick.
 */
export default function CycleCountdown({ endsAt }: { endsAt: string }) {
  const target = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ready = now !== null;
  const remaining = ready ? Math.max(0, target - now) : 0;
  const days = ready ? Math.floor(remaining / 86_400_000) : null;
  const hours = ready ? Math.floor((remaining % 86_400_000) / 3_600_000) : null;
  const minutes = ready ? Math.floor((remaining % 3_600_000) / 60_000) : null;
  const seconds = ready ? Math.floor((remaining % 60_000) / 1_000) : null;

  return (
    <div className="mx-auto mt-6 inline-flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-amber-100 backdrop-blur">
      <Hourglass className="h-5 w-5 text-amber-300" />
      <div className="text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/80">
          Bu ayın bitməsinə
        </p>
        <p
          className="mt-0.5 font-mono text-base font-semibold tabular-nums sm:text-lg"
          suppressHydrationWarning
        >
          <Cell value={days} unit="g" />
          <Sep />
          <Cell value={hours} unit="s" />
          <Sep />
          <Cell value={minutes} unit="d" />
          <Sep />
          <Cell value={seconds} unit="san" />
        </p>
      </div>
    </div>
  );
}

function Cell({ value, unit }: { value: number | null; unit: string }) {
  return (
    <span>
      <span>{value === null ? "--" : String(value).padStart(2, "0")}</span>
      <span className="ml-0.5 text-xs font-medium text-amber-300/70">{unit}</span>
    </span>
  );
}

function Sep() {
  return <span className="mx-1.5 text-amber-300/40">·</span>;
}
