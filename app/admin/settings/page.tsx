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
  profitMarginGamesPct: number;
  profitMarginGiftCardsPct: number;
  profitMarginPsPlusPct: number;
  usdToAznRate: number;
  epicPositionPct: number;
  epicMinProfitPct: number;
  // Sabit dəvət bonusu — admin AZN ilə daxil edir, API-yə qəpik göndərilir.
  referralInviteBonusAzn: number;
  sponsoredReferralInviteBonusAzn: number;
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

type ScrapeEvent = {
  type: string;
  totalSources?: number;
  categoryUrls?: unknown[];
  seeds?: unknown[];
  maxPages?: number;
  sourceIndex?: number;
  page?: number;
  totalSoFar?: number;
  added?: number;
  pagesFetched?: number;
  seed?: string;
  total?: number;
  done?: number;
  scraped?: number;
  upserts?: number;
  error?: string;
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

type EpicScrapeState = {
  running: boolean;
  finished: boolean;
  error: string | null;
  currentLabel: string;
  trFetched: number;
  azFetched: number;
  upsertDone: number;
  upsertTotal: number;
  upserts: number;
  skipped: number;
  log: string[];
};

type EpicScrapeEvent = {
  type: string;
  region?: "TR" | "AZ";
  currency?: string;
  page?: number;
  fetched?: number;
  total?: number;
  count?: number;
  done?: number;
  failures?: number;
  skippedNoTry?: number;
  expired?: number;
  orphaned?: number;
  scraped?: number;
  upserts?: number;
  error?: string;
};

const initialEpicScrape: EpicScrapeState = {
  running: false,
  finished: false,
  error: null,
  currentLabel: "",
  trFetched: 0,
  azFetched: 0,
  upsertDone: 0,
  upsertTotal: 0,
  upserts: 0,
  skipped: 0,
  log: [],
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<Settings>({
    tryToAznRate: 0.053,
    profitMarginPct: 20,
    profitMarginGamesPct: 20,
    profitMarginGiftCardsPct: 20,
    profitMarginPsPlusPct: 20,
    usdToAznRate: 1.7,
    epicPositionPct: 50,
    epicMinProfitPct: 10,
    referralInviteBonusAzn: 0.3,
    sponsoredReferralInviteBonusAzn: 0.3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const [scrape, setScrape] = useState<ScrapeState>(initialScrape);
  const [epicScrape, setEpicScrape] = useState<EpicScrapeState>(initialEpicScrape);
  const epicAbortRef = useRef<AbortController | null>(null);
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
          profitMarginGamesPct: data.profitMarginGamesPct ?? data.profitMarginPct,
          profitMarginGiftCardsPct: data.profitMarginGiftCardsPct ?? data.profitMarginPct,
          profitMarginPsPlusPct: data.profitMarginPsPlusPct ?? data.profitMarginPct,
          usdToAznRate: data.usdToAznRate ?? 1.7,
          epicPositionPct: data.epicPositionPct ?? 50,
          epicMinProfitPct: data.epicMinProfitPct ?? 10,
          referralInviteBonusAzn: (data.referralInviteBonusCents ?? 30) / 100,
          sponsoredReferralInviteBonusAzn:
            (data.sponsoredReferralInviteBonusCents ?? 30) / 100,
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
      const payload = {
        ...form,
        // AZN → qəpik çevrilməsi (sabit dəvət bonusu API-də qəpiklə saxlanır).
        referralInviteBonusCents: Math.round(form.referralInviteBonusAzn * 100),
        sponsoredReferralInviteBonusCents: Math.round(
          form.sponsoredReferralInviteBonusAzn * 100
        ),
      };
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveStatus("success");
        setMessage("Tənzimləmələr yadda saxlanıldı.");
      } else {
        setSaveStatus("error");
        setMessage(data.error ?? `Yadda saxlama alınmadı (HTTP ${res.status}).`);
      }
    } catch (err) {
      setSaveStatus("error");
      setMessage(err instanceof Error ? err.message : "Yadda saxlama alınmadı.");
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
          let payload: ScrapeEvent;
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

  function applyEvent(p: ScrapeEvent) {
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
          next.currentLabel = `Category ${(p.sourceIndex ?? 0) + 1}/${
            (s.totalSources - (p.totalSources ?? 0)) || s.totalSources
          } · page ${p.page}`;
          next.totalSoFar = p.totalSoFar ?? s.totalSoFar;
          break;
        case "categoryDone":
          next.sourcesDone = (s.sourcesDone ?? 0) + 1;
          next.totalSoFar = p.totalSoFar ?? s.totalSoFar;
          log.push(
            `✓ Category ${(p.sourceIndex ?? 0) + 1}: ${p.added} new (${p.pagesFetched} pages)`
          );
          break;
        case "seed":
          next.sourcesDone = (s.sourcesDone ?? 0) + 1;
          next.totalSoFar = p.totalSoFar ?? s.totalSoFar;
          next.currentLabel = `Search "${p.seed}"`;
          if ((p.added ?? 0) > 0) {
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

  async function triggerEpicScrape() {
    if (epicScrape.running) return;
    setEpicScrape({ ...initialEpicScrape, running: true });

    const ctrl = new AbortController();
    epicAbortRef.current = ctrl;

    try {
      const res = await fetch("/api/admin/scrape-epic", { signal: ctrl.signal });
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
          let payload: EpicScrapeEvent;
          try {
            payload = JSON.parse(json);
          } catch {
            continue;
          }
          applyEpicEvent(payload);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stream failed";
      setEpicScrape((s) => ({ ...s, running: false, error: msg }));
    }
  }

  function applyEpicEvent(p: EpicScrapeEvent) {
    setEpicScrape((s) => {
      const log = [...s.log];
      const next: EpicScrapeState = { ...s };

      switch (p.type) {
        case "start":
          next.currentLabel = "Başlanır…";
          log.push("Epic kataloqu yığılır (TR + AZ).");
          break;
        case "regionStart":
          next.currentLabel = `${p.region} (${p.currency}) çəkilir…`;
          break;
        case "regionPage":
          if (p.region === "TR") next.trFetched = p.fetched ?? s.trFetched;
          else next.azFetched = p.fetched ?? s.azFetched;
          next.currentLabel = `${p.region} · səhifə ${p.page} (${p.fetched ?? 0}/${p.total ?? "—"})`;
          break;
        case "regionDone":
          log.push(`✓ ${p.region}: ${p.count} məhsul.`);
          break;
        case "upsertStart":
          next.upsertTotal = p.total ?? 0;
          next.upsertDone = 0;
          next.skipped = p.skippedNoTry ?? 0;
          next.currentLabel = `${p.total} oyun bazaya yazılır…`;
          break;
        case "upsertProgress":
          next.upsertDone = p.done ?? 0;
          next.upsertTotal = p.total ?? next.upsertTotal;
          break;
        case "discountCleanup":
          log.push(`Endirim təmizliyi: ${p.expired ?? 0} bitmiş, ${p.orphaned ?? 0} köhnə.`);
          break;
        case "done":
          next.running = false;
          next.finished = true;
          next.upserts = p.upserts ?? 0;
          next.skipped = p.skippedNoTry ?? next.skipped;
          next.currentLabel = "Tamamlandı";
          log.push(`✓ ${p.upserts} oyun yadda saxlandı${p.skippedNoTry ? ` · ${p.skippedNoTry} ötürüldü (TRY yox)` : ""}.`);
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
      <div className="text-sm text-zinc-700">Tənzimləmələr yüklənir…</div>
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
        <SettingsIcon className="h-6 w-6 text-violet-600" />
        <h1 className="text-2xl font-semibold">Tənzimləmələr</h1>
      </header>

      <form
        onSubmit={save}
        className="space-y-6 rounded-xl border border-admin-line bg-admin-card p-6"
      >
        <Field
          label="TRY → AZN məzənnəsi"
          hint="Scrape edilmiş TRY qiymətlərinə tətbiq olunan əmsal (məs: 0.053)."
          value={form.tryToAznRate}
          step={0.0001}
          onChange={(v) => setForm({ ...form, tryToAznRate: v })}
        />
        <Field
          label="Mənfəət marjası (köhnə, %)"
          hint="Yalnız geri-uyğunluq üçün. Aşağıdakı kateqoriya üzrə marjadan istifadə edin."
          value={form.profitMarginPct}
          step={0.5}
          onChange={(v) => setForm({ ...form, profitMarginPct: v })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Oyunlar üçün mənfəət (%)"
            hint="TRY→AZN çevrilməsində oyunlara tətbiq olunur."
            value={form.profitMarginGamesPct}
            step={0.5}
            onChange={(v) => setForm({ ...form, profitMarginGamesPct: v })}
          />
          <Field
            label="Hədiyyə kartları üçün mənfəət (%)"
            hint="TRY hədiyyə kartlarına tətbiq olunur."
            value={form.profitMarginGiftCardsPct}
            step={0.5}
            onChange={(v) => setForm({ ...form, profitMarginGiftCardsPct: v })}
          />
          <Field
            label="PS Plus üçün mənfəət (%)"
            hint="PS Plus TRY əsaslı qiymətləndirmədə tətbiq olunur."
            value={form.profitMarginPsPlusPct}
            step={0.5}
            onChange={(v) => setForm({ ...form, profitMarginPsPlusPct: v })}
          />
        </div>

        <div className="space-y-4 rounded-lg border border-admin-line bg-admin-card p-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">
              Epic Games qiymətləndirməsi
            </h3>
            <p className="text-xs text-zinc-500">
              Epic-də qiymət faizlə yox, Türkiyə (maya) ilə Azərbaycan (referans)
              qiyməti arasında mövqe ilə təyin olunur. Döşəmə referal komissiyasını
              və minimal mənfəəti qoruyur.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="USD → AZN məzənnəsi"
              hint="Epic Azərbaycan (USD) qiymətini AZN-ə çevirir (məs: 1.7)."
              value={form.usdToAznRate}
              step={0.01}
              onChange={(v) => setForm({ ...form, usdToAznRate: v })}
            />
            <Field
              label="Qiymət mövqeyi (%)"
              hint="0 = maya (TR), 100 = referans (AZ), 50 = orta nöqtə."
              value={form.epicPositionPct}
              step={1}
              onChange={(v) => setForm({ ...form, epicPositionPct: v })}
            />
            <Field
              label="Minimal mənfəət buferi (%)"
              hint="Döşəmə: qiymət heç vaxt maya + referal + bu buferdən aşağı düşmür."
              value={form.epicMinProfitPct}
              step={0.5}
              onChange={(v) => setForm({ ...form, epicMinProfitPct: v })}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-admin-line bg-admin-card p-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">
              Dəvət bonusu (sabit)
            </h3>
            <p className="text-xs text-zinc-500">
              Dəvət olunan istifadəçi nömrəsini təsdiqlədikdə dəvət edənin referal
              balansına yazılan sabit məbləğ. Faiz komissiyasından ayrıdır. 0 yazsanız
              həmin müştəri tipində dəvət bonusu bağlanır. Şübhəli dəvətlər (təkrar/cəfəng
              ad, eyni IP) avtomatik &ldquo;Dəvət bonusları&rdquo; bölməsində yoxlamaya düşür.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Adi müştəri (AZN)"
              hint="Standart dəvət edən üçün bonus (məs: 0.30)."
              value={form.referralInviteBonusAzn}
              step={0.05}
              onChange={(v) => setForm({ ...form, referralInviteBonusAzn: v })}
            />
            <Field
              label="Sponsorlu müştəri (AZN)"
              hint="&ldquo;Sponsorlu&rdquo; seqmentdəki dəvət edən üçün bonus."
              value={form.sponsoredReferralInviteBonusAzn}
              step={0.05}
              onChange={(v) =>
                setForm({ ...form, sponsoredReferralInviteBonusAzn: v })
              }
            />
          </div>
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
                : "bg-violet-600 hover:bg-violet-500"
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
              ? "Yadda saxlanılır…"
              : saveStatus === "success"
              ? "Yadda saxlanıldı"
              : saveStatus === "error"
              ? "Alınmadı"
              : "Tənzimləmələri yadda saxla"}
          </button>

          {message && (
            <p
              className={`rounded-md px-3 py-2 text-sm ring-1 ${
                saveStatus === "success"
                  ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30"
                  : saveStatus === "error"
                  ? "bg-rose-500/10 text-rose-700 ring-rose-500/30"
                  : "bg-admin-chip text-zinc-800 ring-admin-line2"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </form>

      <section className="rounded-xl border border-admin-line bg-admin-card p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">PS Store kataloq yığımı</h2>
            <p className="text-sm text-zinc-600">
              store.playstation.com saytından oyun və qiymətləri yeniləyir.
            </p>
          </div>
          <button
            type="button"
            onClick={triggerScrape}
            disabled={scrape.running}
            className="inline-flex items-center gap-2 rounded-md border border-admin-line2 bg-admin-card px-4 py-2 text-sm font-medium hover:bg-admin-chip2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${scrape.running ? "animate-spin" : ""}`} />
            {scrape.running ? "Yığılır…" : "PS Store yığımını başlat"}
          </button>
        </header>

        {(scrape.running || scrape.finished || scrape.error) && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="İndiyə qədər tapılan" value={scrape.totalSoFar.toLocaleString()} />
              <Stat
                label="Tamamlanan mənbələr"
                value={`${scrape.sourcesDone} / ${scrape.totalSources || "—"}`}
              />
              <Stat
                label="Yadda saxlanılır"
                value={
                  scrape.upsertTotal
                    ? `${scrape.upsertDone} / ${scrape.upsertTotal}`
                    : "—"
                }
              />
              <Stat
                label="Son nəticə"
                value={scrape.finished ? scrape.upserts.toLocaleString() : "—"}
              />
            </div>

            <Bar value={overallSourcesPct} label="Mənbələr" />
            {scrape.upsertTotal > 0 && (
              <Bar value={upsertPct} label="Verilənlər bazası" tint="emerald" />
            )}

            {scrape.currentLabel && !scrape.error && (
              <p className="text-sm text-zinc-600">
                <span className="text-zinc-500">Hazırda: </span>
                {scrape.currentLabel}
              </p>
            )}

            {scrape.error && (
              <div className="flex items-start gap-2 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-500/30">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{scrape.error}</span>
              </div>
            )}

            {scrape.finished && !scrape.error && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-4 w-4" />
                Yığım tamamlandı · {scrape.upserts.toLocaleString()} oyun yadda saxlandı.
              </div>
            )}

            {scrape.log.length > 0 && (
              <details className="rounded-md border border-admin-line bg-admin-card">
                <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-wider text-zinc-500">
                  Fəaliyyət jurnalı ({scrape.log.length})
                </summary>
                <ul className="max-h-60 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-zinc-600">
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

      <section className="rounded-xl border border-admin-line bg-admin-card p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Epic Games kataloq yığımı</h2>
            <p className="text-sm text-zinc-600">
              store.epicgames.com saytından oyunları çəkir — TR (TRY) və AZ (USD)
              qiymətləri ilə.
            </p>
          </div>
          <button
            type="button"
            onClick={triggerEpicScrape}
            disabled={epicScrape.running}
            className="inline-flex items-center gap-2 rounded-md border border-admin-line2 bg-admin-card px-4 py-2 text-sm font-medium hover:bg-admin-chip2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${epicScrape.running ? "animate-spin" : ""}`} />
            {epicScrape.running ? "Yığılır…" : "Epic yığımını başlat"}
          </button>
        </header>

        {(epicScrape.running || epicScrape.finished || epicScrape.error) && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="TR (TRY) tapılan" value={epicScrape.trFetched.toLocaleString()} />
              <Stat label="AZ (USD) tapılan" value={epicScrape.azFetched.toLocaleString()} />
              <Stat
                label="Yadda saxlanılır"
                value={
                  epicScrape.upsertTotal
                    ? `${epicScrape.upsertDone} / ${epicScrape.upsertTotal}`
                    : "—"
                }
              />
              <Stat
                label="Son nəticə"
                value={epicScrape.finished ? epicScrape.upserts.toLocaleString() : "—"}
              />
            </div>

            {epicScrape.upsertTotal > 0 && (
              <Bar
                value={Math.round((epicScrape.upsertDone / epicScrape.upsertTotal) * 100)}
                label="Verilənlər bazası"
                tint="emerald"
              />
            )}

            {epicScrape.currentLabel && !epicScrape.error && (
              <p className="text-sm text-zinc-600">
                <span className="text-zinc-500">Hazırda: </span>
                {epicScrape.currentLabel}
              </p>
            )}

            {epicScrape.error && (
              <div className="flex items-start gap-2 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-500/30">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{epicScrape.error}</span>
              </div>
            )}

            {epicScrape.finished && !epicScrape.error && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-4 w-4" />
                Yığım tamamlandı · {epicScrape.upserts.toLocaleString()} oyun yadda saxlandı
                {epicScrape.skipped > 0 ? ` · ${epicScrape.skipped} ötürüldü (TRY qiyməti yox)` : ""}.
              </div>
            )}

            {epicScrape.log.length > 0 && (
              <details className="rounded-md border border-admin-line bg-admin-card">
                <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-wider text-zinc-500">
                  Fəaliyyət jurnalı ({epicScrape.log.length})
                </summary>
                <ul className="max-h-60 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-zinc-600">
                  {epicScrape.log.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
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
    <div className="mt-6 border-t border-admin-line pt-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-800">
        Son yığımlar
      </h3>

      {loading ? (
        <p className="text-sm text-zinc-500">Tarixçə yüklənir…</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Hələ yığım qeydi yoxdur. Kataloqu doldurmaq üçün yuxarıdakı düyməni basın.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-admin-line">
          <table className="w-full text-sm">
            <thead className="bg-admin-card text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Vaxt</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Oyunlar</th>
                <th className="px-3 py-2 font-medium text-right">Müddət</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
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
    <tr className="text-zinc-700">
      <td className="px-3 py-2 align-top">
        <div className="text-zinc-900">{formatDateTime(started)}</div>
        <div className="text-[11px] text-zinc-500">{relative(started)}</div>
      </td>
      <td className="px-3 py-2 align-top">
        <StatusBadge status={run.status} />
        {run.error && (
          <div
            className="mt-1 max-w-xs truncate text-[11px] text-rose-600"
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
      <td className="px-3 py-2 text-right align-top text-zinc-600 tabular-nums">
        {durationMs != null ? formatDuration(durationMs) : "—"}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-3 w-3" />
        Uğurlu
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-500/30">
        <XCircle className="h-3 w-3" />
        Alınmadı
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-500/30">
      <Clock className="h-3 w-3" />
      İşləyir
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
  if (sec < 60) return `${sec}s əvvəl`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}d əvvəl`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}saat əvvəl`;
  const day = Math.round(hr / 24);
  return `${day} gün əvvəl`;
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
    <div className="rounded-md border border-admin-line bg-admin-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
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
  const fill = tint === "emerald" ? "bg-emerald-500" : "bg-violet-600";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-admin-chip">
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
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-admin-line2 bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
      />
      <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
    </label>
  );
}
