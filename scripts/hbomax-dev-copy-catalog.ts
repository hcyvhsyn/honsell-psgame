/**
 * LOKAL dev köməkçisi: vitrinin streaming kataloqunu (yalnız 5 cədvəl) `.env`-dəki
 * DATABASE_URL-dən (Supabase) lokal kollektor DB-sinə köçürür — HBO/Prime dublikat
 * uyğunlaşmasını və /streaming səhifələrini localhost:3000-də real data ilə test etmək üçün.
 *
 *   npm run hbomax:dev-copy-catalog
 *
 * Təhlükəsizlik:
 * - Mənbə `BEGIN READ ONLY` tranzaksiyasında oxunur — Supabase-ə heç nə yazılmır.
 * - Hədəf yalnız LOKAL `HBOMAX_DATABASE_URL` ola bilər (uzaq host həmişə rədd edilir,
 *   HBOMAX_ALLOW_REMOTE_DB nəzərə alınmır).
 * - Yalnız kataloq cədvəlləri; istifadəçi/sifariş/şəxsi məlumat cədvəlləri köçürülmür.
 * - Hədəfdə bu 5 cədvəl TƏMİZLƏNİB yenidən doldurulur (kollektor cədvəllərinə toxunmur,
 *   yalnız `ProviderTitle.streamingTitleId` bağlantıları null olur — proyeksiya yenidən bağlayır).
 */
import "dotenv/config";
import { Client } from "pg";

const TABLES = ["StreamingPlatform", "StreamingTitle", "StreamingTitleName", "ContentAvailability", "ContentLanguage"] as const;
const LOCAL = /@(localhost|127\.0\.0\.1)(:\d+)?\//;

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(invalid)";
  }
}

async function main() {
  const source = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const target = process.env.HBOMAX_DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL/DIRECT_URL (source) is not set");
  if (!target || !LOCAL.test(target)) throw new Error("HBOMAX_DATABASE_URL must point to a LOCAL database (localhost/127.0.0.1)");
  if (hostOf(source) === hostOf(target)) throw new Error("Source and target are the same database");
  console.log(`[HBO] Copy catalog: ${hostOf(source)} (READ ONLY) → ${hostOf(target)}`);

  const src = new Client({ connectionString: source });
  const dst = new Client({ connectionString: target });
  await src.connect();
  await dst.connect();
  try {
    await src.query("BEGIN READ ONLY");
    const jsonCols = new Map<string, Set<string>>();
    for (const t of TABLES) {
      const r = await dst.query(
        `select column_name from information_schema.columns where table_name = $1 and data_type in ('json','jsonb')`,
        [t]
      );
      jsonCols.set(t, new Set(r.rows.map((x: { column_name: string }) => x.column_name)));
    }

    await dst.query("BEGIN");
    await dst.query(`UPDATE "ProviderTitle" SET "streamingTitleId" = NULL WHERE "streamingTitleId" IS NOT NULL`);
    await dst.query(`TRUNCATE ${[...TABLES].reverse().map((t) => `"${t}"`).join(", ")} CASCADE`);

    for (const t of TABLES) {
      const { rows } = await src.query(`SELECT * FROM "${t}"`);
      if (!rows.length) {
        console.log(`[HBO]   ${t}: 0`);
        continue;
      }
      const cols = Object.keys(rows[0]);
      const json = jsonCols.get(t)!;
      const BATCH = 400;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const values: unknown[] = [];
        const tuples = chunk.map((row, ri) => {
          const ph = cols.map((c, ci) => {
            const v = row[c];
            values.push(json.has(c) && v !== null ? JSON.stringify(v) : v);
            return `$${ri * cols.length + ci + 1}`;
          });
          return `(${ph.join(",")})`;
        });
        await dst.query(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")}`, values);
      }
      console.log(`[HBO]   ${t}: ${rows.length}`);
    }
    await dst.query("COMMIT");
    await src.query("ROLLBACK");
    console.log("[HBO] Done — run `npm run hbomax:project` to re-link and project HBO titles.");
  } catch (err) {
    await dst.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch((err) => {
  console.error(`[HBO] ✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
