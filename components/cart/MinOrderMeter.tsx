"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { MIN_ORDER_AZN, minOrderProgress } from "@/lib/cartLimits";

/**
 * Rəqəmi əvvəlki dəyərdən yenisinə yumşaq sayır (məhsul əlavə olunanda
 * "2.30 → 14.80" canlı görünsün). `prefers-reduced-motion`-da dərhal keçir.
 */
export function useCountUp(value: number, durationMs = 650, initial = value): number {
  const [shown, setShown] = useState(initial);
  const fromRef = useRef(initial);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    if (from === value) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return shown;
}

/** Zolaqdakı ara nişanlar (5/10/15 AZN kimi) — minimumun dörddə biri addımla. */
const TICKS = [0.25, 0.5, 0.75];

/**
 * Minimum sifariş sayğacı — "2.30 / 20 ₼" + proqres zolağı. `totalAzn` səbətin
 * PlayStation hissəsidir (`minOrderBaseCents`), ümumi cəm YOX — abunəliklər sayılmır.
 *
 * `variant="panel"` səbətin xülasə sütunu üçündür (dark), `variant="compact"`
 * səbətə-əlavə toast-u üçün (light/dark hər ikisi).
 */
export default function MinOrderMeter({
  totalAzn,
  fromAzn,
  variant = "panel",
}: {
  totalAzn: number;
  /** Mount anında bu dəyərdən başlayıb `totalAzn`-ə canlı keçir (toast üçün). */
  fromAzn?: number;
  variant?: "panel" | "compact";
}) {
  const progress = minOrderProgress(totalAzn);
  const startAzn = fromAzn ?? totalAzn;
  const shownTotal = useCountUp(progress.totalCents / 100, 650, startAzn);
  // Zolaq da mount-da başlanğıc nöqtədən hədəfə sürüşsün (CSS transition).
  const [barRatio, setBarRatio] = useState(() => minOrderProgress(startAzn).ratio);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setBarRatio(progress.ratio));
    return () => cancelAnimationFrame(raf);
  }, [progress.ratio]);
  const barPct = Math.round(barRatio * 100);
  const missingAzn = progress.missingCents / 100;
  const pct = Math.round(progress.ratio * 100);
  const reached = progress.reached;

  const compact = variant === "compact";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        reached
          ? `PlayStation minimumu keçildi: ${totalAzn.toFixed(2)} / ${MIN_ORDER_AZN} AZN`
          : `PlayStation minimumu: ${totalAzn.toFixed(2)} / ${MIN_ORDER_AZN} AZN, daha ${missingAzn.toFixed(2)} AZN lazımdır`
      }
      className={
        compact
          ? ""
          : `relative overflow-hidden rounded-2xl border p-4 transition-colors duration-500 ${
              reached
                ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                : "border-violet-500/25 bg-gradient-to-br from-violet-500/[0.08] via-zinc-950/40 to-fuchsia-500/[0.06]"
            }`
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${
              reached
                ? "text-emerald-600 dark:text-emerald-300"
                : compact
                  ? "text-violet-600 dark:text-violet-300"
                  : "text-violet-300"
            }`}
          >
            {reached ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            PlayStation minimumu
          </p>
          <p className="mt-1 flex items-baseline gap-1 tabular-nums">
            <span
              className={`font-black tracking-tight ${compact ? "text-2xl" : "text-3xl"} ${
                reached
                  ? "text-emerald-600 dark:text-emerald-300"
                  : compact
                    ? "text-zinc-950 dark:text-white"
                    : "text-white"
              }`}
            >
              {shownTotal.toFixed(2)}
            </span>
            <span
              className={`text-base font-bold ${
                compact ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500"
              }`}
            >
              / {MIN_ORDER_AZN} ₼
            </span>
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black tabular-nums ${
            reached
              ? "bg-emerald-500 text-white"
              : compact
                ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
                : "bg-violet-500/15 text-violet-200"
          }`}
        >
          {pct}%
        </span>
      </div>

      {/* Zolaq */}
      <div
        className={`relative mt-3 h-2.5 w-full rounded-full ${
          compact ? "bg-zinc-200 dark:bg-white/10" : "bg-white/10"
        }`}
      >
        {TICKS.map((t) => (
          <span
            key={t}
            aria-hidden
            className={`absolute top-1/2 h-1.5 w-px -translate-y-1/2 ${
              compact ? "bg-zinc-400/60 dark:bg-white/20" : "bg-white/20"
            }`}
            style={{ left: `${t * 100}%` }}
          />
        ))}
        <div
          className={`honsell-minorder-fill relative h-full rounded-full transition-[width] duration-700 ease-out ${
            reached
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : "bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-400"
          }`}
          style={{ width: `${Math.max(barRatio > 0 ? 4 : 0, barPct)}%` }}
        >
          {barRatio > 0 && !reached ? (
            <span
              aria-hidden
              className="absolute -right-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-fuchsia-500 shadow-[0_0_14px_rgba(217,70,239,0.9)]"
            />
          ) : null}
        </div>
      </div>

      <p
        className={`mt-2.5 text-xs leading-snug ${
          reached
            ? "text-emerald-700 dark:text-emerald-200/90"
            : compact
              ? "text-zinc-600 dark:text-zinc-400"
              : "text-zinc-400"
        }`}
      >
        {reached ? (
          "Minimum keçildi — sifarişə hazırsan."
        ) : (
          <>
            Daha{" "}
            <b className={compact ? "text-zinc-950 dark:text-white" : "text-white"}>
              {missingAzn.toFixed(2)} ₼
            </b>{" "}
            əlavə et, sifariş açılsın.
          </>
        )}
      </p>
    </div>
  );
}
