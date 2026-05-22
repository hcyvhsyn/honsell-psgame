import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aznToTryCents, computeDisplayPrice, getSettings } from "@/lib/pricing";
import type { Game } from "@/lib/generated/prisma/client";
import { semanticSearchIds } from "@/lib/semantic-search";
import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";
import { expandAliases } from "@/lib/search-aliases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hybrid search: combines OpenAI-embedding semantic search with the existing
 * pg_trgm keyword fuzzy match. The two candidate lists are merged with a
 * 50/50 score blend so a query like "open world rpg" surfaces Elden Ring
 * (pure semantic) and a typo like "spaderman" still surfaces Spider-Man
 * (pure keyword).
 *
 * When the primary search yields too few hits, we run an LLM query expansion
 * step: GPT-4o-mini rewrites the query (typo correction, Azerbaijani/Turkish
 * translation, abbreviation expansion — e.g. "geta" → "Grand Theft Auto",
 * "futbol" → "EA Sports FC FIFA") and we re-run the search with the rewritten
 * query, appending any new results. The rewrite is grounded in a sample of
 * real catalog titles so it doesn't invent games that don't exist.
 */
const PRODUCT_TYPES = new Set(["ALL", "GAME", "ADDON", "CURRENCY", "OTHER"]);
const PER_TRACK_K = 200;
// When the primary hybrid search returns fewer than this many rows, we trigger
// the LLM expansion. 5 is a tradeoff: small enough that a typo with a single
// near-match doesn't trigger an LLM call, large enough that "geta" → 0 hits
// triggers it.
const EXPANSION_THRESHOLD = 5;
const EXPANSION_SAMPLE_SIZE = 200;

type Filters = {
  filterByType: boolean;
  productType: string;
  platform: string | null;
  onSale: boolean;
  /** TRY-cent thresholds derived from the AZN UI inputs. null = no bound. */
  priceMinTryCents: number | null;
  priceMaxTryCents: number | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({
      total: 0,
      count: 0,
      results: [],
      semantic: false,
    });
  }

  const typeParam = url.searchParams.get("type") ?? "ALL";
  const productType = PRODUCT_TYPES.has(typeParam) ? typeParam : "ALL";
  const filterByType = productType !== "ALL";
  const platform = url.searchParams.get("platform");
  const onSale = url.searchParams.get("onSale") === "1";
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 24));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const priceMinRaw = Number(url.searchParams.get("priceMin"));
  const priceMaxRaw = Number(url.searchParams.get("priceMax"));
  const priceMinAzn = Number.isFinite(priceMinRaw) && priceMinRaw > 0 ? priceMinRaw : null;
  const priceMaxAzn = Number.isFinite(priceMaxRaw) && priceMaxRaw > 0 ? priceMaxRaw : null;
  // Need the live settings to translate AZN UI bounds into TRY-cent column
  // values. This was fetched later anyway for `computeDisplayPrice` — moving
  // it up is a single extra await with no measurable cost.
  const settings = await getSettings();
  const priceMinTryCents =
    priceMinAzn != null ? aznToTryCents(priceMinAzn, settings, "ceil") : null;
  const priceMaxTryCents =
    priceMaxAzn != null ? aznToTryCents(priceMaxAzn, settings, "floor") : null;

  const filters: Filters = {
    filterByType,
    productType,
    platform,
    onSale,
    priceMinTryCents,
    priceMaxTryCents,
  };

  // Stage 1 — deterministic alias expansion. Handles franchise rebrands
  // (FIFA↔EA Sports FC), abbreviations (geta→GTA, cod→COD), and AZ/TR
  // keyword translation (futbol→EA Sports FC). Year-pinned queries like
  // "fifa 22" are passed through unexpanded.
  const aliasExpansion = expandAliases(q);

  // Primary hybrid search — uses the alias variants natively, so old and
  // rebranded titles surface together rather than being merged after the
  // fact.
  const primary = await hybridSearch(aliasExpansion.variants, filters, {
    boostGame: aliasExpansion.expanded && !filterByType,
  });

  let interpretedAs: string | null = null;
  let merged = primary.rows;

  if (aliasExpansion.expanded) {
    // Show the alias rewrite as the hint. Limit to a few terms so the chip
    // stays readable.
    const others = aliasExpansion.variants
      .filter((v) => v.toLowerCase() !== q.toLowerCase())
      .slice(0, 4);
    if (others.length > 0) interpretedAs = others.join(", ");
  }

  // Stage 2 — LLM fallback only when alias expansion didn't already pull
  // enough rows. Catches off-dictionary cases (rare misspellings, unusual
  // phrasings).
  if (merged.length < EXPANSION_THRESHOLD && isOpenAIConfigured()) {
    const expanded = await expandQuery(q);
    if (expanded && expanded.toLowerCase() !== q.toLowerCase()) {
      const secondary = await hybridSearch([expanded], filters, {
        boostGame: !filterByType,
      });
      if (secondary.rows.length > 0) {
        const primaryIds = new Set(primary.rows.map((r) => r.id));
        const additional = secondary.rows.filter((r) => !primaryIds.has(r.id));
        if (additional.length > 0) {
          merged = [...primary.rows, ...additional];
          // The LLM rewrite wins the hint over the alias label when alias
          // expansion didn't already do enough.
          interpretedAs = expanded;
        }
      }
    }
  }

  const total = merged.length;
  const pageRows = merged.slice(offset, offset + limit);

  // `settings` was already fetched above for the AZN→TRY conversion.
  const results = pageRows.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      id: g.id,
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      platform: g.platform,
      productType: g.productType,
      finalAzn: price.finalAzn,
      originalAzn: price.originalAzn,
      discountPct: price.discountPct,
      discountEndAt:
        g.discountTryCents != null && g.discountEndAt
          ? g.discountEndAt.toISOString()
          : null,
    };
  });

  return NextResponse.json({
    total,
    count: results.length,
    results,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    semantic: primary.semantic && isOpenAIConfigured(),
    /** Set when the LLM rewrote the query and the rewrite actually
     * contributed new rows. UI uses this to render a subtle inline hint
     * ("'geta' → 'Grand Theft Auto'") above the result grid. */
    interpretedAs,
  });
}

async function hybridSearch(
  variants: string[],
  filters: Filters,
  options?: { boostGame?: boolean }
): Promise<{ rows: Game[]; semantic: boolean }> {
  // Defensive: always have something to search.
  if (variants.length === 0) return { rows: [], semantic: false };

  // Semantic: feed the variants as a single joined string. OpenAI's tokenizer
  // handles the multi-concept blend natively, and we pay one embedding call
  // regardless of variant count. The joined form ("fifa ea sports fc") moves
  // the query vector toward the franchise centroid, which is the goal.
  const semanticInput = variants.join(" ");
  const semanticHits = await semanticSearchIds(semanticInput, PER_TRACK_K).catch(
    (e) => {
      console.error("search/ai: semanticSearchIds failed", e);
      return [] as Awaited<ReturnType<typeof semanticSearchIds>>;
    }
  );

  // Keyword: union across all variants, scoring each row by its best variant
  // match. Built as a single round-trip — unnest the variant arrays and pick
  // the GREATEST similarity / ILIKE score.
  let keywordHits: { id: string; score: number }[] = [];
  try {
    const exactPatterns = variants.map((v) => `%${v}%`);
    const rows = (await prisma.$queryRawUnsafe(
      `WITH variants(q, p) AS (
         SELECT * FROM unnest($1::text[], $2::text[]) AS t(q, p)
       )
       SELECT g.id,
              MAX(GREATEST(
                similarity(g.title, v.q),
                CASE WHEN g.title ILIKE v.p THEN 0.7 ELSE 0 END
              )) AS score
         FROM "Game" g
         CROSS JOIN variants v
        WHERE g."isActive" = true
          AND (g.title ILIKE v.p OR similarity(g.title, v.q) >= 0.15)
        GROUP BY g.id
        ORDER BY score DESC
        LIMIT $3`,
      variants,
      exactPatterns,
      PER_TRACK_K
    )) as Array<{ id: string; score: number }>;
    keywordHits = rows;
  } catch (e) {
    console.warn("search/ai: pg_trgm unavailable, using ILIKE fallback", e);
    const rows = await prisma.game.findMany({
      where: {
        isActive: true,
        OR: variants.map((v) => ({
          title: { contains: v, mode: "insensitive" as const },
        })),
      },
      select: { id: true },
      take: PER_TRACK_K,
    });
    keywordHits = rows.map((r) => ({ id: r.id, score: 0.5 }));
  }

  const semMax = Math.max(...semanticHits.map((h) => h.score), 0.0001);
  const kwMax = Math.max(...keywordHits.map((h) => h.score), 0.0001);

  const blended = new Map<string, { semantic: number; keyword: number; final: number }>();
  for (const h of semanticHits) {
    blended.set(h.id, {
      semantic: h.score / semMax,
      keyword: 0,
      final: 0.5 * (h.score / semMax),
    });
  }
  for (const h of keywordHits) {
    const norm = h.score / kwMax;
    const existing = blended.get(h.id);
    if (existing) {
      existing.keyword = norm;
      existing.final = 0.5 * existing.semantic + 0.5 * norm;
    } else {
      blended.set(h.id, { semantic: 0, keyword: norm, final: 0.5 * norm });
    }
  }

  const orderedIds = [...blended.entries()]
    .sort((a, b) => b[1].final - a[1].final)
    .map(([id]) => id);

  if (orderedIds.length === 0) {
    return { rows: [], semantic: semanticHits.length > 0 };
  }

  // Effective-price range filter: applied at the candidate-filtering step
  // (not on the semantic/keyword scoring above) because pricing is orthogonal
  // to text relevance — it's a hard threshold, not a ranking signal.
  const priceConds: Array<Record<string, unknown>> = [];
  if (filters.priceMinTryCents != null || filters.priceMaxTryCents != null) {
    const range: { gte?: number; lte?: number } = {};
    if (filters.priceMinTryCents != null) range.gte = filters.priceMinTryCents;
    if (filters.priceMaxTryCents != null) range.lte = filters.priceMaxTryCents;
    priceConds.push({
      OR: [
        // Discounted row: the discount price must be in range (and not null).
        { discountTryCents: { not: null, ...range } },
        // Non-discounted row: the base price must be in range.
        { discountTryCents: null, priceTryCents: range },
      ],
    });
  }

  const idFiltered = await prisma.game.findMany({
    where: {
      id: { in: orderedIds },
      isActive: true,
      ...(filters.filterByType ? { productType: filters.productType } : {}),
      ...(filters.onSale ? { discountTryCents: { not: null } } : {}),
      ...(filters.platform === "PS4" || filters.platform === "PS5"
        ? { OR: [{ platform: { contains: filters.platform } }, { platform: null }] }
        : {}),
      ...(priceConds.length > 0 ? { AND: priceConds } : {}),
    },
  });
  const byId = new Map(idFiltered.map((g) => [g.id, g]));

  // Optional product-type tilt. Applied AFTER filtering so type-specific
  // searches (?type=ADDON) are unaffected. The bonus is small enough that
  // strong matches still win, but large enough to bump a base game ahead of
  // its currency cards when the user typed a franchise name.
  const GAME_BONUS = 0.1;
  const CURRENCY_PENALTY = -0.1;

  const rescored: { id: string; final: number }[] = [];
  for (const id of orderedIds) {
    const row = byId.get(id);
    if (!row) continue;
    const base = blended.get(id)!.final;
    let adj = 0;
    if (options?.boostGame) {
      if (row.productType === "GAME") adj += GAME_BONUS;
      else if (row.productType === "CURRENCY") adj += CURRENCY_PENALTY;
    }
    rescored.push({ id, final: base + adj });
  }
  rescored.sort((a, b) => b.final - a.final);

  const sortedRows: Game[] = [];
  for (const { id } of rescored) {
    const row = byId.get(id);
    if (row) sortedRows.push(row);
  }

  return { rows: sortedRows, semantic: semanticHits.length > 0 };
}

/**
 * Asks GPT-4o-mini to rewrite a user query into something more likely to hit
 * the catalog: typo-correct, expand abbreviations ("geta" → "grand theft
 * auto"), translate Azerbaijani/Turkish nouns to franchise names ("futbol"
 * → "EA Sports FC FIFA soccer"). Returns the rewritten string, or null if
 * the model can't confidently rewrite.
 *
 * Grounded against a sample of real titles so the rewrite stays within what
 * actually exists in the catalog — we don't want "futbol" to come back as
 * "FIFA 23" when the catalog only has "EA Sports FC 24".
 */
async function expandQuery(q: string): Promise<string | null> {
  try {
    // Pull a sample of titles for grounding. Featured first (most relevant),
    // then fill out with the rest to broaden coverage.
    const featured = await prisma.game.findMany({
      where: { isActive: true, isFeatured: true, productType: "GAME" },
      select: { title: true },
      take: 120,
    });
    const sample = featured.map((g) => g.title);
    if (sample.length < EXPANSION_SAMPLE_SIZE) {
      const more = await prisma.game.findMany({
        where: { isActive: true, isFeatured: false, productType: "GAME" },
        select: { title: true },
        take: EXPANSION_SAMPLE_SIZE - sample.length,
        orderBy: { lastScrapedAt: "desc" },
      });
      sample.push(...more.map((g) => g.title));
    }

    const client = getOpenAI();
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 40,
      messages: [
        {
          role: "system",
          content: [
            "You expand short, abbreviated, or Azerbaijani/Turkish game search queries into the canonical English title or franchise keywords used on the PlayStation Store.",
            "Rules:",
            "1. Output ONLY the expanded query string. No quotes, no punctuation, no explanation.",
            "2. For abbreviations, expand to the full franchise name (e.g. 'gta' → 'Grand Theft Auto', 'cod' → 'Call of Duty', 'lol' → ignore — that's not on PS Store).",
            "3. For Azerbaijani/Turkish nouns, translate to franchise keywords (e.g. 'futbol' → 'EA Sports FC FIFA', 'döyüş' → 'Mortal Kombat Tekken Street Fighter', 'maşın' → 'Forza Gran Turismo F1').",
            "4. For misspellings, correct toward an actual title from the provided list.",
            "5. Prefer matching titles from the provided catalog sample. Never invent versions/years that aren't in the sample (e.g. do NOT output 'FIFA 23' if only 'EA Sports FC 24' is in the sample).",
            "6. If the query is already a valid title, output it unchanged.",
            "7. If you cannot confidently expand, output the original query unchanged.",
          ].join("\n"),
        },
        {
          role: "user",
          content:
            `Catalog sample (${sample.length} titles):\n` +
            sample.slice(0, EXPANSION_SAMPLE_SIZE).join("\n") +
            `\n\nUser query: "${q}"\n\nExpanded query:`,
        },
      ],
    });
    const out = (res.choices[0]?.message?.content ?? "").trim();
    if (!out || out.length > 120) return null;
    return out;
  } catch (e) {
    console.error("search/ai: expandQuery failed", e);
    return null;
  }
}
