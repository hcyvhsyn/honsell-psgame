import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  buildEmbeddingHash,
  buildEmbeddingText,
  embedBatch,
} from "@/lib/embeddings";
import { invalidateEmbeddingsCache } from "@/lib/semantic-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Backfills game embeddings. Streams progress as Server-Sent Events so the
 * admin UI can render a live counter.
 *
 * Selects rows where `embeddingHash` is null OR where the hash no longer
 * matches the current embedding text (title/edition/platform/productType
 * changed since last embed). Re-embeds them in batches and writes the
 * embedding + new hash back.
 *
 * Query params:
 *   batch     items per OpenAI call (default 100, max 200)
 *   limit     hard cap on rows touched in this run (default unlimited)
 *   force     "1" to re-embed every row regardless of hash match
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
  const batchSize = Math.max(
    1,
    Math.min(200, Number(url.searchParams.get("batch")) || 100)
  );
  const limitParam = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : null;
  const force = url.searchParams.get("force") === "1";

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(payload: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      }

      try {
        // Fetch candidates. When `force` is on we touch everything; otherwise
        // only rows missing an embedding or whose hash mismatches (we check
        // the hash in JS since hash inputs depend on multiple columns).
        const where = force
          ? { isActive: true }
          : { isActive: true, OR: [{ embeddingHash: null }, { embedding: { isEmpty: true } }] };

        const rows = await prisma.game.findMany({
          where,
          select: {
            id: true,
            title: true,
            editionLabel: true,
            platform: true,
            productType: true,
            embeddingHash: true,
          },
          ...(limit ? { take: limit } : {}),
        });

        // Compute target hashes and filter out rows that are already up-to-date
        // (only relevant when `force` is off and the row had a valid hash).
        const work = rows
          .map((r) => {
            const text = buildEmbeddingText(r);
            const hash = buildEmbeddingHash(text);
            return { ...r, text, hash };
          })
          .filter((r) => force || r.embeddingHash !== r.hash);

        emit({
          type: "start",
          candidates: rows.length,
          toEmbed: work.length,
          batchSize,
        });

        if (work.length === 0) {
          // Even on a no-op run we drop the in-memory cache so any vectors
          // that drifted in via the scraper post-step are immediately visible
          // to /api/search/ai.
          invalidateEmbeddingsCache();
          emit({ type: "done", embedded: 0, skipped: rows.length });
          controller.close();
          return;
        }

        let embedded = 0;
        let failed = 0;
        for (let i = 0; i < work.length; i += batchSize) {
          const chunk = work.slice(i, i + batchSize);
          try {
            const vectors = await embedBatch(chunk.map((r) => r.text));
            await Promise.all(
              chunk.map((row, idx) =>
                prisma.game.update({
                  where: { id: row.id },
                  data: {
                    embedding: vectors[idx],
                    embeddingHash: row.hash,
                  },
                })
              )
            );
            embedded += chunk.length;
          } catch (e) {
            failed += chunk.length;
            console.error("embeddings/backfill: chunk failed", e);
          }
          emit({
            type: "progress",
            embedded,
            failed,
            total: work.length,
          });
        }

        // Drop the per-instance semantic-search cache so the next /api/search/ai
        // call rebuilds from the freshly embedded rows. Without this the cache
        // could keep serving stale (or empty) vectors for up to CACHE_TTL_MS.
        invalidateEmbeddingsCache();

        emit({ type: "done", embedded, failed, total: work.length });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("embeddings/backfill: fatal", err);
        emit({ type: "error", error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export const POST = GET;
