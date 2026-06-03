import { prisma } from "@/lib/prisma";
import {
  cosineSimilarity,
  EMBEDDING_DIM,
  generateEmbedding,
} from "@/lib/embeddings";
import { isOpenAIConfigured } from "@/lib/openai";

/**
 * Per-instance cache of game embeddings, keyed by storefront scope so a PS
 * search never loads (and sweeps over) Epic vectors and vice versa. Only rows
 * that actually carry a vector are fetched — the still-unembedded half of the
 * catalog is excluded at the query level rather than filtered in JS, so the
 * payload stays proportional to embedded rows. Cold start pays the load once;
 * warm requests pay a ~few-ms cosine sweep.
 */
type CachedRow = { id: string; embedding: number[] };
type StoreScope = "PS" | "EPIC" | "ALL";
const caches = new Map<StoreScope, { ts: number; rows: CachedRow[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadEmbeddings(scope: StoreScope = "ALL"): Promise<CachedRow[]> {
  const hit = caches.get(scope);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.rows;
  const rows = await prisma.game.findMany({
    where: {
      isActive: true,
      ...(scope === "ALL" ? {} : { store: scope }),
      // Skip rows whose embedding hasn't been backfilled yet — pulling empty
      // arrays over the wire and into the sweep is pure waste.
      NOT: { embedding: { isEmpty: true } },
    },
    select: { id: true, embedding: true },
  });
  // Defensive: also drop any wrong-dim vectors (legacy or a future model swap).
  const valid = rows.filter(
    (r) => Array.isArray(r.embedding) && r.embedding.length === EMBEDDING_DIM
  ) as CachedRow[];
  caches.set(scope, { ts: Date.now(), rows: valid });
  return valid;
}

/** Force-clear every scope's cache. Used after backfill so the next search sees new vectors. */
export function invalidateEmbeddingsCache() {
  caches.clear();
}

/**
 * Short-lived memo of query→vector. The browser debounces search to one
 * request per ~250ms, but pagination, type-tab switches, and the LLM-expansion
 * re-run all re-issue the SAME query string — each of which otherwise costs a
 * fresh OpenAI embedding round-trip (~200-400ms). Caching by normalized query
 * collapses those to a single call.
 */
const QUERY_VEC_TTL_MS = 60 * 1000;
const QUERY_VEC_MAX = 200;
const queryVecCache = new Map<string, { ts: number; vec: number[] }>();

async function embedQueryCached(query: string): Promise<number[]> {
  const key = query.trim().toLowerCase();
  const hit = queryVecCache.get(key);
  if (hit && Date.now() - hit.ts < QUERY_VEC_TTL_MS) return hit.vec;
  const vec = await generateEmbedding(query);
  queryVecCache.set(key, { ts: Date.now(), vec });
  // Bound the map — evict oldest insertion(s) once over cap.
  while (queryVecCache.size > QUERY_VEC_MAX) {
    const oldest = queryVecCache.keys().next().value;
    if (oldest === undefined) break;
    queryVecCache.delete(oldest);
  }
  return vec;
}

export type SemanticHit = { id: string; score: number };

/**
 * Returns the top-K Game ids by semantic similarity to the query string.
 * No-ops (returns empty) when OpenAI is not configured or no embedded rows
 * exist, so callers can safely fall back to keyword search.
 *
 * Two complementary floors keep the result set relevant — text-embedding-3-
 * small has a high cosine baseline (gibberish still scores ~0.4 against real
 * titles), so a single absolute floor can't separate "futbol" (0.50) from
 * "dadSAS" (0.47):
 *   - `minScore`     — absolute floor; drops obviously-noise neighbors.
 *   - `relFraction`  — relative floor; keeps only hits within this fraction of
 *                      THIS query's top score. Trims the junk tail that every
 *                      query (even precise ones, whose rank-50 hit is noise)
 *                      otherwise drags in.
 * The effective per-hit cutoff is max(minScore, relFraction × topScore).
 */
export async function semanticSearchIds(
  query: string,
  k: number,
  options?: { store?: "PS" | "EPIC"; minScore?: number; relFraction?: number }
): Promise<SemanticHit[]> {
  if (!isOpenAIConfigured()) return [];
  const rows = await loadEmbeddings(options?.store ?? "ALL");
  if (rows.length === 0) return [];

  const queryVec = await embedQueryCached(query);
  const minScore = options?.minScore ?? 0;
  const relFraction = options?.relFraction ?? 0;

  // Single linear sweep. Avoids the memory cost of materializing a {id, score}
  // object per row.
  const scores = new Float32Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    scores[i] = cosineSimilarity(queryVec, rows[i].embedding);
  }

  // Partial sort of indices instead of sorting full objects.
  const indices: number[] = [];
  for (let i = 0; i < rows.length; i++) indices.push(i);
  indices.sort((a, b) => scores[b] - scores[a]);

  const topScore = indices.length > 0 ? scores[indices[0]] : 0;
  const floor = Math.max(minScore, relFraction * topScore);

  const out: SemanticHit[] = [];
  for (let i = 0; i < indices.length && out.length < k; i++) {
    const idx = indices[i];
    const score = scores[idx];
    // indices are sorted descending — once below the floor, everything after
    // is too, so we can stop.
    if (score < floor) break;
    out.push({ id: rows[idx].id, score });
  }
  return out;
}

/**
 * Top-K games similar to a specific game (by its precomputed embedding).
 * Used by the cart's "buna oxşar oyunlar" widget. The reference game is
 * excluded from the returned list.
 */
export async function similarGameIds(
  gameId: string,
  k: number,
  options?: { excludeIds?: string[] }
): Promise<SemanticHit[]> {
  const rows = await loadEmbeddings();
  if (rows.length === 0) return [];

  const ref = rows.find((r) => r.id === gameId);
  if (!ref) return [];

  const excluded = new Set([gameId, ...(options?.excludeIds ?? [])]);

  const scored: SemanticHit[] = [];
  for (const row of rows) {
    if (excluded.has(row.id)) continue;
    scored.push({ id: row.id, score: cosineSimilarity(ref.embedding, row.embedding) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
