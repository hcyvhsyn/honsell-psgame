import { prisma } from "@/lib/prisma";
import {
  cosineSimilarity,
  EMBEDDING_DIM,
  generateEmbedding,
} from "@/lib/embeddings";
import { isOpenAIConfigured } from "@/lib/openai";

/**
 * Per-instance cache of all game embeddings. With ~50k rows × 512 floats × 8B
 * the array footprint is ~200MB — workable inside a Vercel function's 1GB
 * heap. Cold start pays ~5-10s to load; warm requests pay ~30ms for the JS
 * cosine sweep.
 */
type CachedRow = { id: string; embedding: number[] };
let cache: { ts: number; rows: CachedRow[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadEmbeddings(): Promise<CachedRow[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.rows;
  const rows = await prisma.game.findMany({
    where: { isActive: true },
    select: { id: true, embedding: true },
  });
  // Filter out rows whose embedding column is empty / wrong-dim (legacy or
  // mid-backfill state). Comparing against EMBEDDING_DIM also catches the
  // case where the model dimensions change in the future.
  const valid = rows.filter(
    (r) => Array.isArray(r.embedding) && r.embedding.length === EMBEDDING_DIM
  ) as CachedRow[];
  cache = { ts: Date.now(), rows: valid };
  return valid;
}

/** Force-clear the cache. Used after backfill so the next search sees new vectors. */
export function invalidateEmbeddingsCache() {
  cache = null;
}

export type SemanticHit = { id: string; score: number };

/**
 * Returns the top-K Game ids by semantic similarity to the query string.
 * No-ops (returns empty) when OpenAI is not configured or no embedded rows
 * exist, so callers can safely fall back to keyword search.
 */
export async function semanticSearchIds(
  query: string,
  k: number
): Promise<SemanticHit[]> {
  if (!isOpenAIConfigured()) return [];
  const rows = await loadEmbeddings();
  if (rows.length === 0) return [];

  const queryVec = await generateEmbedding(query);

  // Single linear sweep — at 50k×512 this takes ~30ms in V8. Avoids the
  // memory cost of materializing a {id, score} object per row.
  const scores = new Float32Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    scores[i] = cosineSimilarity(queryVec, rows[i].embedding);
  }

  // Build top-K via a partial sort of indices instead of sorting all 50k.
  const indices: number[] = [];
  for (let i = 0; i < rows.length; i++) indices.push(i);
  indices.sort((a, b) => scores[b] - scores[a]);

  const out: SemanticHit[] = [];
  for (let i = 0; i < Math.min(k, indices.length); i++) {
    const idx = indices[i];
    out.push({ id: rows[idx].id, score: scores[idx] });
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
