/**
 * Saytı (next dev) LOKAL HBO kollektor DB-si ilə işə salır — Phase 3 vitrin proyeksiyasını
 * (`/streaming/katalog`) real data ilə yoxlamaq üçün.
 *
 *   npm run dev:hbomax              # :3000
 *   npm run dev:hbomax -- -p 3100   # başqa port
 *
 * - DATABASE_URL/DIRECT_URL → `HBOMAX_DATABASE_URL` (yalnız localhost/127.0.0.1 qəbul olunur);
 * - HBOMAX_STOREFRONT_COVERAGE=1 (coverage sütunları yalnız bu DB-də var).
 * Adi `npm run dev` dəyişmir: `.env`-dəki DB, coverage söndürülü.
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";

const url = process.env.HBOMAX_DATABASE_URL?.trim();
if (!url || !/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("[HBO] ✖ HBOMAX_DATABASE_URL must point to the LOCAL collector DB (localhost/127.0.0.1)");
  process.exit(2);
}
const extra = process.argv.slice(2);
const args = ["dev", ...(extra.includes("-p") || extra.includes("--port") ? [] : ["-p", "3000"]), ...extra];
console.log(`[HBO] next ${args.join(" ")} → ${new URL(url).host}${new URL(url).pathname} (HBOMAX_STOREFRONT_COVERAGE=1)`);

const child = spawn(path.join(process.cwd(), "node_modules", ".bin", "next"), args, {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: url,
    DIRECT_URL: url,
    HBOMAX_STOREFRONT_COVERAGE: "1",
    // Admin → Streaming → HBO Max Kollektor düymələri (lib/hbomaxAdminRunner.ts) yalnız burada aktivdir.
    HBOMAX_ADMIN_RUNNER: "1",
    WATCHPACK_POLLING: "true",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => child.kill(sig));
