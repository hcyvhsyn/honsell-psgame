/**
 * HBO Max kollektorunun DB seçimi — `lib/prisma`-dan ƏVVƏL import olunmalıdır
 * (scriptlərdə `import "dotenv/config"`-dən dərhal sonra; CJS require sırası saxlanır).
 *
 * Kollektor `.env`-dəki DATABASE_URL-ə (Supabase) HEÇ VAXT düşmür:
 * - `HBOMAX_DATABASE_URL` məcburidir (lokal dev DB, məs. honsell_hbomax_dev);
 * - lokal olmayan host `HBOMAX_ALLOW_REMOTE_DB=1` olmadan rədd edilir (gələcək staging üçün açıq qərar);
 * - seçilən URL DATABASE_URL/DIRECT_URL-in yerinə yazılır ki, `lib/prisma` onu götürsün.
 *
 * Bu modul miqrasiya İŞLƏTMİR. Miqrasiya hər mühitdə ayrıca, əl ilə edilir.
 */

const LOCAL_HOST_RE = /@(localhost|127\.0\.0\.1)(:\d+)?\//;

function describe(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(invalid URL)";
  }
}

const url = process.env.HBOMAX_DATABASE_URL?.trim();
if (!url) {
  console.error("[HBO] ✖ CONFIG: HBOMAX_DATABASE_URL is not set — the collector never falls back to DATABASE_URL (.env Supabase).");
  console.error("[HBO] ✖ Next step: set HBOMAX_DATABASE_URL to the local dev DB, e.g. postgresql://postgres:…@127.0.0.1:55433/honsell_hbomax_dev");
  process.exit(2);
}
if (!LOCAL_HOST_RE.test(url) && process.env.HBOMAX_ALLOW_REMOTE_DB !== "1") {
  console.error(`[HBO] ✖ CONFIG: HBOMAX_DATABASE_URL points to a non-local host (${describe(url)}). Set HBOMAX_ALLOW_REMOTE_DB=1 only for an approved staging/production run.`);
  process.exit(2);
}

process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.HBOMAX_DB_SELECTED = "1";
console.log(`[HBO] Database: ${describe(url)}`);

export {};
