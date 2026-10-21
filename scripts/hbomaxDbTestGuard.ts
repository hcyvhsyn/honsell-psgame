/**
 * `scripts/hbomaxDb.test.ts` üçün ilk import — DB modullarından ƏVVƏL işləyir
 * (CJS require sırası saxlanır). DATABASE_URL lokal deyilsə prosesi dayandırır ki,
 * test Provider* cədvəllərini Supabase/prod-da təmizləməsin.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(dbUrl)) {
  console.error("❌ test:hbomax-db yalnız lokal DATABASE_URL ilə işləyir (localhost/127.0.0.1).");
  process.exit(2);
}

export {};
