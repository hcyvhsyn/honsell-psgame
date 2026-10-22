"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Film, Loader2, Play, RefreshCw, Square, Tv, UploadCloud, XCircle } from "lucide-react";

type JobKind = "catalog" | "validate" | "project" | "publish";

interface Job {
  id: string;
  request: { kind: JobKind; limit?: number; thenProject?: boolean; onlyMissing?: boolean };
  steps: string[];
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  stoppedByAdmin?: boolean;
  running: boolean;
}

interface Run {
  id: string;
  kind: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  scrapedCount: number;
  upsertedCount: number;
  error: string | null;
}

interface StatusResponse {
  enabled: boolean;
  region?: string;
  dailyLimit?: number;
  job?: Job | null;
  log?: string;
  external?: { kind: string; startedAt: string } | null;
  publish?: { configured: boolean; last: { url: string; at: string } | null };
  stats?: {
    titles: { series: number; movies: number };
    detailed: { series: number; movies: number };
    episodes: number;
    queue: Record<string, number>;
    used24h: number;
    storefront: number;
    runs: Run[];
  };
}

const JOBS: Array<{ kind: JobKind; title: string; desc: string; limitLabel?: string; canProject: boolean }> = [
  {
    kind: "catalog",
    title: "Kataloq sync",
    desc: "A–Z kataloqunu kəşf edir, hər serial/filmin sezon, epizod və metadata-sını çəkir. Player açılmır. Tam run ~2 saat.",
    limitLabel: "Yalnız ilk N başlıq (boş = hamısı)",
    canProject: true,
  },
  {
    kind: "validate",
    title: "AZ player validasiyası",
    desc: "Növbədəki epizod/filmləri AZ player-də açıb real dublyaj və altyazı dillərini oxuyur. Gündəlik limitə tabedir.",
    limitLabel: "Bu run üçün tavan (boş = gündəlik limitə qədər)",
    canProject: true,
  },
  {
    kind: "project",
    title: "Vitrinə proyeksiya",
    desc: "Sync olunmuş başlıqları kataloqa çıxarır və yoxlanmış dilləri yeniləyir. Bir neçə dəqiqə.",
    canProject: false,
  },
];

const JOB_LABEL: Record<JobKind, string> = {
  catalog: "Kataloq sync",
  validate: "AZ player validasiyası",
  project: "Vitrinə proyeksiya",
  publish: "Prod-a göndər",
};
const RUN_LABEL: Record<string, string> = { HBOMAX_CATALOG: "Kataloq sync", HBOMAX_VALIDATE: "Validasiya" };

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("az", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function duration(from: string, to?: string | null) {
  const ms = (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime();
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} saat ${m % 60} dəq` : `${m} dəq`;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-admin-line bg-admin-card p-4">
      <p className="text-xs font-medium text-zinc-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-600">{sub}</p> : null}
    </div>
  );
}

function JobCard({
  job,
  busy,
  onStart,
}: {
  job: (typeof JOBS)[number];
  busy: boolean;
  onStart: (kind: JobKind, limit: string, thenProject: boolean, onlyMissing: boolean) => void;
}) {
  const [limit, setLimit] = useState("");
  const [thenProject, setThenProject] = useState(true);
  const [onlyMissing, setOnlyMissing] = useState(false);
  return (
    <div className="flex flex-col rounded-xl border border-admin-line bg-admin-card p-5">
      <h3 className="font-semibold">{job.title}</h3>
      <p className="mt-1 flex-1 text-sm text-zinc-600">{job.desc}</p>
      {job.limitLabel ? (
        <label className="mt-4 block text-xs font-medium text-zinc-600">
          {job.limitLabel}
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="hamısı"
            className="mt-1 w-full rounded-md border border-admin-line2 bg-admin-card px-3 py-2 text-sm"
          />
        </label>
      ) : null}
      {job.kind === "catalog" ? (
        <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-zinc-600">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          yalnız metadata-sı çəkilməyənlər (yarımçıq run-un davamı)
        </label>
      ) : null}
      {job.canProject ? (
        <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-zinc-600">
          <input type="checkbox" checked={thenProject} onChange={(e) => setThenProject(e.target.checked)} />
          bitəndən sonra vitrinə proyeksiya et
        </label>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => onStart(job.kind, limit, thenProject, onlyMissing)}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-4 w-4" /> Başlat
      </button>
    </div>
  );
}

export default function HbomaxAdminClient() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/hbomax", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "İcazə yoxdur" : `HTTP ${r.status}`);
      setData((await r.json()) as StatusResponse);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const running = !!data?.job?.running;
  useEffect(() => {
    load();
    const t = setInterval(load, running ? 3000 : 15000);
    return () => clearInterval(t);
  }, [load, running]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [data?.log]);

  async function post(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/hbomax", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; detail?: string };
      if (r.status === 409 && j.error === "external_running") {
        const ok = window.confirm(
          "Terminaldan başladılmış HBO Max işi hələ gedir (və ya düzgün bağlanmayıb). Eyni brauzer profilini iki proses işlədə bilməz.\n\nƏminsənsə ki, o iş artıq dayanıb, yenə də başladılsın?"
        );
        if (ok) return post({ ...body, force: true });
        return;
      }
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-600">
        {error ? error : (<><Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…</>)}
      </div>
    );
  }

  if (!data.enabled) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> Bu, prod serverdir — kollektor burada işləmir
        </p>
        <p className="mt-2">
          HBO Max kollektoru Azərbaycan IP-si, HBO-ya giriş edilmiş Chrome profili və lokal kollektor DB-si tələb edir,
          ona görə Mac-də işləyir. Prod sayt datanı Mac-dən alır: Mac-də
          <code className="mx-1 rounded bg-amber-100 px-1">npm run dev:hbomax</code>
          ilə <code className="mx-1 rounded bg-amber-100 px-1">localhost:3000/admin/streaming/hbomax</code> aç → sync /
          validasiya → <b>Prod-a göndər</b>.
        </p>
      </div>
    );
  }

  const s = data.stats!;
  const job = data.job;
  const q = s.queue;
  const verified = q.VERIFIED ?? 0;
  const queueTotal = Object.values(q).reduce((a, b) => a + b, 0);
  const waiting = (q.PENDING ?? 0) + (q.STALE ?? 0) + (q.FAILED ?? 0);
  const daysLeft = data.dailyLimit ? Math.ceil(waiting / data.dailyLimit) : 0;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          <XCircle className="h-4 w-4" /> {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Seriallar (AZ)" value={s.titles.series} sub={`${s.detailed.series} metadata çəkilib`} />
        <Stat label="Filmlər (AZ)" value={s.titles.movies} sub={`${s.detailed.movies} metadata çəkilib`} />
        <Stat label="Dili yoxlanmış" value={`${verified} / ${queueTotal}`} sub={`gözləyən ${waiting}${waiting ? ` · ~${daysLeft} gün` : ""}`} />
        <Stat label="Son 24 saat validasiya" value={`${s.used24h} / ${data.dailyLimit}`} sub={`vitrində ${s.storefront} başlıq`} />
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {job?.running ? (
              <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
            ) : job?.exitCode === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : job ? (
              <XCircle className="h-5 w-5 text-red-600" />
            ) : (
              <RefreshCw className="h-5 w-5 text-zinc-500" />
            )}
            <div>
              <h2 className="font-semibold">
                {job ? JOB_LABEL[job.request.kind] : "Hələ iş başladılmayıb"}
                {job?.request.limit ? ` · ${job.request.limit}` : ""}
                {job?.request.onlyMissing ? " · yalnız çəkilməyənlər" : ""}
                {job?.request.thenProject && job.request.kind !== "project" ? " → proyeksiya" : ""}
              </h2>
              {job ? (
                <p className="text-xs text-zinc-600">
                  {job.running
                    ? `gedir · ${duration(job.startedAt)}`
                    : job.stoppedByAdmin
                      ? `dayandırıldı · ${fmt(job.finishedAt)}`
                      : `${job.exitCode === 0 ? "uğurla bitdi" : `xəta ilə bitdi (kod ${job.exitCode ?? "?"})`} · ${fmt(job.finishedAt)} · ${duration(job.startedAt, job.finishedAt)}`}
                </p>
              ) : null}
            </div>
          </div>
          {job?.running ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => window.confirm("İş dayandırılsın?") && post({ action: "stop" })}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Square className="h-4 w-4" /> Dayandır
            </button>
          ) : null}
        </header>
        {data.external && !job?.running ? (
          <p className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Terminaldan başladılmış iş gedir: {RUN_LABEL[data.external.kind] ?? data.external.kind} · {fmt(data.external.startedAt)}
          </p>
        ) : null}
        {job ? (
          <pre ref={logRef} className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#0b0d12] p-3 font-mono text-[11px] leading-relaxed text-[#d4d4d8]">
            {data.log?.trim() || "…"}
          </pre>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {JOBS.map((j) => (
          <JobCard
            key={j.kind}
            job={j}
            busy={pending || running}
            onStart={(kind, limit, thenProject, onlyMissing) => post({ action: "start", kind, limit: limit || undefined, thenProject, onlyMissing })}
          />
        ))}
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-semibold">
              <UploadCloud className="h-4 w-4" /> Prod saytına göndər
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Son göndərişdən sonra dəyişən başlıqlar, yoxlanmış dillər və epizod datası prod-a gedir, sonra prod-da
              proyeksiya işləyir. Brauzer açılmır.
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {data.publish?.configured
                ? data.publish.last
                  ? `Son göndəriş: ${fmt(data.publish.last.at)} → ${data.publish.last.url}`
                  : "Hələ göndərilməyib"
                : "Konfiqurasiya yoxdur: .env-də HBOMAX_PUBLISH_URL və HBOMAX_IMPORT_TOKEN təyin et."}
            </p>
          </div>
          <button
            type="button"
            disabled={pending || running || !data.publish?.configured}
            onClick={() => window.confirm("Dəyişikliklər prod sayta göndərilsin?") && post({ action: "start", kind: "publish" })}
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4" /> Prod-a göndər
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <h2 className="mb-3 font-semibold">Son run-lar</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-600">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Növ</th>
              <th className="py-1.5 pr-3 font-medium">Status</th>
              <th className="py-1.5 pr-3 font-medium">Başlanğıc</th>
              <th className="py-1.5 pr-3 font-medium">Müddət</th>
              <th className="py-1.5 font-medium">Nəticə</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {s.runs.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-1.5">
                    {r.kind === "HBOMAX_CATALOG" ? <Tv className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
                    {RUN_LABEL[r.kind] ?? r.kind}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === "SUCCESS"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "RUNNING"
                          ? "bg-violet-100 text-violet-800"
                          : r.status === "PARTIAL"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="py-2 pr-3 tabular-nums">{fmt(r.startedAt)}</td>
                <td className="py-2 pr-3 tabular-nums">{r.finishedAt ? duration(r.startedAt, r.finishedAt) : "—"}</td>
                <td className="py-2 text-xs text-zinc-600">
                  {r.error ? <span className="text-red-700">{r.error.slice(0, 120)}</span> : `${r.scrapedCount} / ${r.upsertedCount}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
