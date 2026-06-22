/**
 * Supabase 402 OLSA BELƏ — mövcud şəkilləri LOKAL Next image keşindən
 * (.next/cache/images) bərpa edib R2-yə köçürür və DB URL-lərini yeniləyir.
 *
 * Necə işləyir: yerli dev server (default http://localhost:3003) optimizer-i bu
 * şəkilləri əvvəllər (kota dolmazdan qabaq) keşləyib. Skript hər DB şəkli üçün
 * yerli optimizer-dən müxtəlif en (width) sınayır; keşdə olan ən böyük variantı
 * götürüb R2-yə yükləyir (Supabase-ə HEÇ sorğu getmir → 402 maneə deyil).
 *
 * ƏVVƏLCƏ: dev server işləməlidir (npm run dev), R2 env qurulmalıdır.
 *
 * İSTİFADƏ:
 *   npx tsx scripts/recover-images-from-cache.ts --dry          # neçəsi bərpa oluna bilər
 *   npx tsx scripts/recover-images-from-cache.ts                # bərpa et + R2 + DB yenilə
 *   LOCAL_BASE=http://localhost:3003 npx tsx scripts/recover-images-from-cache.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const DRY = process.argv.includes("--dry");
const LOCAL_BASE = (process.env.LOCAL_BASE || "http://localhost:3003").replace(/\/$/, "");

const WIDTHS = [3840, 2048, 1920, 1200, 1080, 828, 750, 640, 384, 256, 128, 96, 64, 48, 32, 16];
const ACCEPTS = ["image/avif,image/webp,*/*", "image/webp,*/*"];
// next/image default quality 75 — keş bu açarla yazılıb. Digərləri fallback.
const QUALITIES = [75, 90, 100, 50];

const TARGETS: { model: string; field: string }[] = [
  { model: "game", field: "imageUrl" },
  { model: "game", field: "heroImageUrl" },
  { model: "collection", field: "imageUrl" },
  { model: "serviceProduct", field: "imageUrl" },
  { model: "banner", field: "imageUrl" },
  { model: "banner", field: "mobileImageUrl" },
  { model: "categoryAsset", field: "imageUrl" },
  { model: "streamingPlatform", field: "heroImageUrl" },
  { model: "streamingTitle", field: "posterUrl" },
  { model: "streamingTitle", field: "backdropUrl" },
  { model: "newsArticle", field: "coverImageUrl" },
];

const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

function r2KeyFromSupabaseUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Yerli optimizer keşindən şəkli bərpa et (ən böyük mövcud en). */
async function fetchFromLocalCache(
  url: string,
): Promise<{ bytes: Buffer; contentType: string; width: number } | null> {
  const enc = encodeURIComponent(url);
  for (const accept of ACCEPTS) {
    for (const w of WIDTHS) {
      for (const q of QUALITIES) {
        try {
          const r = await fetch(`${LOCAL_BASE}/_next/image?url=${enc}&w=${w}&q=${q}`, {
            headers: { Accept: accept },
          });
          if (r.ok) {
            const ct = r.headers.get("content-type") || "image/webp";
            const bytes = Buffer.from(await r.arrayBuffer());
            if (bytes.length > 0) return { bytes, contentType: ct, width: w };
          }
        } catch {
          /* keç */
        }
      }
    }
  }
  return null;
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { isR2Configured, putR2Object, r2PublicUrl } = await import("@/lib/r2");

  if (!DRY && !isR2Configured()) {
    console.error("✗ R2 env qurulmayıb.");
    process.exit(1);
  }
  // dev server yoxlaması
  try {
    const ping = await fetch(`${LOCAL_BASE}/`);
    if (!ping.ok) throw new Error(String(ping.status));
  } catch {
    console.error(`✗ Yerli dev server əlçatan deyil: ${LOCAL_BASE} (npm run dev işə salın)`);
    process.exit(1);
  }
  console.log(`LOCAL_BASE=${LOCAL_BASE} | supabase=${SUPABASE_HOST} | DRY=${DRY}\n`);

  const db = prisma as unknown as Record<string, {
    findMany: (a: unknown) => Promise<Array<Record<string, string>>>;
    update: (a: unknown) => Promise<unknown>;
  }>;

  let recovered = 0, failed = 0, scanned = 0;
  const notRecovered: string[] = [];

  for (const { model, field } of TARGETS) {
    let rows: Array<Record<string, string>> = [];
    try {
      rows = await db[model].findMany({
        where: { [field]: { contains: SUPABASE_HOST } },
        select: { id: true, [field]: true },
      });
    } catch {
      continue;
    }
    if (rows.length === 0) continue;
    console.log(`=== ${model}.${field}: ${rows.length} ===`);
    for (const row of rows) {
      scanned++;
      const url = row[field];
      const key = r2KeyFromSupabaseUrl(url);
      if (!key) { failed++; notRecovered.push(`${model}#${row.id} (key yox)`); continue; }

      const got = await fetchFromLocalCache(url);
      if (!got) {
        failed++;
        notRecovered.push(`${model}#${row.id} ${key}`);
        console.log(`  ✗ keşdə yox: ${key}`);
        continue;
      }
      if (DRY) {
        console.log(`  ✓ [dry] ${key}  (w=${got.width}, ${got.contentType}, ${got.bytes.length}b)`);
        recovered++;
        continue;
      }
      try {
        await putR2Object(key, got.bytes, got.contentType);
        await db[model].update({ where: { id: row.id }, data: { [field]: r2PublicUrl(key) } });
        recovered++;
        console.log(`  ✓ ${key} → R2 (w=${got.width})`);
      } catch (err) {
        failed++;
        notRecovered.push(`${model}#${row.id} ${key}`);
        console.log(`  ✗ upload/DB xəta ${key}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`\n✓ scanned=${scanned} recovered=${recovered} failed=${failed}${DRY ? " (DRY)" : ""}`);
  if (notRecovered.length) {
    console.log(`\nBərpa OLUNMAYAN (admin-dən yenidən yüklənməli):`);
    notRecovered.forEach((s) => console.log("  - " + s));
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
