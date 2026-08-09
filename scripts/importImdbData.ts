/**
 * IMDb rəsmi datasetlərindən reytinq + çoxdilli ad idxalı — LOKAL runner.
 *
 *   npm run import:imdb                # hər ikisi
 *   npm run import:imdb -- --skip-akas # yalnız reytinqlər (sürətli, ~20MB)
 *   npm run import:imdb -- --dry-run   # DB-yə yazmadan statistika
 *
 * Niyə script (API route yox)? — `title.akas.tsv.gz` ~350MB endirilir və
 * açılmış halda ~2GB-dır; heç bir HTTP route-un vaxt limitinə sığmır. Buna
 * görə bu, gecə cron-u və ya əl ilə işə salınan backfill-dir.
 *
 * YADDAŞ: fayllar TAM oxunmur — gunzip + readline ilə sətir-sətir axıdılır və
 * yalnız BİZİM IMDb ID-lərimizə aid sətirlər yaddaşda saxlanılır (~1800 başlıq).
 * Faylı `JSON.parse`/`readFile` ilə oxumaq 4GB serverdə prosesi öldürərdi.
 *
 * Təkrar işə salmaq ucuzdur: `IMDB_DATASET_DIR` təyin olunsa fayllar oraya
 * endirilir və növbəti dəfə şəbəkəyə çıxılmır.
 */

import "dotenv/config";
import { createGunzip } from "node:zlib";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import readline from "node:readline";
import { prisma } from "@/lib/prisma";
import {
  parseAkaLine,
  parseHeader,
  parseRatingLine,
  pickNames,
  type AkaRow,
} from "@/lib/imdbDatasets";

const BASE_URL = "https://datasets.imdbws.com";
const RATINGS_FILE = "title.ratings.tsv.gz";
const AKAS_FILE = "title.akas.tsv.gz";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_AKAS = args.includes("--skip-akas");
const SKIP_RATINGS = args.includes("--skip-ratings");
const CACHE_DIR = process.env.IMDB_DATASET_DIR ?? null;

/** Bizim kataloqdakı bir başlıq — IMDb ID üzrə qruplanır. */
interface TargetTitle {
  id: string;
  originalLanguage: string | null;
}

function log(msg: string): void {
  console.log(`${new Date().toISOString().slice(11, 19)}  ${msg}`);
}

/**
 * Dataset faylını sətir-sətir oxuyur.
 *
 * `CACHE_DIR` varsa fayl oradan oxunur (yoxdursa əvvəlcə ora endirilir) —
 * beləcə skript ikinci dəfə işə salınanda 350MB yenidən çəkilmir.
 */
async function* datasetLines(fileName: string): AsyncGenerator<string> {
  let source: NodeJS.ReadableStream;

  if (CACHE_DIR) {
    mkdirSync(CACHE_DIR, { recursive: true });
    const localPath = path.join(CACHE_DIR, fileName);
    if (!existsSync(localPath)) {
      log(`${fileName} endirilir → ${localPath}`);
      const res = await fetch(`${BASE_URL}/${fileName}`);
      if (!res.ok || !res.body) throw new Error(`${fileName} endirilmədi (HTTP ${res.status})`);
      // Yarımçıq endirmə "keşlənmiş fayl" kimi qalmasın deyə əvvəlcə .part-a
      // yazılır, yalnız uğurla bitəndə adı dəyişilir.
      const partPath = `${localPath}.part`;
      await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(partPath));
      const { rename } = await import("node:fs/promises");
      await rename(partPath, localPath);
      log(`${fileName} endirildi`);
    } else {
      log(`${fileName} keşdən oxunur (${localPath})`);
    }
    source = createReadStream(localPath);
  } else {
    log(`${fileName} axıdılır (keş yoxdur — IMDB_DATASET_DIR təyin et)`);
    const res = await fetch(`${BASE_URL}/${fileName}`);
    if (!res.ok || !res.body) throw new Error(`${fileName} endirilmədi (HTTP ${res.status})`);
    source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  }

  const rl = readline.createInterface({
    input: source.pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of rl) yield line;
}

/** İşləri `size` ölçülü paketlərlə paralel icra edir (persist.ts ilə eyni üsul). */
async function runChunked<T>(items: T[], size: number, fn: (t: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function main(): Promise<void> {
  log(`IMDb idxalı başladı${DRY_RUN ? " (DRY RUN — DB-yə yazılmır)" : ""}`);

  // ── 1. Hədəf başlıqlar: IMDb ID-si olanlar ────────────────────────────────
  const rows = await prisma.streamingTitle.findMany({
    where: { externalId: { startsWith: "tt" } },
    select: { id: true, externalId: true, originalLanguage: true },
  });

  // Eyni IMDb ID birdən çox StreamingTitle sətrinə düşə bilər (IMDb-siz
  // yaranmış köhnə dublikatlar sonradan eyni ID ala bilər), ona görə map
  // dəyəri massivdir — hamısı eyni reytinq/adları alır.
  const byImdb = new Map<string, TargetTitle[]>();
  for (const r of rows) {
    const key = r.externalId as string;
    const list = byImdb.get(key);
    const entry = { id: r.id, originalLanguage: r.originalLanguage };
    if (list) list.push(entry);
    else byImdb.set(key, [entry]);
  }
  log(`Kataloqda IMDb ID-li ${rows.length} başlıq (${byImdb.size} unikal tconst)`);

  if (byImdb.size === 0) {
    log("IMDb ID-li başlıq yoxdur — əvvəlcə scrape işlət. Çıxılır.");
    return;
  }

  // ── 2. Reytinqlər ─────────────────────────────────────────────────────────
  if (!SKIP_RATINGS) {
    const updates: Array<{ id: string; imdbRating: number; imdbVotes: number }> = [];
    let scanned = 0;
    let cols: Record<string, number> | null = null;

    for await (const line of datasetLines(RATINGS_FILE)) {
      if (cols === null) {
        cols = parseHeader(line);
        continue;
      }
      scanned++;
      // Parse etməzdən ƏVVƏL ucuz yoxlama: sətrin ilk xanası bizim ID-dirmi?
      // 1.6M sətrin ~%99.9-u bizə aid deyil, hər birini parse etmək israfdır.
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const targets = byImdb.get(line.slice(0, tab));
      if (!targets) continue;

      const parsed = parseRatingLine(line, cols);
      if (!parsed) continue;
      for (const t of targets) {
        updates.push({ id: t.id, imdbRating: parsed.averageRating, imdbVotes: parsed.numVotes });
      }
    }

    log(`Reytinq: ${scanned} sətir tarandı, ${updates.length} başlıq uyğunlaşdı`);
    if (!DRY_RUN && updates.length > 0) {
      await runChunked(updates, 25, (u) =>
        prisma.streamingTitle.update({
          where: { id: u.id },
          data: { imdbRating: u.imdbRating, imdbVotes: u.imdbVotes },
        })
      );
      log(`Reytinq: ${updates.length} sətir yeniləndi`);
    }
  }

  // ── 3. Çoxdilli adlar ─────────────────────────────────────────────────────
  if (!SKIP_AKAS) {
    const akasByTitle = new Map<string, AkaRow[]>();
    let scanned = 0;
    let cols: Record<string, number> | null = null;

    for await (const line of datasetLines(AKAS_FILE)) {
      if (cols === null) {
        cols = parseHeader(line);
        continue;
      }
      scanned++;
      if (scanned % 5_000_000 === 0) log(`  ...${(scanned / 1_000_000).toFixed(0)}M aka sətri tarandı`);

      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const tconst = line.slice(0, tab);
      if (!byImdb.has(tconst)) continue;

      const parsed = parseAkaLine(line, cols);
      if (!parsed) continue;
      const list = akasByTitle.get(tconst);
      if (list) list.push(parsed);
      else akasByTitle.set(tconst, [parsed]);
    }

    log(`Ad: ${scanned} sətir tarandı, ${akasByTitle.size} başlıq üçün aka tapıldı`);

    // Hər başlıq üçün yekun adları seç.
    const perTitle: Array<{ titleId: string; names: ReturnType<typeof pickNames> }> = [];
    const langCounts = new Map<string, number>();
    for (const [tconst, akas] of akasByTitle) {
      for (const target of byImdb.get(tconst) ?? []) {
        const names = pickNames(akas, target.originalLanguage);
        if (names.length === 0) continue;
        perTitle.push({ titleId: target.id, names });
        for (const n of names) langCounts.set(n.lang, (langCounts.get(n.lang) ?? 0) + 1);
      }
    }

    const totalNames = perTitle.reduce((sum, t) => sum + t.names.length, 0);
    const top = [...langCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    log(`Ad: ${perTitle.length} başlıq üçün ${totalNames} ad seçildi`);
    log(`  dil üzrə: ${top.map(([l, c]) => `${l}=${c}`).join(", ")}`);

    if (!DRY_RUN && perTitle.length > 0) {
      // Köhnə IMDB_AKAS sətirlərini silib yenidən yazırıq — dataset yeniləndikdə
      // artıq keçərli olmayan ad DB-də qalmasın. MANUAL/TMDB mənbəli adlara
      // toxunulmur (admin əl düzəlişi idxalla silinməməlidir).
      // Paralellik 10-dur (reytinqdəki 25 yox) — burada hər iş bir TRANZAKSİYA
      // tutur və connection pool kiçikdirsə (məs. pgbouncer `connection_limit=1`)
      // növbədə qalan işlər Prisma-nın pool timeout-una düşə bilər.
      await runChunked(perTitle, 10, async (t) => {
        await prisma.$transaction([
          prisma.streamingTitleName.deleteMany({
            where: { titleId: t.titleId, source: "IMDB_AKAS" },
          }),
          prisma.streamingTitleName.createMany({
            data: t.names.map((n) => ({
              titleId: t.titleId,
              lang: n.lang,
              name: n.name,
              isOriginal: n.isOriginal,
              source: "IMDB_AKAS",
            })),
            skipDuplicates: true,
          }),
        ]);
      });
      log(`Ad: ${totalNames} sətir yazıldı`);
    }
  }

  log("Bitdi.");
}

main()
  .catch((err) => {
    console.error("İdxal sındı:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
