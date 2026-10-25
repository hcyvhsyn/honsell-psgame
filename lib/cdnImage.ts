import { normalizeMediaUrl } from "./mediaUrl";

/**
 * Supabase storage URL-ini (env ilə təyin olunmuş) CDN host-una yönləndirir.
 *
 * Məqsəd: Next image optimizer şəkilin orijinalını Supabase əvəzinə Cloudflare
 * (və ya başqa CDN) üzərindən çəksin ki, Supabase EGRESS yeyilməsin. CDN
 * Supabase storage origin-ini keşləyir → təkrar çəkilişlər Supabase-ə dəymir.
 *
 * `NEXT_PUBLIC_SUPABASE_CDN_HOST` qurulmayıbsa URL DƏYİŞMİR (no-op) — yəni
 * Cloudflare qurulana qədər heç nə pozulmur. Quraşdırma:
 *   1. Cloudflare-də `cdn.honsell.site` → origin: `<ref>.supabase.co` (proxied).
 *   2. .env: NEXT_PUBLIC_SUPABASE_CDN_HOST=cdn.honsell.site
 *   3. next.config remotePatterns bu host-u env-dən avtomatik əlavə edir.
 */
const CDN_HOST = process.env.NEXT_PUBLIC_SUPABASE_CDN_HOST?.trim();

export function cdnImageUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  // Köhnə R2 host-u (cdn.honsell.store/.site) → öz proxy-miz (lib/mediaUrl.ts).
  const normalized = normalizeMediaUrl(url);
  if (normalized !== url) return normalized;
  if (!CDN_HOST) return url;
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

/**
 * PS Store şəkil serveri (`image.api.playstation.com`) `?w=` ilə ölçüləndirməni
 * özü edir — bizim Node optimizer-inə yük salmadan. Kataloq qapaqları orijinalda
 * 1024×1024 / ~324 KB-dır, kartda isə ~300px görünür; `w=540` → 592px / ~112 KB.
 * Server ölçüləri pillələrlə qaytarır (370, 444, 592, 764). Digər hostlara toxunmur.
 */
export function psStoreSizedUrl<T extends string | null | undefined>(url: T, width: number): T {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname !== "image.api.playstation.com") return url;
    u.searchParams.set("w", String(width));
    return u.toString() as T;
  } catch {
    return url;
  }
}
