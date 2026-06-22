/**
 * Mövcud şəkilləri Supabase Storage → Cloudflare R2 köçürən BİR DƏFƏLİK skript.
 *
 * DB Supabase-də qalır; yalnız şəkil faylları + DB-dəki URL-lər R2-yə keçir.
 *
 * ƏVVƏLCƏ:
 *   - Supabase servisi AKTİV olmalıdır (skript şəkilləri Supabase-dən oxuyur;
 *     qota məhdudiyyəti varsa əvvəlcə spend cap-i qaldırın).
 *   - R2 env-ləri qurulmalıdır (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *     R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_R2_PUBLIC_URL).
 *
 * İSTİFADƏ:
 *   npx tsx scripts/migrate-images-to-r2.ts --dry        # yalnız hesabat
 *   npx tsx scripts/migrate-images-to-r2.ts              # köçür + DB yenilə
 *   npx tsx scripts/migrate-images-to-r2.ts --limit=50   # ilk 50 sətir (test)
 */
// .env-i prisma/r2 import OLUNMADAN ƏVVƏL yüklə (onlar env-i import vaxtı oxuyur).
// Dinamik import-lar main() içindədir — env bu nöqtədə artıq yüklənmiş olur.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const DRY = process.argv.includes("--dry");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 0) : Infinity;

const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

// (model, field) cütləri — supabase storage URL saxlayan sütunlar.
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

function r2KeyFromSupabaseUrl(url: string): string | null {
  // .../storage/v1/object/public/<bucket>/<path...>
  const m = url.match(/\/storage\/v1\/object\/public\/(.+)$/);
  if (!m) return null;
  return decodeURIComponent(m[1]); // <bucket>/<path>
}

function extToContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { isR2Configured, putR2Object, r2PublicUrl } = await import("@/lib/r2");

  if (!isR2Configured()) {
    console.error("✗ R2 env qurulmayıb. R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / NEXT_PUBLIC_R2_PUBLIC_URL lazımdır.");
    process.exit(1);
  }
  if (!SUPABASE_HOST) {
    console.error("✗ NEXT_PUBLIC_SUPABASE_URL təyin olunmayıb.");
    process.exit(1);
  }
  console.log(`Supabase host: ${SUPABASE_HOST} | DRY=${DRY} | LIMIT=${LIMIT}`);

  let migrated = 0;
  let failed = 0;
  let scanned = 0;
  const db = prisma as unknown as Record<string, {
    findMany: (a: unknown) => Promise<Array<Record<string, string>>>;
    update: (a: unknown) => Promise<unknown>;
  }>;

  for (const { model, field } of TARGETS) {
    if (migrated >= LIMIT) break;
    let rows: Array<Record<string, string>> = [];
    try {
      rows = await db[model].findMany({
        where: { [field]: { contains: SUPABASE_HOST } },
        select: { id: true, [field]: true },
      });
    } catch (err) {
      console.warn(`! ${model}.${field} oxunmadı: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (rows.length === 0) continue;
    console.log(`\n=== ${model}.${field}: ${rows.length} sətir ===`);

    for (const row of rows) {
      if (migrated >= LIMIT) break;
      scanned++;
      const url = row[field];
      const key = r2KeyFromSupabaseUrl(url);
      if (!key) {
        console.warn(`  skip (key tapılmadı): ${url}`);
        continue;
      }
      const newUrl = r2PublicUrl(key);
      if (DRY) {
        console.log(`  [dry] ${model}#${row.id}: ${key} → ${newUrl}`);
        migrated++;
        continue;
      }
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`fetch ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        const ct = resp.headers.get("content-type") || extToContentType(key);
        await putR2Object(key, buf, ct);
        await db[model].update({ where: { id: row.id }, data: { [field]: newUrl } });
        migrated++;
        if (migrated % 25 === 0) console.log(`  ...${migrated} köçürüldü`);
      } catch (err) {
        failed++;
        console.warn(`  FAIL ${model}#${row.id} (${url}): ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`\n✓ Bitdi. scanned=${scanned} migrated=${migrated} failed=${failed}${DRY ? " (DRY — DB dəyişmədi)" : ""}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
