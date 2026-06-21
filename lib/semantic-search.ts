import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddings";
import { isOpenAIConfigured } from "@/lib/openai";

/**
 * Semantik axtarış pgvector ANN ilə DB-də işləyir. Əvvəl bütün `embedding
 * Float[]` kataloqu tətbiqə yüklənib JS-də cosine hesablanırdı — 7637+ sətirdə
 * soyuq yükləmə ~114s çəkirdi və hər 5 dəq cache bitəndə axtarış donurdu. İndi
 * `embeddingVec vector(512)` sütunu (DB trigger ilə `embedding`-dən sinxron) +
 * HNSW indeksi top-K-nı bir neçə ms-də qaytarır.
 *
 * `embeddingVec` cosine məsafəsi üçün `<=>` operatoru ilə sıralanır; cosine
 * oxşarlığı = 1 - məsafə (vektorlar vahid uzunluqdadır).
 */

/**
 * Köhnə in-memory cache təmizləyicisi. İndi vektorlar trigger ilə avtomatik
 * sinxronlanır, ona görə təmizləyəcək cache yoxdur — geriyə-uyğunluq üçün
 * no-op saxlanılır (backfill endpoint hələ bunu çağırır).
 */
export function invalidateEmbeddingsCache() {
  /* no-op: embeddingVec DB trigger ilə sinxrondur */
}

/**
 * Sorğu→vektor qısamüddətli memo. Brauzer axtarışı ~250ms debounce edir, amma
 * pagination, tab dəyişməsi və LLM-genişləndirmə təkrar-çağırışı EYNİ sorğu
 * sətrini yenidən göndərir — hər biri əks halda təzə OpenAI embedding round-trip
 * (~200-400ms) tələb edir. Normallaşmış sorğu üzrə keşləmə bunları bir çağırışa
 * yığır.
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
  while (queryVecCache.size > QUERY_VEC_MAX) {
    const oldest = queryVecCache.keys().next().value;
    if (oldest === undefined) break;
    queryVecCache.delete(oldest);
  }
  return vec;
}

/** pgvector literal — `[0.1,0.2,...]`. */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export type SemanticHit = { id: string; score: number };

/**
 * Returns the top-K Game ids by semantic similarity to the query string.
 * No-ops (returns empty) when OpenAI is not configured, so callers can safely
 * fall back to keyword search.
 *
 * Two complementary floors keep the result set relevant — text-embedding-3-
 * small has a high cosine baseline (gibberish still scores ~0.4 against real
 * titles), so a single absolute floor can't separate "futbol" (0.50) from
 * "dadSAS" (0.47):
 *   - `minScore`     — absolute floor; drops obviously-noise neighbors.
 *   - `relFraction`  — relative floor; keeps only hits within this fraction of
 *                      THIS query's top score.
 * The effective per-hit cutoff is max(minScore, relFraction × topScore).
 * ANN returns the closest K rows; the floors only trim that set, so filtering
 * the K rows in JS is equivalent to the old full-scan-then-cut behaviour.
 */
export async function semanticSearchIds(
  query: string,
  k: number,
  options?: { store?: "PS" | "EPIC"; minScore?: number; relFraction?: number }
): Promise<SemanticHit[]> {
  if (!isOpenAIConfigured()) return [];
  if (k <= 0) return [];

  const queryVec = await embedQueryCached(query);
  const lit = toVectorLiteral(queryVec);
  const minScore = options?.minScore ?? 0;
  const relFraction = options?.relFraction ?? 0;

  const rows = options?.store
    ? await prisma.$queryRawUnsafe<{ id: string; score: number }[]>(
        `SELECT id, 1 - ("embeddingVec" <=> $1::vector) AS score
           FROM "Game"
          WHERE "isActive" = true AND "store" = $2 AND "embeddingVec" IS NOT NULL
          ORDER BY "embeddingVec" <=> $1::vector
          LIMIT $3`,
        lit,
        options.store,
        k
      )
    : await prisma.$queryRawUnsafe<{ id: string; score: number }[]>(
        `SELECT id, 1 - ("embeddingVec" <=> $1::vector) AS score
           FROM "Game"
          WHERE "isActive" = true AND "embeddingVec" IS NOT NULL
          ORDER BY "embeddingVec" <=> $1::vector
          LIMIT $2`,
        lit,
        k
      );

  if (rows.length === 0) return [];
  const topScore = rows[0].score;
  const floor = Math.max(minScore, relFraction * topScore);
  // rows are already sorted by descending similarity (ascending distance).
  const out: SemanticHit[] = [];
  for (const r of rows) {
    if (r.score < floor) break;
    out.push({ id: r.id, score: r.score });
  }
  return out;
}

/**
 * Top-K games similar to a specific game (by its precomputed vector).
 * Used by the cart's "buna oxşar oyunlar" widget. The reference game is
 * excluded from the returned list.
 */
export async function similarGameIds(
  gameId: string,
  k: number,
  options?: { excludeIds?: string[] }
): Promise<SemanticHit[]> {
  if (k <= 0) return [];
  // Fetch the reference vector as a literal first so the ANN query's ORDER BY
  // is `column <=> constant` — that's what lets the planner use the HNSW index
  // (a correlated subquery value would force a full scan instead).
  const ref = await prisma.$queryRawUnsafe<{ v: string | null }[]>(
    `SELECT "embeddingVec"::text AS v FROM "Game" WHERE id = $1`,
    gameId
  );
  const refLit = ref[0]?.v;
  if (!refLit) return [];

  const excluded = [gameId, ...(options?.excludeIds ?? [])];
  const rows = await prisma.$queryRawUnsafe<{ id: string; score: number }[]>(
    `SELECT id, 1 - ("embeddingVec" <=> $1::vector) AS score
       FROM "Game"
      WHERE "embeddingVec" IS NOT NULL AND id <> ALL($2::text[])
      ORDER BY "embeddingVec" <=> $1::vector
      LIMIT $3`,
    refLit,
    excluded,
    k
  );
  return rows.map((r) => ({ id: r.id, score: r.score }));
}
