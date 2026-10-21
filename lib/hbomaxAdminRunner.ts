/**
 * Admin paneldən HBO Max kollektor işlərini (sync / validasiya / proyeksiya) işə salmaq.
 *
 * ⚠️ YALNIZ `npm run dev:hbomax` ilə işləyən lokal serverdə aktivdir (`HBOMAX_ADMIN_RUNNER=1`):
 * kollektor HBO-ya giriş edilmiş Chrome profili (`.hbomax-profile/`) və lokal kollektor DB-si
 * tələb edir — prod serverdə ikisi də yoxdur.
 *
 * İş mövcud npm script-lərini AYRICA proses kimi işə salır (eyni CLI qaydaları, eyni DB
 * qoruyucusu). Vəziyyət `.hbomax-admin/` qovluğundakı fayllardadır — dev server modulları
 * yenidən yükləyəndə itməsin. Eyni anda yalnız BİR iş: brauzer profili paylaşıla bilmir.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, statSync, readSync, closeSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const HBOMAX_ADMIN_RUNNER_ENABLED = process.env.HBOMAX_ADMIN_RUNNER === "1";

const DIR = path.join(process.cwd(), ".hbomax-admin");
const STATE_FILE = path.join(DIR, "job.json");

export type HboJobKind = "catalog" | "validate" | "project";

export interface HboJobRequest {
  kind: HboJobKind;
  /** catalog: detal çəkiləcək başlıq sayı; validate: bu run üçün tavan. Boş = hamısı / gündəlik limit. */
  limit?: number;
  /** catalog / validate bitəndən sonra vitrinə proyeksiya. */
  thenProject?: boolean;
}

export interface HboJobState {
  id: string;
  request: HboJobRequest;
  steps: string[];
  pid: number;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  stoppedByAdmin?: boolean;
}

export const JOB_LABEL: Record<HboJobKind, string> = {
  catalog: "Kataloq sync",
  validate: "AZ player validasiyası",
  project: "Vitrinə proyeksiya",
};

function npmScript(kind: HboJobKind, limit?: number): string {
  const lim = limit ? ` -- --limit ${limit}` : "";
  if (kind === "catalog") return `npm run -s hbomax:catalog-sync${lim}`;
  if (kind === "validate") return `npm run -s hbomax:validate-pending${lim}`;
  return "npm run -s hbomax:project";
}

export function stepsFor(req: HboJobRequest): string[] {
  const steps = [npmScript(req.kind, req.limit)];
  if (req.thenProject && req.kind !== "project") steps.push(npmScript("project"));
  return steps;
}

function readState(): HboJobState | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as HboJobState;
  } catch {
    return null;
  }
}

function writeState(s: HboJobState) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const logPath = (id: string) => path.join(DIR, `${id}.log`);
const exitPath = (id: string) => path.join(DIR, `${id}.exit`);

/** Vəziyyət + proses canlılığı (proses ölübsə exit faylından nəticə oxunur). */
export function currentJob(): (HboJobState & { running: boolean }) | null {
  const s = readState();
  if (!s) return null;
  const running = !s.finishedAt && isAlive(s.pid);
  if (!running && !s.finishedAt) {
    const code = existsSync(exitPath(s.id)) ? Number(readFileSync(exitPath(s.id), "utf8").trim()) : null;
    s.finishedAt = new Date().toISOString();
    s.exitCode = Number.isFinite(code) ? code : null;
    writeState(s);
  }
  return { ...s, running };
}

/** Logun son ~N baytı (sətir sərhədindən). Debug sətirləri atılır. */
export function jobLogTail(id: string, maxBytes = 24_000): string {
  const file = logPath(id);
  if (!existsSync(file)) return "";
  const size = statSync(file).size;
  const start = Math.max(0, size - maxBytes);
  const buf = Buffer.alloc(size - start);
  const fd = openSync(file, "r");
  try {
    readSync(fd, buf, 0, buf.length, start);
  } finally {
    closeSync(fd);
  }
  let text = buf.toString("utf8");
  if (start > 0) text = text.slice(text.indexOf("\n") + 1);
  return text
    .split("\n")
    .filter((l) => !/\bdebug\b/i.test(l))
    .join("\n");
}

/** Başqa yerdən (terminal) işləyən HBO run-u — eyni brauzer profili, paralel işlətmək olmaz. */
export async function externalRunningRun() {
  return prisma.scrapeRun.findFirst({
    where: { kind: { startsWith: "HBOMAX_" }, status: "RUNNING", startedAt: { gte: new Date(Date.now() - 6 * 3_600_000) } },
    orderBy: { startedAt: "desc" },
    select: { id: true, kind: true, startedAt: true },
  });
}

export class HboJobError extends Error {}

export async function startJob(req: HboJobRequest, opts: { force?: boolean } = {}): Promise<HboJobState> {
  if (!HBOMAX_ADMIN_RUNNER_ENABLED) throw new HboJobError("Kollektor yalnız `npm run dev:hbomax` ilə işləyən lokal serverdə işə salına bilər.");
  const cur = currentJob();
  if (cur?.running) throw new HboJobError(`Artıq iş gedir: ${JOB_LABEL[cur.request.kind]}`);
  if (!opts.force) {
    const ext = await externalRunningRun();
    if (ext) throw new HboJobError(`EXTERNAL:${ext.kind} ${ext.startedAt.toISOString()}`);
  }

  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${req.kind}`;
  const steps = stepsFor(req);
  mkdirSync(DIR, { recursive: true });
  const out = openSync(logPath(id), "a");
  // Addımlar ardıcıl; ilk uğursuz addımda dayanır. Exit kodu ayrıca fayla yazılır.
  const script = `set -o pipefail; ${steps.map((s) => `echo "▶ ${s}"; ${s}`).join(" && ")}; echo $? > ${JSON.stringify(exitPath(id))}`;
  const child = spawn("/bin/bash", ["-c", script], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  child.unref();
  closeSync(out);
  const state: HboJobState = { id, request: req, steps, pid: child.pid!, startedAt: new Date().toISOString() };
  writeState(state);
  return state;
}

/** Prosesi (bütün qrupu: bash → npm → tsx → Chrome) dayandırır, açıq qalan ScrapeRun-u bağlayır. */
export async function stopJob(): Promise<boolean> {
  const cur = currentJob();
  if (!cur?.running) return false;
  try {
    process.kill(-cur.pid, "SIGTERM");
  } catch {
    try {
      process.kill(cur.pid, "SIGTERM");
    } catch {
      /* artıq ölüb */
    }
  }
  writeState({ ...cur, finishedAt: new Date().toISOString(), exitCode: null, stoppedByAdmin: true });
  await prisma.scrapeRun.updateMany({
    where: { kind: { startsWith: "HBOMAX_" }, status: "RUNNING", startedAt: { gte: new Date(cur.startedAt) } },
    data: { status: "FAILED", finishedAt: new Date(), error: "Admin tərəfindən dayandırıldı" },
  });
  return true;
}

/** Kollektor DB-sinin xülasəsi (Provider* cədvəlləri yalnız lokal DB-dədir). */
export async function collectorStats(region: string) {
  const [byKind, detailed, episodes, queue, used24h, storefront, runs] = await Promise.all([
    prisma.providerTitle.groupBy({ by: ["kind"], where: { platform: "HBOMAX", regions: { some: { region, isCurrentlyAvailable: true } } }, _count: true }),
    prisma.providerTitle.groupBy({
      by: ["kind"],
      where: { platform: "HBOMAX", lastMetadataSyncAt: { not: null }, regions: { some: { region, isCurrentlyAvailable: true } } },
      _count: true,
    }),
    prisma.providerEpisode.count({ where: { isCurrentlyListed: true, title: { platform: "HBOMAX" } } }),
    prisma.episodeRegionState.groupBy({ by: ["status"], where: { region }, _count: true }),
    prisma.episodeRegionState.count({ where: { region, lastRegionValidationAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    prisma.contentAvailability.count({ where: { platform: "HBOMAX", country: region, isAvailable: true } }),
    prisma.scrapeRun.findMany({
      where: { kind: { startsWith: "HBOMAX_" } },
      orderBy: { startedAt: "desc" },
      take: 8,
      select: { id: true, kind: true, status: true, startedAt: true, finishedAt: true, scrapedCount: true, upsertedCount: true, error: true },
    }),
  ]);
  const count = (rows: Array<{ kind: string; _count: number }>, k: string) => rows.find((r) => r.kind === k)?._count ?? 0;
  return {
    titles: { series: count(byKind, "SERIES"), movies: count(byKind, "MOVIE") },
    detailed: { series: count(detailed, "SERIES"), movies: count(detailed, "MOVIE") },
    episodes,
    queue: Object.fromEntries(queue.map((q) => [q.status, q._count])) as Record<string, number>,
    used24h,
    storefront,
    runs,
  };
}
