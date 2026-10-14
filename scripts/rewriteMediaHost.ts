/**
 * DB-dəki köhnə media host-larını yeni public bazaya köçürür.
 *
 * `cdn.honsell.store` domeni bitib, `cdn.honsell.site` heç vaxt qurulmayıb
 * (honsell.site Cloudflare-də deyil → R2 custom domain bağlana bilmir). Şəkillər
 * indi `https://honsell.site/cdn/<key>` proxy-si ilə verilir
 * (app/cdn/[...key]/route.ts). Bu skript bütün `public` sxemindəki mətn
 * sütunlarında köhnə prefiksi əvəz edir:
 *
 *   text / varchar  → replace()
 *   text[]          → hər element üzrə replace()
 *   json / jsonb    → mətn kimi replace() (URL-lərdə JSON escape yoxdur)
 *
 * Sütun siyahısı `information_schema`-dan gəlir — yeni şəkil sütunu əlavə
 * olunanda skripti dəyişmək lazım deyil. İdempotentdir.
 *
 * İşə salmaq (serverdə, `.env`-də yeni `NEXT_PUBLIC_R2_PUBLIC_URL` ilə):
 *   npm run fix:mediahost -- --dry-run          # yalnız say
 *   npm run fix:mediahost                       # yaz
 *   npm run fix:mediahost -- --to=https://x/cdn # hədəfi açıq ver
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");
const toArg = process.argv.find((a) => a.startsWith("--to="))?.slice(5);
const TARGET = (toArg || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");

const LEGACY_PREFIXES = ["https://cdn.honsell.store", "https://cdn.honsell.site"];

type Col = { table_name: string; column_name: string; data_type: string; udt_name: string };

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

function replaceExpr(expr: string): string {
  return LEGACY_PREFIXES.reduce((acc, p) => `replace(${acc}, ${lit(p)}, ${lit(TARGET)})`, expr);
}

async function main() {
  if (!TARGET || LEGACY_PREFIXES.some((p) => TARGET.startsWith(p))) {
    console.error(
      "Hədəf baza yoxdur və ya köhnə host-dur. NEXT_PUBLIC_R2_PUBLIC_URL=https://honsell.site/cdn təyin et və ya --to= ver.",
    );
    process.exit(1);
  }
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}${LEGACY_PREFIXES.join(", ")} → ${TARGET}\n`);

  const cols = await prisma.$queryRawUnsafe<Col[]>(`
    SELECT table_name, column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (data_type IN ('text', 'character varying', 'json', 'jsonb')
           OR (data_type = 'ARRAY' AND udt_name IN ('_text', '_varchar')))
      AND table_name NOT LIKE '\\_prisma%'
    ORDER BY table_name, column_name
  `);

  const like = `(${LEGACY_PREFIXES.map((p) => `%s::text LIKE ${lit(`%${p.replace("https://", "")}%`)}`).join(" OR ")})`;
  let total = 0;

  for (const c of cols) {
    const t = q(c.table_name);
    const col = q(c.column_name);
    const where = like.replace(/%s/g, col);

    const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM ${t} WHERE ${where}`,
    );
    if (n === 0) continue;
    total += n;
    console.log(`${c.table_name}.${c.column_name} (${c.data_type}): ${n}`);
    if (DRY_RUN) continue;

    let setExpr: string;
    if (c.data_type === "ARRAY") {
      setExpr = `ARRAY(SELECT ${replaceExpr("x")} FROM unnest(${col}) AS x)`;
    } else if (c.data_type === "json" || c.data_type === "jsonb") {
      setExpr = `(${replaceExpr(`${col}::text`)})::${c.data_type}`;
    } else {
      setExpr = replaceExpr(col);
    }
    await prisma.$executeRawUnsafe(`UPDATE ${t} SET ${col} = ${setExpr} WHERE ${where}`);
  }

  console.log(`\n${DRY_RUN ? "Dəyişəcək" : "Dəyişdi"}: ${total} sətir-sütun.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
