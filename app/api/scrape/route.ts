import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runStreamingScrape } from "@/lib/scrapers/orchestrator";
import { PLATFORMS, type Platform } from "@/lib/scrapers/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 5 dəqiqə — 4 platform sıra ilə + JustWatch/uNoGS pagination üçün rahatlıq payı.
export const maxDuration = 300;

/**
 * POST /api/scrape — streaming katalogu sinxronlaşdırır.
 *
 * Auth: admin session VƏ YA `Authorization: Bearer ${CRON_SECRET}` header.
 * Body (opsional): `{ platforms?: ("NETFLIX"|"HBOMAX"|"PRIME"|"GAIN")[] }`.
 */
export async function POST(req: Request) {
  const authorized = await isAuthorized(req);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default: Gain skip (login arxasında, ayrı tələb olduqda body-də verilir).
  let platforms: Platform[] | undefined = ["NETFLIX", "HBOMAX", "PRIME"];
  try {
    const raw = req.headers.get("content-type")?.includes("application/json")
      ? await req.json().catch(() => ({}))
      : {};
    if (Array.isArray(raw?.platforms)) {
      const valid = raw.platforms.filter((p: unknown): p is Platform =>
        typeof p === "string" && (PLATFORMS as readonly string[]).includes(p)
      );
      if (valid.length > 0) platforms = valid;
    }
  } catch {
    // body parse uğursuz olsa — default-a düşür
  }

  const result = await runStreamingScrape({ platforms });
  const httpStatus = result.status === "FAILED" ? 502 : 200;
  return NextResponse.json(result, { status: httpStatus });
}

async function isAuthorized(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get("authorization") ?? "";
    if (header === `Bearer ${cronSecret}`) return true;
  }
  const admin = await requireAdmin();
  return !!admin;
}
