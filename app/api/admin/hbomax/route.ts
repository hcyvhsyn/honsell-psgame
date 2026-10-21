/**
 * Admin — HBO Max kollektoru.
 *   GET  → { enabled, job, log, stats, dailyLimit, external }
 *   POST { action: "start", kind, limit?, thenProject?, force? } | { action: "stop" }
 * İşlər yalnız lokal `npm run dev:hbomax` serverində işə salınır (lib/hbomaxAdminRunner.ts).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { HBOMAX_CONFIG, HBOMAX_REGION } from "@/lib/scrapers/hbomaxCollector/config";
import {
  HBOMAX_ADMIN_RUNNER_ENABLED,
  HboJobError,
  collectorStats,
  currentJob,
  externalRunningRun,
  jobLogTail,
  startJob,
  stopJob,
  type HboJobKind,
} from "@/lib/hbomaxAdminRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set<HboJobKind>(["catalog", "validate", "project"]);

async function admin() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!HBOMAX_ADMIN_RUNNER_ENABLED) return NextResponse.json({ enabled: false });
  const job = currentJob();
  const [stats, external] = await Promise.all([collectorStats(HBOMAX_REGION), job?.running ? null : externalRunningRun()]);
  return NextResponse.json({
    enabled: true,
    region: HBOMAX_REGION,
    dailyLimit: HBOMAX_CONFIG.validation.dailyLimit,
    job,
    log: job ? jobLogTail(job.id) : "",
    stats,
    external,
  });
}

export async function POST(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; kind?: string; limit?: unknown; thenProject?: unknown; force?: unknown };
  try {
    if (body.action === "stop") return NextResponse.json({ stopped: await stopJob() });
    if (body.action !== "start" || !KINDS.has(body.kind as HboJobKind)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const limit = body.limit === undefined || body.limit === null || body.limit === "" ? undefined : Number(body.limit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 5000)) {
      return NextResponse.json({ error: "Limit 1–5000 arası tam ədəd olmalıdır" }, { status: 400 });
    }
    const job = await startJob({ kind: body.kind as HboJobKind, limit, thenProject: body.thenProject === true }, { force: body.force === true });
    return NextResponse.json({ job });
  } catch (err) {
    if (err instanceof HboJobError) {
      const external = err.message.startsWith("EXTERNAL:");
      return NextResponse.json({ error: external ? "external_running" : err.message, detail: err.message }, { status: 409 });
    }
    throw err;
  }
}
