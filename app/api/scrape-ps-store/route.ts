import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateGames } from "@/lib/revalidate";
import { sendFavoriteOnSaleEmail } from "@/lib/resend";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  discountEndAt: Date | null;
  heroImageUrl: string | null;
  trailerUrl: string | null;
  screenshots: string[];
  editionLabel: string | null;
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

type RawProduct = {
  id: string;
  name: string;
  price?: { basePrice?: unknown; discountedPrice?: unknown };
  media?: Array<{ role?: string; type?: string; url?: string }>;
  platforms?: unknown;
  storeDisplayClassification?: unknown;
  localizedStoreDisplayClassification?: unknown;
  [key: string]: unknown;
};

function* walkProducts(node: unknown): Generator<RawProduct> {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkProducts(item);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    obj.price &&
    typeof obj.price === "object"
  ) {
    yield obj as RawProduct;
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

    const media = Array.isArray(product.media) ? product.media : [];
    const findMedia = (role: string, type?: string) =>
      media.find((m) => m?.role === role && (!type || m?.type === type))?.url;

    const imageUrl =
      findMedia("MASTER", "IMAGE") ??
      findMedia("MASTER") ??
      media[0]?.url ??
      null;
    const heroImageUrl =
      findMedia("BACKGROUND", "IMAGE") ??
      findMedia("BACKGROUND") ??
      null;
    const trailerUrl = findMedia("PREVIEW", "VIDEO") ?? findMedia("PREVIEW") ?? null;

    // Collect supplemental screenshots: any IMAGE-role media that isn't the hero
    // or the master cover, deduped.
    const usedUrls = new Set([imageUrl, heroImageUrl].filter(Boolean) as string[]);
    const screenshots: string[] = [];
    for (const m of media) {
      if (!m?.url || m.type !== "IMAGE") continue;
      if (usedUrls.has(m.url)) continue;
      usedUrls.add(m.url);
      screenshots.push(String(m.url));
    }

    const editionLabel =
      typeof product.localizedStoreDisplayClassification === "string"
        ? product.localizedStoreDisplayClassification
        : null;

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
      discountEndAt: null,
      heroImageUrl: heroImageUrl ? String(heroImageUrl) : null,
      trailerUrl: trailerUrl ? String(trailerUrl) : null,
      screenshots,
      editionLabel,
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

/**
 * Fetches a single product page and extracts the discount end timestamp.
 *
 * A product page lists multiple offer rows (base SKU, deluxe edition, EA Play
 * subscription discount, …). Each row carries its own `priceOrText` and
 * `offerAvailability`. We pick the row whose price matches the discounted
 * price we already scraped from the listing — that's the offer the storefront
 * is actually showing the user. If nothing matches exactly, fall back to the
 * earliest end date (most-likely the active sale, not a long-lived sub price).
 */
async function fetchProductDiscountEnd(
  productId: string,
  discountTryCents: number
): Promise<Date | null> {
  try {
    const res = await fetch(
      `https://store.playstation.com/tr-tr/product/${encodeURIComponent(productId)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const html = await res.text();

    type Candidate = { priceCents: number | null; iso: string };
    const candidates: Candidate[] = [];

    // priceOrText and offerAvailability live in the same offer object, ~100
    // chars apart. The non-greedy gap caps runaway matches.
    const pairRe =
      /"priceOrText"\s*:\s*"([^"]*)"[\s\S]{0,400}?"offerAvailability"\s*:\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(html)) !== null) {
      candidates.push({ priceCents: parseTryToCents(m[1]), iso: m[2] });
    }

    const toDate = (iso: string): Date | null => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    if (candidates.length > 0) {
      const exact = candidates.find((c) => c.priceCents === discountTryCents);
      if (exact) return toDate(exact.iso);
      // Prefer the soonest end among future candidates — sale offers expire
      // before subscription tiers in practice.
      const now = Date.now();
      const future = candidates
        .map((c) => toDate(c.iso))
        .filter((d): d is Date => d != null && d.getTime() > now)
        .sort((a, b) => a.getTime() - b.getTime());
      if (future.length > 0) return future[0];
    }

    // Last-ditch fallback: any standalone offerAvailability or endTime.
    const isoMatch = html.match(/"offerAvailability"\s*:\s*"([^"]+)"/);
    if (isoMatch) {
      const d = toDate(isoMatch[1]);
      if (d) return d;
    }
    const tsMatch = html.match(/"endTime"\s*:\s*"?(\d{10,13})"?/);
    if (tsMatch) {
      const ms = Number(tsMatch[1]);
      if (Number.isFinite(ms) && ms > 0) {
        const date = new Date(tsMatch[1].length >= 13 ? ms : ms * 1000);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
    return null;
  } catch {
    return null;
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Forbidden" ? 403 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let categoryUrls: string[];
  let seeds: string[];
  let maxPages: number;
  try {
    const url = new URL(req.url);
    const urlsParam = url.searchParams.get("urls");
    const seedsParam = url.searchParams.get("seeds");
    const pagesParam = url.searchParams.get("pages");

    categoryUrls = urlsParam
      ? urlsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_CATEGORY_URLS;

    seeds = seedsParam
      ? [
          ...DEFAULT_SEARCH_SEEDS,
          ...seedsParam.split(",").map((s) => s.trim()).filter(Boolean),
        ]
      : DEFAULT_SEARCH_SEEDS;

    maxPages = Math.max(1, Math.min(25, Number(pagesParam) || 10));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bad request";
    console.error("scrape-ps-store: param parse failed", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(payload: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      }

      // Captured before any DB writes so the post-upsert cleanup can identify
      // rows that this run did NOT touch (lastScrapedAt < runStartedAt).
      const runStartedAt = new Date();

      let run: { id: string } | null = null;
      try {
        try {
          run = await prisma.scrapeRun.create({ data: {} });
        } catch (dbErr) {
          const msg = dbErr instanceof Error ? dbErr.message : "DB error";
          console.error("scrape-ps-store: scrapeRun.create failed", dbErr);
          emit({ type: "error", error: `DB xətası: ${msg}` });
          controller.close();
          return;
        }

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

        // Phase 2.5: fetch discount end dates for discounted products.
        // Parallelize with a small concurrency cap — sequential fetches would
        // take 10+ minutes for a few hundred discounted SKUs.
        const discounted = [...merged.values()].filter(
          (g): g is ScrapedGame & { discountTryCents: number } =>
            g.discountTryCents != null
        );
        if (discounted.length > 0) {
          emit({ type: "discountEndStart", total: discounted.length });
          const CONCURRENCY = 6;
          let done = 0;
          let cursor = 0;

          async function worker() {
            while (true) {
              const idx = cursor++;
              if (idx >= discounted.length) return;
              const g = discounted[idx];
              const end = await fetchProductDiscountEnd(
                g.productId,
                g.discountTryCents
              );
              if (end) g.discountEndAt = end;
              done++;
              if (done % 10 === 0 || done === discounted.length) {
                emit({
                  type: "discountEndProgress",
                  done,
                  total: discounted.length,
                });
              }
            }
          }

          await Promise.all(
            Array.from({ length: Math.min(CONCURRENCY, discounted.length) }, () =>
              worker()
            )
          );
        }

        // Snapshot pre-upsert discount state so we can detect "newly on sale"
        // transitions and email favoriters once the upsert lands. Map keyed by
        // productId — value is the previous discountTryCents (null = not on sale).
        const productIds = [...merged.keys()];
        const prevDiscountByProductId = new Map<string, number | null>();
        let snapshotOk = false;
        try {
          const existing = await prisma.game.findMany({
            where: { productId: { in: productIds } },
            select: { productId: true, discountTryCents: true },
          });
          for (const row of existing) {
            prevDiscountByProductId.set(row.productId, row.discountTryCents);
          }
          snapshotOk = true;
        } catch (e) {
          // Skip favorite notifications when we can't tell what changed —
          // otherwise the next scrape would email everyone for every active sale.
          console.error("scrape-ps-store: pre-upsert snapshot failed", e);
        }

        // Phase 3: upsert. Chunked Promise.allSettled — pipelines multiple
        // round-trips against Supabase at once (sequential awaits made this
        // phase the bottleneck) and a single bad row no longer stalls the run.
        const total = merged.size;
        let upserts = 0;
        let upsertFailures = 0;
        emit({ type: "upsertStart", total });

        const UPSERT_CHUNK = 10;
        const all = [...merged.values()];

        for (let i = 0; i < all.length; i += UPSERT_CHUNK) {
          const chunk = all.slice(i, i + UPSERT_CHUNK);
          const results = await Promise.allSettled(
            chunk.map((g) =>
              prisma.game.upsert({
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
                  discountEndAt: g.discountEndAt,
                  heroImageUrl: g.heroImageUrl,
                  trailerUrl: g.trailerUrl,
                  screenshots: g.screenshots,
                  editionLabel: g.editionLabel,
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
                  discountEndAt: g.discountEndAt,
                  heroImageUrl: g.heroImageUrl,
                  trailerUrl: g.trailerUrl,
                  screenshots: g.screenshots,
                  editionLabel: g.editionLabel,
                  isActive: true,
                  lastScrapedAt: new Date(),
                },
              })
            )
          );

          for (const r of results) {
            if (r.status === "fulfilled") upserts++;
            else {
              upsertFailures++;
              console.error("scrape-ps-store: upsert failed", r.reason);
            }
          }

          emit({ type: "upsertProgress", done: upserts, total, failures: upsertFailures });
        }

        // Phase 3.5: clear stale discount rows.
        // The upsert only writes products this run actually found. When a sale
        // ends, the SKU typically also drops out of the "Deals" hub and any
        // franchise search seeds, so its row is never revisited and the old
        // `discountTryCents` lingers. Two cleanup passes:
        //   (a) any active row whose `discountEndAt` is now in the past — the
        //       sale window has definitively closed.
        //   (b) any active row with a discount and NULL end date that this run
        //       did NOT refresh. We just did a wide scrape; if a discount were
        //       still live, the SKU would normally have surfaced somewhere.
        //       False-positive cost: a brief missing badge until the next run
        //       touches the row, vs. showing a phantom sale forever.
        const cleanupAt = new Date();
        try {
          const expiredCleanup = await prisma.game.updateMany({
            where: {
              isActive: true,
              discountTryCents: { not: null },
              discountEndAt: { lt: cleanupAt },
            },
            data: { discountTryCents: null, discountEndAt: null },
          });
          const orphanCleanup = await prisma.game.updateMany({
            where: {
              isActive: true,
              discountTryCents: { not: null },
              discountEndAt: null,
              lastScrapedAt: { lt: runStartedAt },
            },
            data: { discountTryCents: null },
          });
          emit({
            type: "discountCleanup",
            expired: expiredCleanup.count,
            orphaned: orphanCleanup.count,
          });
        } catch (e) {
          console.error("scrape-ps-store: discount cleanup failed", e);
          emit({
            type: "discountCleanupError",
            error: e instanceof Error ? e.message : "cleanup error",
          });
        }

        // Phase 4: favorite-on-sale email notifications.
        // Collect productIds that transitioned from no-discount → discount in
        // this scrape run (a fresh sale). Skip entirely if we couldn't take a
        // pre-upsert snapshot — otherwise we'd email everyone for every
        // already-active sale.
        const newlyDiscounted = snapshotOk
          ? all.filter((g) => {
              if (g.discountTryCents == null) return false;
              const prev = prevDiscountByProductId.get(g.productId);
              // prev === null   → existed but had no discount → now on sale
              // prev undefined  → brand-new productId → no favoriters yet, but
              //                   still classified as new for consistency
              return prev == null;
            })
          : [];

        if (newlyDiscounted.length > 0) {
          emit({ type: "favoriteNotifyStart", total: newlyDiscounted.length });
          let notified = 0;
          let failed = 0;

          let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
          try {
            settings = await getSettings();
          } catch (e) {
            console.error("scrape-ps-store: getSettings failed", e);
          }

          if (settings) {
            // Pull the just-upserted Game rows so we have their internal `id`s
            // (Favorite is keyed on Game.id, not productId) and the discount
            // window timestamp.
            const dbGames = await prisma.game.findMany({
              where: {
                productId: { in: newlyDiscounted.map((g) => g.productId) },
              },
              select: {
                id: true,
                productId: true,
                title: true,
                imageUrl: true,
                priceTryCents: true,
                discountTryCents: true,
                discountEndAt: true,
              },
            });

            for (const game of dbGames) {
              try {
                if (game.discountTryCents == null) continue;

                const favRows = await prisma.favorite.findMany({
                  where: { gameId: game.id },
                  select: {
                    userId: true,
                    user: {
                      select: { id: true, email: true, name: true },
                    },
                  },
                });
                if (favRows.length === 0) continue;

                const display = computeDisplayPrice(game, settings);
                // Use discountEndAt if available, otherwise the run's start
                // time, as the dedup key — a future sale on the same SKU will
                // have a different end date and re-notify.
                const discountStartedAt = game.discountEndAt ?? new Date();

                for (const f of favRows) {
                  if (!f.user?.email) continue;
                  try {
                    // Dedup row blocks duplicate emails for the same sale window.
                    await prisma.favoriteNotification.create({
                      data: {
                        userId: f.userId,
                        gameId: game.id,
                        discountStartedAt,
                      },
                    });
                  } catch {
                    // Unique constraint hit → already notified for this sale.
                    continue;
                  }

                  try {
                    await sendFavoriteOnSaleEmail({
                      email: f.user.email,
                      userName:
                        f.user.name?.split(" ")[0] ??
                        f.user.email.split("@")[0],
                      productTitle: game.title,
                      productId: game.productId,
                      finalAzn: display.finalAzn,
                      originalAzn: display.originalAzn,
                      discountPct: display.discountPct,
                      discountEndAt: game.discountEndAt,
                      imageUrl: game.imageUrl,
                    });
                    notified++;
                  } catch (e) {
                    failed++;
                    console.error(
                      "scrape-ps-store: favorite email send failed",
                      e
                    );
                  }
                }
              } catch (e) {
                console.error(
                  "scrape-ps-store: favorite notify per-game failed",
                  e
                );
              }
            }
          }

          emit({
            type: "favoriteNotifyDone",
            notified,
            failed,
            games: newlyDiscounted.length,
          });
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

        try {
          revalidateGames();
        } catch (e) {
          console.error("scrape-ps-store: revalidate failed", e);
        }

        emit({ type: "done", scraped: total, upserts });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("scrape-ps-store: stream failed", err);
        if (run) {
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
        }
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
