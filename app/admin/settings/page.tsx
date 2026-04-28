"use client";

import { useEffect, useRef, useState } from "react";
import {
  Save,
  RefreshCw,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
} from "lucide-react";

type Settings = {
  tryToAznRate: number;
  profitMarginPct: number;
  affiliateRatePct: number;
  depositCardNumber: string;
  depositCardHolder: string;
};

type ScrapeRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "RUNNING" | "SUCCESS" | "FAILED" | string;
  scrapedCount: number;
  upsertedCount: number;
  error: string | null;
};

type ScrapeState = {
  running: boolean;
  totalSources: number;
  sourcesDone: number;
  currentLabel: string;
  totalSoFar: number;
  upsertDone: number;
  upsertTotal: number;
  finished: boolean;
  scraped: number;
  upserts: number;
  error: string | null;
  log: string[];
};

const initialScrape: ScrapeState = {
  running: false,
  totalSources: 0,
  sourcesDone: 0,
  currentLabel: "",
  totalSoFar: 0,
  upsertDone: 0,
  upsertTotal: 0,
  finished: false,
  scraped: 0,
  upserts: 0,
  error: null,
  log: [],
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<Settings>({
    tryToAznRate: 0.053,
    profitMarginPct: 20,
    affiliateRatePct: 5,
    depositCardNumber: "",
    depositCardHolder: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const [scrape, setScrape] = useState<ScrapeState>(initialScrape);
  const [history, setHistory] = useState<ScrapeRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          tryToAznRate: data.tryToAznRate,
          profitMarginPct: data.profitMarginPct,
          affiliateRatePct: data.affiliateRatePct,
          depositCardNumber: data.depositCardNumber ?? "",
          depositCardHolder: data.depositCardHolder ?? "",
        });
      })
      .finally(() => setLoading(false));

    loadHistory();

    return () => {
      abortRef.current?.abort();
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/scrape-history", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.runs ?? []);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setSaveStatus("idle");
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveStatus("success");
        setMessage("Settings saved.");
      } else {
        setSaveStatus("error");
        setMessage(data.error ?? `Save failed (HTTP ${res.status}).`);
      }
    } catch (err) {
      setSaveStatus("error");
      setMessage(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
      messageTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
        setMessage(null);
      }, 3500);
    }
  }

  async function triggerScrape() {
    if (scrape.running) return;
    setScrape({ ...initialScrape, running: true });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/scrape-ps-store", { signal: ctrl.signal });
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
          let payload: any;
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
      setScrape((s) => ({
        ...s,
        running: false,
        error: msg,
      }));
    }
  }

  function applyEvent(p: any) {
    setScrape((s) => {
      const log = [...s.log];
      const next: ScrapeState = { ...s };

      switch (p.type) {
        case "start":
          next.totalSources = p.totalSources ?? 0;
          next.currentLabel = "Starting…";
          log.push(
            `Plan: ${p.categoryUrls?.length ?? 0} category hubs · ${p.seeds?.length ?? 0} search seeds (max ${p.maxPages} pages each)`
          );
          break;
        case "category":
          next.currentLabel = `Category ${p.sourceIndex + 1}/${
            (s.totalSources - (p.totalSources ?? 0)) || s.totalSources
          } · page ${p.page}`;
          next.totalSoFar = p.totalSoFar ?? s.totalSoFar;
          break;
        case "categoryDone":
          next.sourcesDone = (s.sourcesDone ?? 0) + 1;
          next.totalSoFar = p.totalSoFar ?? s.totalSoFar;
          log.push(
            `✓ Category ${p.sourceIndex + 1}: ${p.added} new (${p.pagesFetched} pages)`
          );
          break;
        case "seed":
          next.sourcesDone = (s.sourcesDone ?? 0) + 1;
          next.totalSoFar = p.totalSoFar ?? s.totalSoFar;
          next.currentLabel = `Search "${p.seed}"`;
          if (p.added > 0) {
            log.push(`+ "${p.seed}": ${p.added} new`);
          }
          break;
        case "upsertStart":
          next.upsertTotal = p.total ?? 0;
          next.upsertDone = 0;
          next.currentLabel = `Saving ${p.total} games to database…`;
          break;
        case "upsertProgress":
          next.upsertDone = p.done ?? 0;
          next.upsertTotal = p.total ?? next.upsertTotal;
          break;
        case "done":
          next.running = false;
          next.finished = true;
          next.scraped = p.scraped ?? 0;
          next.upserts = p.upserts ?? 0;
          next.currentLabel = "Done";
          log.push(`✓ Saved ${p.upserts} games to database.`);
          loadHistory();
          break;
        case "error":
          next.running = false;
          next.error = p.error ?? "Unknown error";
          loadHistory();
          break;
      }
      next.log = log.slice(-30);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="text-sm text-zinc-300">Loading settings…</div>
    );
  }

  const overallSourcesPct = scrape.totalSources
    ? Math.round((scrape.sourcesDone / scrape.totalSources) * 100)
    : 0;
  const upsertPct = scrape.upsertTotal
    ? Math.round((scrape.upsertDone / scrape.upsertTotal) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-indigo-400" />
        <h1 className="text-2xl font-semibold">Pricing Settings</h1>
      </header>

      <form
        onSubmit={save}
        className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
      >
        <Field
          label="TRY → AZN Exchange Rate"
          hint="Multiplier applied to scraped TRY prices (e.g. 0.053)."
          value={form.tryToAznRate}
          step={0.0001}
          onChange={(v) => setForm({ ...form, tryToAznRate: v })}
        />
        <Field
          label="Profit Margin (%)"
          hint="Added on top of the converted AZN price."
          value={form.profitMarginPct}
          step={0.5}
          onChange={(v) => setForm({ ...form, profitMarginPct: v })}
        />
        <Field
          label="Affiliate Commission (%)"
          hint="Referrer earns this % of every referred user's purchase."
          value={form.affiliateRatePct}
          step={0.5}
          onChange={(v) => setForm({ ...form, affiliateRatePct: v })}
        />

        <div className="space-y-3 border-t border-zinc-800 pt-5">
          <h2 className="text-sm font-semibold text-zinc-200">
            Deposit bank card
          </h2>
          <p className="text-xs text-zinc-500">
            Customers see this card on the wallet page and copy it before
            transferring funds. Leave blank to disable manual deposits.
          </p>
          <label className="block">
            <span className="text-sm font-medium text-zinc-200">Card number</span>
            <input
              type="text"
              value={form.depositCardNumber}
              onChange={(e) =>
                setForm({
                  ...form,
                  depositCardNumber: e.target.value
                    .replace(/\s+/g, "")
                    .slice(0, 19),
                })
              }
              placeholder="4169 7388 1234 5678"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono tracking-widest text-zinc-100 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-200">
              Cardholder name
            </span>
            <input
              type="text"
              value={form.depositCardHolder}
              onChange={(e) =>
                setForm({ ...form, depositCardHolder: e.target.value })
              }
              placeholder="HUSEYN HAJIYEV"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              saveStatus === "success"
                ? "bg-emerald-500 hover:bg-emerald-400"
                : saveStatus === "error"
                ? "bg-rose-500 hover:bg-rose-400"
                : "bg-indigo-500 hover:bg-indigo-400"
            }`}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : saveStatus === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : saveStatus === "error" ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving
              ? "Saving…"
              : saveStatus === "success"
              ? "Saved"
              : saveStatus === "error"
              ? "Failed"
              : "Save settings"}
          </button>

          {message && (
            <p
              className={`rounded-md px-3 py-2 text-sm ring-1 ${
                saveStatus === "success"
                  ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                  : saveStatus === "error"
                  ? "bg-rose-500/10 text-rose-300 ring-rose-500/30"
                  : "bg-zinc-800/60 text-zinc-200 ring-zinc-700"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </form>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">PS Store catalog scrape</h2>
            <p className="text-sm text-zinc-400">
              Pulls fresh games and prices from store.playstation.com.
            </p>
          </div>
          <button
            type="button"
            onClick={triggerScrape}
            disabled={scrape.running}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${scrape.running ? "animate-spin" : ""}`} />
            {scrape.running ? "Scraping…" : "Run PS Store scrape"}
          </button>
        </header>

        {(scrape.running || scrape.finished || scrape.error) && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Found so far" value={scrape.totalSoFar.toLocaleString()} />
              <Stat
                label="Sources done"
                value={`${scrape.sourcesDone} / ${scrape.totalSources || "—"}`}
              />
              <Stat
                label="Saving"
                value={
                  scrape.upsertTotal
                    ? `${scrape.upsertDone} / ${scrape.upsertTotal}`
                    : "—"
                }
              />
              <Stat
                label="Final"
                value={scrape.finished ? scrape.upserts.toLocaleString() : "—"}
              />
            </div>

            <Bar value={overallSourcesPct} label="Sources" />
            {scrape.upsertTotal > 0 && (
              <Bar value={upsertPct} label="Database" tint="emerald" />
            )}

            {scrape.currentLabel && !scrape.error && (
              <p className="text-sm text-zinc-400">
                <span className="text-zinc-500">Current: </span>
                {scrape.currentLabel}
              </p>
            )}

            {scrape.error && (
              <div className="flex items-start gap-2 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{scrape.error}</span>
              </div>
            )}

            {scrape.finished && !scrape.error && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-4 w-4" />
                Scrape complete · {scrape.upserts.toLocaleString()} games stored.
              </div>
            )}

            {scrape.log.length > 0 && (
              <details className="rounded-md border border-zinc-800 bg-zinc-950">
                <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-wider text-zinc-500">
                  Activity log ({scrape.log.length})
                </summary>
                <ul className="max-h-60 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                  {scrape.log.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <ScrapeHistory runs={history} loading={historyLoading} />
      </section>
    </div>
  );
}

function ScrapeHistory({
  runs,
  loading,
}: {
  runs: ScrapeRun[];
  loading: boolean;
}) {
  return (
    <div className="mt-6 border-t border-zinc-800 pt-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">
        Recent scrapes
      </h3>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading history…</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No scrapes recorded yet. Run one above to populate the catalog.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Games</th>
                <th className="px-3 py-2 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {runs.map((r) => (
                <ScrapeHistoryRow key={r.id} run={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScrapeHistoryRow({ run }: { run: ScrapeRun }) {
  const started = new Date(run.startedAt);
  const finished = run.finishedAt ? new Date(run.finishedAt) : null;
  const durationMs = finished ? finished.getTime() - started.getTime() : null;

  return (
    <tr className="text-zinc-300">
      <td className="px-3 py-2 align-top">
        <div className="text-zinc-100">{formatDateTime(started)}</div>
        <div className="text-[11px] text-zinc-500">{relative(started)}</div>
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge status={run.status} />
        {run.error && (
          <div
            className="mt-1 max-w-xs truncate text-[11px] text-rose-400"
            title={run.error}
          >
            {run.error}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top tabular-nums">
        {run.upsertedCount.toLocaleString()}
        {run.scrapedCount > 0 && run.scrapedCount !== run.upsertedCount && (
          <span className="ml-1 text-[11px] text-zinc-500">
            / {run.scrapedCount.toLocaleString()}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top text-zinc-400 tabular-nums">
        {durationMs != null ? formatDuration(durationMs) : "—"}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-3 w-3" />
        Success
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300 ring-1 ring-rose-500/30">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/30">
      <Clock className="h-3 w-3" />
      Running
    </span>
  );
}

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function Bar({
  value,
  label,
  tint = "indigo",
}: {
  value: number;
  label: string;
  tint?: "indigo" | "emerald";
}) {
  const fill = tint === "emerald" ? "bg-emerald-500" : "bg-indigo-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`${fill} h-full transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-200">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-indigo-500 focus:outline-none"
      />
      <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
    </label>
  );
}
