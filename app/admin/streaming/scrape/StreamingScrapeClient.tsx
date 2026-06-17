"use client";

import { useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Loader2,
  Film,
} from "lucide-react";

type Platform = "NETFLIX" | "HBOMAX" | "PRIME" | "GAIN";

const PLATFORM_LABEL: Record<Platform, string> = {
  NETFLIX: "Netflix",
  HBOMAX: "HBO Max",
  PRIME: "Prime Video",
  GAIN: "Gain",
};

type PlatformSummary = {
  status: "SUCCESS" | "FAILED";
  added: number;
  removed: number;
  updated: number;
  unchanged: number;
  scrapedCount: number;
  durationMs?: number;
  requestCount?: number;
  warnings: string[];
  error?: string;
};

type ProgressEvent =
  | { type: "start"; platforms: Platform[]; scrapeRunId: string }
  | { type: "platformStart"; platform: Platform }
  | { type: "platformDone"; platform: Platform; summary: PlatformSummary }
  | {
      type: "done";
      result: {
        scrapeRunId: string;
        status: "SUCCESS" | "PARTIAL" | "FAILED";
        totals: { added: number; removed: number; updated: number };
        perPlatform: Record<Platform, PlatformSummary>;
      };
    }
  | { type: "error"; error: string };

type PerPlatformState = Record<
  Platform,
  {
    state: "idle" | "running" | "done" | "failed";
    summary: PlatformSummary | null;
  }
>;

type RunState = {
  running: boolean;
  finished: boolean;
  selected: Set<Platform>;
  perPlatform: PerPlatformState;
  scrapeRunId: string | null;
  finalStatus: "SUCCESS" | "PARTIAL" | "FAILED" | null;
  totals: { added: number; removed: number; updated: number };
  error: string | null;
  log: string[];
};

type StatusResp = {
  lastRun: {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    scrapedCount: number;
    upsertedCount: number;
    error: string | null;
    summary: Record<string, PlatformSummary> | null;
  } | null;
  lastSuccess: { id: string; startedAt: string; finishedAt: string | null } | null;
  changes24h: { total: number; breakdown: Record<string, Record<string, number>> };
};

const ALL_PLATFORMS: Platform[] = ["NETFLIX", "HBOMAX", "PRIME", "GAIN"];
// Default seçim: Gain login arxasındadır və GAIN_COOKIE/GAIN_PROFILE_ID
// məcburi env-lər tələb edir. Hazır olduqda istifadəçi əl ilə pill-i klikləyər.
const DEFAULT_SELECTED: Platform[] = ["NETFLIX", "HBOMAX", "PRIME"];

function initialPerPlatform(): PerPlatformState {
  return {
    NETFLIX: { state: "idle", summary: null },
    HBOMAX: { state: "idle", summary: null },
    PRIME: { state: "idle", summary: null },
    GAIN: { state: "idle", summary: null },
  };
}

function initialState(): RunState {
  return {
    running: false,
    finished: false,
    selected: new Set(DEFAULT_SELECTED),
    perPlatform: initialPerPlatform(),
    scrapeRunId: null,
    finalStatus: null,
    totals: { added: 0, removed: 0, updated: 0 },
    error: null,
    log: [],
  };
}

export default function StreamingScrapeClient() {
  const [run, setRun] = useState<RunState>(initialState);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadStatus();
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function loadStatus() {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/scrape/status", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as StatusResp;
        setStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setStatusLoading(false);
    }
  }

  function togglePlatform(p: Platform) {
    setRun((s) => {
      const next = new Set(s.selected);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return { ...s, selected: next };
    });
  }

  async function triggerScrape() {
    if (run.running) return;
    if (run.selected.size === 0) return;

    setRun({
      ...initialState(),
      selected: run.selected,
      running: true,
    });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const platformsParam = [...run.selected].join(",");
    const url = `/api/scrape/stream?platforms=${platformsParam}`;

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let payload: ProgressEvent;
          try {
            payload = JSON.parse(json);
          } catch {
            continue;
          }
          applyEvent(payload);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stream failed";
      setRun((s) => ({ ...s, running: false, error: msg }));
    } finally {
      loadStatus();
    }
  }

  function applyEvent(p: ProgressEvent) {
    setRun((s) => {
      const next: RunState = {
        ...s,
        perPlatform: { ...s.perPlatform },
        log: [...s.log],
      };

      switch (p.type) {
        case "start":
          next.scrapeRunId = p.scrapeRunId;
          next.log.push(`Başladıldı: ${p.platforms.length} platforma`);
          break;
        case "platformStart":
          next.perPlatform[p.platform] = { state: "running", summary: null };
          next.log.push(`▶ ${PLATFORM_LABEL[p.platform]} işlənir…`);
          break;
        case "platformDone": {
          const state = p.summary.status === "SUCCESS" ? "done" : "failed";
          next.perPlatform[p.platform] = { state, summary: p.summary };
          if (state === "done") {
            next.log.push(
              `✓ ${PLATFORM_LABEL[p.platform]}: +${p.summary.added} / ~${p.summary.updated} / -${p.summary.removed} (${p.summary.scrapedCount} scrape)`
            );
          } else {
            next.log.push(
              `✗ ${PLATFORM_LABEL[p.platform]}: ${p.summary.error ?? "naməlum xəta"}`
            );
          }
          break;
        }
        case "done":
          next.running = false;
          next.finished = true;
          next.finalStatus = p.result.status;
          next.totals = p.result.totals;
          next.log.push(
            `✓ Tamamlandı: +${p.result.totals.added} əlavə, ~${p.result.totals.updated} dəyişib, -${p.result.totals.removed} silinib`
          );
          break;
        case "error":
          next.running = false;
          next.error = p.error;
          next.log.push(`✗ Sistem xətası: ${p.error}`);
          break;
      }
      next.log = next.log.slice(-50);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Run card */}
      <section className="rounded-xl border border-admin-line bg-admin-card p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Yeni yığım</h2>
            <p className="text-sm text-zinc-600">
              Seçilmiş platformaları sıra ilə işlət. Hər biri ~30sn-2dq çəkə bilər.
            </p>
          </div>
          <button
            type="button"
            onClick={triggerScrape}
            disabled={run.running || run.selected.size === 0}
            className="inline-flex items-center gap-2 rounded-md border border-admin-line2 bg-admin-card px-4 py-2 text-sm font-medium hover:bg-admin-chip2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${run.running ? "animate-spin" : ""}`} />
            {run.running ? "İşlənir…" : "Yığımı başlat"}
          </button>
        </header>

        {/* Platform selector */}
        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_PLATFORMS.map((p) => {
            const active = run.selected.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                disabled={run.running}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                  active
                    ? "border-violet-500 bg-violet-500/15 text-violet-700"
                    : "border-admin-line2 bg-admin-card text-zinc-700 hover:bg-admin-chip2"
                }`}
              >
                {PLATFORM_LABEL[p]}
              </button>
            );
          })}
        </div>

        {/* Per-platform progress cards */}
        {(run.running || run.finished || run.error) && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ALL_PLATFORMS.map((p) => (
                <PlatformCard
                  key={p}
                  platform={p}
                  selected={run.selected.has(p)}
                  data={run.perPlatform[p]}
                />
              ))}
            </div>

            {run.finished && (
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Əlavə" value={`+${run.totals.added}`} tone="emerald" />
                <Stat label="Dəyişib" value={`~${run.totals.updated}`} tone="amber" />
                <Stat label="Silinib" value={`-${run.totals.removed}`} tone="rose" />
              </div>
            )}

            {run.error && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                {run.error}
              </div>
            )}

            {run.log.length > 0 && (
              <details className="rounded-md border border-admin-line bg-admin-card">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-600">
                  Log ({run.log.length})
                </summary>
                <ul className="max-h-56 space-y-0.5 overflow-auto px-3 py-2 font-mono text-[11px] text-zinc-700">
                  {run.log.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Last run / 24h summary */}
      <section className="rounded-xl border border-admin-line bg-admin-card p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Son yığım və statistika</h2>
          <button
            type="button"
            onClick={loadStatus}
            className="text-xs text-zinc-600 hover:text-zinc-900"
          >
            Yenilə
          </button>
        </header>

        {statusLoading ? (
          <p className="text-sm text-zinc-600">Yüklənir…</p>
        ) : !status?.lastRun ? (
          <p className="text-sm text-zinc-600">
            <Film className="mr-2 inline h-4 w-4" /> Hələ heç bir streaming yığımı işə salınmayıb.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat
                label="Son status"
                value={status.lastRun.status}
                tone={
                  status.lastRun.status === "SUCCESS"
                    ? "emerald"
                    : status.lastRun.status === "PARTIAL"
                      ? "amber"
                      : "rose"
                }
              />
              <Stat label="Başlıq sayı" value={status.lastRun.scrapedCount.toLocaleString()} />
              <Stat
                label="Başladıldı"
                value={fmtRelative(status.lastRun.startedAt)}
              />
              <Stat
                label="Son 24 saat dəyişikliyi"
                value={status.changes24h.total.toLocaleString()}
              />
            </div>

            {status.lastRun.summary && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {ALL_PLATFORMS.map((p) => {
                  const sum = status.lastRun!.summary?.[p];
                  if (!sum) return null;
                  return (
                    <div
                      key={p}
                      className="rounded-md border border-admin-line bg-admin-card px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-900">{PLATFORM_LABEL[p]}</span>
                        <StatusPill status={sum.status} />
                      </div>
                      <div className="mt-1 text-zinc-600">
                        {sum.scrapedCount} başlıq · +{sum.added} / ~{sum.updated} / -{sum.removed}
                      </div>
                      {sum.error && (
                        <div className="mt-1 truncate text-rose-700" title={sum.error}>
                          {sum.error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function PlatformCard({
  platform,
  selected,
  data,
}: {
  platform: Platform;
  selected: boolean;
  data: { state: "idle" | "running" | "done" | "failed"; summary: PlatformSummary | null };
}) {
  const Icon =
    data.state === "running"
      ? Loader2
      : data.state === "done"
        ? CheckCircle2
        : data.state === "failed"
          ? XCircle
          : Clock;
  const iconClass =
    data.state === "running"
      ? "text-violet-700 animate-spin"
      : data.state === "done"
        ? "text-emerald-600"
        : data.state === "failed"
          ? "text-rose-600"
          : "text-zinc-500";

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        selected ? "border-admin-line2 bg-admin-card" : "border-admin-line bg-admin-card opacity-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-900">{PLATFORM_LABEL[platform]}</span>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>
      {data.summary ? (
        <div className="mt-1 text-[11px] text-zinc-600">
          {data.summary.scrapedCount} başlıq · +{data.summary.added} ~{data.summary.updated} -
          {data.summary.removed}
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-zinc-500">
          {!selected ? "skip" : data.state === "running" ? "çəkilir…" : "gözləyir"}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "rose"
          ? "text-rose-700"
          : "text-zinc-900";
  return (
    <div className="rounded-md border border-admin-line bg-admin-card px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "SUCCESS"
      ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30"
      : status === "PARTIAL"
        ? "bg-amber-500/15 text-amber-700 ring-amber-500/30"
        : "bg-rose-500/15 text-rose-700 ring-rose-500/30";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ${cls}`}>
      {status}
    </span>
  );
}

function fmtRelative(iso: string): string {
  const dt = new Date(iso);
  const diffMs = Date.now() - dt.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "indicə";
  if (min < 60) return `${min} dəq əvvəl`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} saat əvvəl`;
  const day = Math.round(hr / 24);
  return `${day} gün əvvəl`;
}
