import { createHash } from "node:crypto";
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";
import { findFranchiseContext } from "@/lib/search-aliases";

// OpenAI's `text-embedding-3-small` natively produces 1536-dim vectors but
// supports a `dimensions` parameter to truncate at the model level. 512 keeps
// retrieval quality within ~95% of full-dim while shrinking storage 3× and
// in-memory cosine compute proportionally.
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 512;

// API max is 2048 inputs per request. We stay well below that to keep each
// request's latency reasonable and to amortize a transient failure across
// fewer items.
const EMBED_BATCH_SIZE = 100;

/**
 * Canonical text used for embedding a Game row. Combines the fields a user
 * would naturally type into search: title, edition label, platform tag, and
 * a coarse product-type hint. We intentionally keep it short — embedding
 * quality on long marketing copy is worse than on a concise label.
 */
export function buildEmbeddingText(game: {
  title: string;
  editionLabel?: string | null;
  platform?: string | null;
  productType?: string | null;
}): string {
  const parts: string[] = [game.title];
  if (game.editionLabel) parts.push(game.editionLabel);
  if (game.platform) parts.push(`(${game.platform})`);
  // Map internal product type to a natural-language hint so semantic queries
  // like "DLC for FIFA" can match ADDON rows even when the title doesn't
  // contain the word "DLC".
  if (game.productType === "ADDON") parts.push("DLC add-on");
  else if (game.productType === "CURRENCY") parts.push("PSN credit");
  // Franchise bridge: when the title belongs to a known franchise group,
  // append the other group members as a short context block. Brings rows
  // like "EA Sports FC 26" within cosine reach of "fifa" queries even
  // though the title shares no tokens with the query. Empty string for
  // non-franchise titles, so generic games aren't diluted by stale context.
  const ctx = findFranchiseContext(game.title);
  if (ctx) parts.push(`[${ctx}]`);
  return parts.join(" ").trim();
}

/**
 * Short fingerprint of the embedded text. Stored on the row so the scraper
 * post-step can skip re-embedding when the input text hasn't actually
 * changed — most rescrapes touch price/discount fields, not title.
 */
export function buildEmbeddingHash(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 16);
}

/** Embed a single string. Convenience wrapper around `embedBatch`. */
export async function generateEmbedding(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  return vec;
}

/**
 * Embed an array of strings in chunks. Returns vectors in the same order as
 * the input. Throws if OPENAI_API_KEY is not configured — callers should
 * check `isOpenAIConfigured()` first if they want a graceful fallback.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!isOpenAIConfigured()) {
    throw new Error("OPENAI_API_KEY env dəyişəni təyin olunmayıb.");
  }
  const client = getOpenAI();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const chunk = texts.slice(i, i + EMBED_BATCH_SIZE);
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: chunk,
      dimensions: EMBEDDING_DIM,
    });
    // Sort defensively — OpenAI guarantees order but a future SDK change
    // could shuffle results; the `index` field is the contract.
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) out.push(item.embedding as number[]);
  }
  return out;
}

/**
 * Cosine similarity assuming both inputs are already unit-length, which is
 * the case for OpenAI embeddings. Reduces the cost to a single dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Score every candidate against the query and return the top-K sorted by
 * descending similarity. Used both by semantic search and by the cart's
 * "similar games" widget.
 */
export function topKBySimilarity<T extends { embedding: number[] }>(
  query: number[],
  candidates: T[],
  k: number
): Array<T & { score: number }> {
  const scored = candidates.map((c) => ({
    ...c,
    score: cosineSimilarity(query, c.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
