import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateEpicGames } from "@/lib/revalidate";
import {
  fetchEpicCatalog,
  epicProductId,
  type EpicCatalogItem,
} from "@/lib/epicStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scrapes the Epic Games Store catalog into the shared Game table.
 *
 * Two passes over Epic's GraphQL `searchStoreQuery`:
 *   1. `country=TR, locale=tr` → TRY prices (our cost basis, mirrors PS Store).
 *   2. `country=AZ, locale=en` → USD prices (what an Azerbaijani buyer sees on
 *      Epic directly; stored for the dual-currency sale logic decided later).
 *
 * Merged by `namespace:offerId`. A row needs a TRY price to be created, since
 * the v1 display price is still computed off `priceTryCents`. Progress streams
 * as Server-Sent Events, same as the PS Store scraper.
 */

type MergedEpicGame = {
  productId: string;
  namespace: string;
  title: string;
  imageUrl: string | null;
  heroImageUrl: string | null;
  productUrl: string | null;
  effectiveDate: string | null;
  genres: string[];
  priceTryCents: number | null;
  discountTryCents: number | null;
  discountEndAt: Date | null;
  priceUsdCents: number | null;
  discountUsdCents: number | null;
};

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

  let maxPages: number;
  try {
    const url = new URL(req.url);
    const pagesParam = url.searchParams.get("pages");
    maxPages = Math.max(1, Math.min(500, Number(pagesParam) || 200));
  } catch {
    maxPages = 200;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(payload: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
      }

      const runStartedAt = new Date();
      let run: { id: string } | null = null;

      try {
        try {
          run = await prisma.scrapeRun.create({
            data: { kind: "EPIC_GAMES" },
          });
        } catch (dbErr) {
          const msg = dbErr instanceof Error ? dbErr.message : "DB error";
          console.error("scrape-epic: scrapeRun.create failed", dbErr);
          emit({ type: "error", error: `DB xətası: ${msg}` });
          controller.close();
          return;
        }

        emit({ type: "start", runId: run.id, maxPages });

        const merged = new Map<string, MergedEpicGame>();

        const ensure = (item: EpicCatalogItem): MergedEpicGame => {
          const productId = epicProductId(item.namespace, item.offerId);
          let row = merged.get(productId);
          if (!row) {
            row = {
              productId,
              namespace: item.namespace,
              title: item.title,
              imageUrl: item.imageUrl,
              heroImageUrl: item.heroImageUrl,
              productUrl: item.productUrl,
              effectiveDate: item.effectiveDate,
              genres: item.genres,
              priceTryCents: null,
              discountTryCents: null,
              discountEndAt: null,
              priceUsdCents: null,
              discountUsdCents: null,
            };
            merged.set(productId, row);
          }
          // Backfill media/title/genres from whichever pass has it.
          row.title ||= item.title;
          row.imageUrl ??= item.imageUrl;
          row.heroImageUrl ??= item.heroImageUrl;
          row.productUrl ??= item.productUrl;
          row.effectiveDate ??= item.effectiveDate;
          if (row.genres.length === 0 && item.genres.length > 0) {
            row.genres = item.genres;
          }
          return row;
        };

        // Pass 1 — Türkiye / TRY (cost basis).
        emit({ type: "regionStart", region: "TR", currency: "TRY" });
        const trItems = await fetchEpicCatalog({
          country: "TR",
          locale: "tr",
          maxPages,
          onPage: ({ page, fetched, total }) =>
            emit({ type: "regionPage", region: "TR", page, fetched, total }),
        });
        for (const item of trItems) {
          const row = ensure(item);
          if (item.price) {
            row.priceTryCents = item.price.originalCents;
            row.discountTryCents = item.price.discountCents;
            row.discountEndAt = item.price.discountEndAt;
          }
        }
        emit({ type: "regionDone", region: "TR", count: trItems.length });

        // Pass 2 — Azərbaycan / USD (reference price).
        emit({ type: "regionStart", region: "AZ", currency: "USD" });
        const azItems = await fetchEpicCatalog({
          country: "AZ",
          locale: "en",
          maxPages,
          onPage: ({ page, fetched, total }) =>
            emit({ type: "regionPage", region: "AZ", page, fetched, total }),
        });
        for (const item of azItems) {
          const row = ensure(item);
          if (item.price) {
            row.priceUsdCents = item.price.originalCents;
            row.discountUsdCents = item.price.discountCents;
          }
        }
        emit({ type: "regionDone", region: "AZ", count: azItems.length });

        // Only rows with a TRY price are persisted — v1 prices off priceTryCents.
        const persistable = [...merged.values()].filter(
          (g): g is MergedEpicGame & { priceTryCents: number } =>
            g.priceTryCents != null && g.priceTryCents > 0
        );
        const skippedNoTry = merged.size - persistable.length;

        if (persistable.length === 0) {
          const msg =
            "Heç bir Epic məhsulu çəkilmədi (TRY qiyməti tapılmadı). API dəyişmiş ola bilər.";
          await prisma.scrapeRun.update({
            where: { id: run.id },
            data: { status: "FAILED", finishedAt: new Date(), error: msg },
          });
          emit({ type: "error", error: msg });
          controller.close();
          return;
        }

        // Upsert — chunked Promise.allSettled, same shape as the PS scraper.
        const total = persistable.length;
        let upserts = 0;
        let upsertFailures = 0;
        emit({ type: "upsertStart", total, skippedNoTry });

        const UPSERT_CHUNK = 10;
        for (let i = 0; i < persistable.length; i += UPSERT_CHUNK) {
          const chunk = persistable.slice(i, i + UPSERT_CHUNK);
          const results = await Promise.allSettled(
            chunk.map((g) => {
              const data = {
                title: g.title,
                imageUrl: g.imageUrl,
                productUrl: g.productUrl,
                store: "EPIC",
                namespace: g.namespace,
                genres: g.genres,
                platform: "PC",
                productType: "GAME",
                priceTryCents: g.priceTryCents,
                discountTryCents: g.discountTryCents,
                discountEndAt: g.discountEndAt,
                priceUsdCents: g.priceUsdCents,
                discountUsdCents: g.discountUsdCents,
                heroImageUrl: g.heroImageUrl,
                isActive: true,
                lastScrapedAt: new Date(),
              };
              return prisma.game.upsert({
                where: { productId: g.productId },
                create: { productId: g.productId, ...data },
                update: data,
              });
            })
          );
          for (const r of results) {
            if (r.status === "fulfilled") upserts++;
            else {
              upsertFailures++;
              console.error("scrape-epic: upsert failed", r.reason);
            }
          }
          emit({
            type: "upsertProgress",
            done: upserts,
            total,
            failures: upsertFailures,
          });
        }

        // Clear stale discounts on Epic rows the same way the PS scraper does:
        //   (a) discounts whose end date has passed.
        //   (b) discounts with no end date that this run did not refresh.
        const cleanupAt = new Date();
        try {
          const expired = await prisma.game.updateMany({
            where: {
              store: "EPIC",
              isActive: true,
              discountTryCents: { not: null },
              discountEndAt: { lt: cleanupAt },
            },
            data: { discountTryCents: null, discountEndAt: null },
          });
          const orphan = await prisma.game.updateMany({
            where: {
              store: "EPIC",
              isActive: true,
              discountTryCents: { not: null },
              discountEndAt: null,
              lastScrapedAt: { lt: runStartedAt },
            },
            data: { discountTryCents: null },
          });
          emit({
            type: "discountCleanup",
            expired: expired.count,
            orphaned: orphan.count,
          });
        } catch (e) {
          console.error("scrape-epic: discount cleanup failed", e);
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
          revalidateEpicGames();
        } catch (e) {
          console.error("scrape-epic: revalidate failed", e);
        }

        emit({ type: "done", scraped: total, upserts, skippedNoTry });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("scrape-epic: stream failed", err);
        if (run) {
          try {
            await prisma.scrapeRun.update({
              where: { id: run.id },
              data: { status: "FAILED", finishedAt: new Date(), error: msg },
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
