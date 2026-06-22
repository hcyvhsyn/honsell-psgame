/**
 * Supabase storage URL-ini (env ilə təyin olunmuş) CDN host-una yönləndirir.
 *
 * Məqsəd: Next image optimizer şəkilin orijinalını Supabase əvəzinə Cloudflare
 * (və ya başqa CDN) üzərindən çəksin ki, Supabase EGRESS yeyilməsin. CDN
 * Supabase storage origin-ini keşləyir → təkrar çəkilişlər Supabase-ə dəymir.
 *
 * `NEXT_PUBLIC_SUPABASE_CDN_HOST` qurulmayıbsa URL DƏYİŞMİR (no-op) — yəni
 * Cloudflare qurulana qədər heç nə pozulmur. Quraşdırma:
 *   1. Cloudflare-də `cdn.honsell.store` → origin: `<ref>.supabase.co` (proxied).
 *   2. .env: NEXT_PUBLIC_SUPABASE_CDN_HOST=cdn.honsell.store
 *   3. next.config remotePatterns bu host-u env-dən avtomatik əlavə edir.
 */
const CDN_HOST = process.env.NEXT_PUBLIC_SUPABASE_CDN_HOST?.trim();

export function cdnImageUrl<T extends string | null | undefined>(url: T): T {
  if (!url || !CDN_HOST) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".supabase.co") || u.hostname.endsWith(".supabase.in")) {
      u.hostname = CDN_HOST;
      return u.toString() as T;
    }
    return url;
  } catch {
    return url;
  }
}
