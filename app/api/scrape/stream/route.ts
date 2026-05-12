import { requireAdmin } from "@/lib/auth";
import { runStreamingScrape, type ProgressEvent } from "@/lib/scrapers/orchestrator";
import { PLATFORMS, type Platform } from "@/lib/scrapers/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/scrape/stream — admin paneli üçün SSE.
 *
 * EventSource istifadə edən UI (`/admin/streaming/scrape`) bu endpoint-ə qoşulur,
 * orchestrator hər platformanın başlanğıc/bitiş və yekun nəticə üçün event yayır.
 * Cron / API client üçün `POST /api/scrape` qalır (single JSON cavab).
 *
 * Auth: admin oturumu məcburidir (cron üçün deyil).
 * Query: `?platforms=NETFLIX,GAIN` — opsional, default bütün 4 platforma.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Forbidden" ? 403 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const platformsParam = url.searchParams.get("platforms");
  let platforms: Platform[] | undefined;
  if (platformsParam) {
    const valid = platformsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p));
    if (valid.length > 0) platforms = valid;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: ProgressEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      try {
        await runStreamingScrape({ platforms, onEvent: emit });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
