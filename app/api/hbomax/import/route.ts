/**
 * HBO Max kollektor idxalı (prod). Yalnız `npm run hbomax:publish` (Mac) çağırır.
 *   POST (gzip JSON, Content-Type: application/x-hbomax-batch+gzip) → paket yazılır
 *   POST ?action=project                                              → proyeksiya fonda başlayır
 *   GET                                                               → proyeksiya vəziyyəti + say
 * Auth: `Authorization: Bearer $HBOMAX_IMPORT_TOKEN` (server .env, ≥32 simvol). Token yoxdursa
 * və ya səhvdirsə 404 — endpoint-in varlığı da bildirilmir.
 */
import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ImportValidationError, importBatch, importTokenValid, projectionJob, startProjection, validateBatch } from "@/lib/hbomaxImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGION = "AZ";
const MAX_COMPRESSED = 4 * 1024 * 1024;
const MAX_RAW = 40 * 1024 * 1024;

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function GET(req: Request) {
  if (!importTokenValid(req.headers.get("authorization"))) return notFound();
  const [titles, verified] = await Promise.all([
    prisma.providerTitle.count({ where: { platform: "HBOMAX" } }),
    prisma.episodeRegionState.count({ where: { region: REGION, status: "VERIFIED" } }),
  ]);
  return NextResponse.json({ projection: projectionJob(), titles, verified, coverageFlag: process.env.HBOMAX_STOREFRONT_COVERAGE === "1" });
}

export async function POST(req: Request) {
  if (!importTokenValid(req.headers.get("authorization"))) return notFound();
  const url = new URL(req.url);
  if (url.searchParams.get("action") === "project") {
    return NextResponse.json({ projection: startProjection(REGION) });
  }
  if (projectionJob().running) return NextResponse.json({ error: "projection_running" }, { status: 409 });

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > MAX_COMPRESSED) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let body: unknown;
  try {
    const raw = gunzipSync(buf, { maxOutputLength: MAX_RAW });
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }
  try {
    const batch = validateBatch(body);
    return NextResponse.json(await importBatch(batch));
  } catch (err) {
    if (err instanceof ImportValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
