import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scrapes PS Store TR. Two parallel strategies:
 *
 *  1. **Category hubs** — paginate `/tr-tr/category/<UUID>/<page>` for a
 *     curated set of stable hubs (all PS5/PS4 games, deals, new releases…).
 *  2. **Search seeds** — fetch `/tr-tr/search/<query>` for franchise terms
 *     to plug catalog gaps (e.g. GTA Online doesn't appear in the hubs).
 *
 * Streams progress as Server-Sent Events. The UI consumes this with
 * `EventSource` and renders running totals.
 */
const DEFAULT_CATEGORY_URLS = [
  "https://store.playstation.com/tr-tr/category/d0446d4b-dc9a-4f1e-86ec-651f099c9b29",
  "https://store.playstation.com/tr-tr/category/30e3fe35-8f2d-4496-95bc-844f56952e3c",
  "https://store.playstation.com/tr-tr/category/3f772501-f6f8-49b7-abac-874a88ca4897",
  "https://store.playstation.com/tr-tr/category/e1699f77-77e1-43ca-a296-26d08abacb0f",
  "https://store.playstation.com/tr-tr/category/1d443305-2dcf-4543-8f7e-8c6ec409ecbf",
];

const DEFAULT_SEARCH_SEEDS = [
  "grand theft auto",
  "gta",
  "call of duty",
  "fifa",
  "ea sports fc",
  "nba 2k",
  "fortnite",
  "minecraft",
  "red dead",
  "cyberpunk",
  "the last of us",
  "god of war",
  "horizon",
  "uncharted",
  "ratchet",
  "gran turismo",
  "assassin",
  "resident evil",
  "mortal kombat",
  "tekken",
  "street fighter",
  "battlefield",
  "ghost of",
  "demon souls",
  "final fantasy",
  "persona",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const REQUEST_DELAY_MS = 200;

type ScrapedGame = {
  productId: string;
  title: string;
  imageUrl: string | null;
  productUrl: string | null;
  platform: string | null;
  productType: "GAME" | "ADDON" | "CURRENCY" | "OTHER";
  priceTryCents: number;
  discountTryCents: number | null;
};

function classify(raw: unknown): ScrapedGame["productType"] {
  if (raw == null) return "GAME";
  switch (raw) {
    case "FULL_GAME":
    case "GAME_BUNDLE":
    case "PREMIUM_EDITION":
      return "GAME";
    case "ADD_ON_PACK":
      return "ADDON";
    case "VIRTUAL_CURRENCY":
      return "CURRENCY";
    default:
      return "OTHER";
  }
}

function parseTryToCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function resolvePlatform(productId: string, platforms: unknown): string | null {
  if (Array.isArray(platforms) && platforms.length > 0) {
    const valid = platforms
      .map((p) => String(p))
      .filter((p): p is "PS4" | "PS5" => p === "PS4" || p === "PS5");
    if (valid.length > 0) {
      const ordered = (["PS5", "PS4"] as const).filter((p) => valid.includes(p));
      return ordered.join(",");
    }
  }
  if (productId.includes("PPSA")) return "PS5";
  if (productId.includes("CUSA")) return "PS4";
  return null;
}

function* walkProducts(node: unknown): Generator<Record<string, any>> {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkProducts(item);
    return;
  }
  const obj = node as Record<string, any>;
  if (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    obj.price &&
    typeof obj.price === "object"
  ) {
    yield obj;
  }
  for (const key of Object.keys(obj)) yield* walkProducts(obj[key]);
}

function extractFromHtml(html: string): ScrapedGame[] {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").contents().text();
  if (!raw) return [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: ScrapedGame[] = [];

  for (const product of walkProducts(data)) {
    if (seen.has(product.id)) continue;

    const basePrice = parseTryToCents(product.price?.basePrice);
    const discountPrice = parseTryToCents(product.price?.discountedPrice);
    if (basePrice == null) continue;

    const discountTryCents =
      discountPrice != null && discountPrice < basePrice ? discountPrice : null;

    const imageUrl =
      product.media?.find?.((m: any) => m?.role === "MASTER")?.url ??
      product.media?.[0]?.url ??
      null;

    const productId = String(product.id);
    seen.add(productId);
    out.push({
      productId,
      title: String(product.name).trim(),
      imageUrl: imageUrl ? String(imageUrl) : null,
      productUrl: `https://store.playstation.com/tr-tr/product/${productId}`,
      platform: resolvePlatform(productId, product.platforms),
      productType: classify(product.storeDisplayClassification),
      priceTryCents: basePrice,
      discountTryCents,
    });
  }

  return out;
}

async function fetchPage(url: string): Promise<ScrapedGame[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return extractFromHtml(await res.text());
  } catch {
    return [];
  }
}

function categoryPageUrl(base: string, page: number): string {
  const stripped = base.replace(/\/\d+\/?$/, "").replace(/\/$/, "");
  return `${stripped}/${page}`;
}

function searchUrl(seed: string): string {
  return `https://store.playstation.com/tr-tr/search/${encodeURIComponent(seed)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const urlsParam = url.searchParams.get("urls");
  const seedsParam = url.searchParams.get("seeds");
  const pagesParam = url.searchParams.get("pages");

  const categoryUrls = urlsParam
    ? urlsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_CATEGORY_URLS;

  const seeds = seedsParam
    ? [
        ...DEFAULT_SEARCH_SEEDS,
        ...seedsParam.split(",").map((s) => s.trim()).filter(Boolean),
      ]
    : DEFAULT_SEARCH_SEEDS;

  const maxPages = Math.max(1, Math.min(25, Number(pagesParam) || 10));

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(payload: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      }

      const run = await prisma.scrapeRun.create({ data: {} });

      try {
        emit({
          type: "start",
          runId: run.id,
          categoryUrls,
          seeds,
          maxPages,
          totalSources: categoryUrls.length + seeds.length,
        });

        const merged = new Map<string, ScrapedGame>();

        // Strategy 1: paginate category hubs.
        for (let i = 0; i < categoryUrls.length; i++) {
          const source = categoryUrls[i];
          let pagesFetched = 0;
          let added = 0;

          for (let page = 1; page <= maxPages; page++) {
            const games = await fetchPage(categoryPageUrl(source, page));
            pagesFetched++;
            if (games.length === 0) break;

            let pageAdded = 0;
            for (const g of games) {
              if (!merged.has(g.productId)) {
                merged.set(g.productId, g);
                pageAdded++;
              }
            }
            added += pageAdded;

            emit({
              type: "category",
              sourceIndex: i,
              url: source,
              page,
              foundOnPage: games.length,
              addedOnPage: pageAdded,
              totalSoFar: merged.size,
            });

            if (pageAdded === 0) break;
            if (page < maxPages) await sleep(REQUEST_DELAY_MS);
          }

          emit({
            type: "categoryDone",
            sourceIndex: i,
            url: source,
            pagesFetched,
            added,
            totalSoFar: merged.size,
          });
        }

        // Strategy 2: hit PS Store search for franchise seeds.
        for (let i = 0; i < seeds.length; i++) {
          const seed = seeds[i];
          const games = await fetchPage(searchUrl(seed));
          let seedAdded = 0;
          for (const g of games) {
            if (!merged.has(g.productId)) {
              merged.set(g.productId, g);
              seedAdded++;
            }
          }
          emit({
            type: "seed",
            seedIndex: i,
            seed,
            foundOnPage: games.length,
            added: seedAdded,
            totalSoFar: merged.size,
          });
          await sleep(REQUEST_DELAY_MS);
        }

        if (merged.size === 0) {
          const msg =
            "No products extracted. The PS Store markup may have changed.";
          await prisma.scrapeRun.update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              error: msg,
            },
          });
          emit({ type: "error", error: msg });
          controller.close();
          return;
        }

        // Phase 3: upsert.
        const total = merged.size;
        let upserts = 0;
        emit({ type: "upsertStart", total });

        for (const g of merged.values()) {
          await prisma.game.upsert({
            where: { productId: g.productId },
            create: {
              productId: g.productId,
              title: g.title,
              imageUrl: g.imageUrl,
              productUrl: g.productUrl,
              platform: g.platform,
              productType: g.productType,
              priceTryCents: g.priceTryCents,
              discountTryCents: g.discountTryCents,
              isActive: true,
              lastScrapedAt: new Date(),
            },
            update: {
              title: g.title,
              imageUrl: g.imageUrl,
              productUrl: g.productUrl,
              platform: g.platform,
              productType: g.productType,
              priceTryCents: g.priceTryCents,
              discountTryCents: g.discountTryCents,
              isActive: true,
              lastScrapedAt: new Date(),
            },
          });
          upserts++;
          if (upserts % 25 === 0 || upserts === total) {
            emit({ type: "upsertProgress", done: upserts, total });
          }
        }

        await prisma.scrapeRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            scrapedCount: total,
            upsertedCount: upserts,
          },
        });

        emit({ type: "done", scraped: total, upserts });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        try {
          await prisma.scrapeRun.update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              error: msg,
            },
          });
        } catch {}
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
      "X-Accel-Buffering": "no",
    },
  });
}
