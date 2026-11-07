// Supabase storage-ı Cloudflare (vb.) CDN arxasına almaq üçün opsional host.
// Qurulubsa həm remotePatterns-a əlavə olunur, həm də cdnImageUrl() URL-ləri
// bu host-a yönləndirir → Supabase egress yeyilmir. Qurulmayıbsa heç nə dəyişmir.
const supabaseCdnHost = process.env.NEXT_PUBLIC_SUPABASE_CDN_HOST?.trim();

// Cloudflare R2 public host (məs. cdn.honsell.site və ya pub-xxx.r2.dev).
// Şəkillər R2-də saxlananda Next optimizer bu host-dan oxuyur — remotePatterns-a
// əlavə olunmasa optimizer 400 qaytarar və şəkillər görünməz.
const r2PublicHost = (() => {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    // Şema olmadan (məs. "cdn.honsell.site") verilsə də işləsin.
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `x-powered-by: Next.js` başlığını sil (kiçik təhlükəsizlik + bayt qənaəti).
  poweredByHeader: false,
  // İstehsalda client bundle-a source map yaratma (daha kiçik, daha sürətli build).
  productionBrowserSourceMaps: false,
  compiler: {
    // İstehsal client bundle-ından console.* çağırışlarını sil (error/warn qalır)
    // → daha kiçik JS, daha az main-thread işi (TBT).
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    // lucide-react 209 faylda import olunur. Bu, hər ikonu ayrıca modul kimi
    // import edib barrel-i tree-shake edir → ilkin JS həcmi və TBT əhəmiyyətli
    // azalır. (Eyni şey digər iri barrel paketlər üçün də.)
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    // Optimizasiya AÇIQ — Next şəkilləri cihaza görə ölçüləndirir, AVIF/WebP-ə
    // çevirir və uzun müddət keşləyir. (Əvvəl `unoptimized: true` idi — bütün
    // şəkillər tam orijinal ölçüdə yüklənirdi, bu da yavaşlığın əsas səbəbi idi.)
    formats: ["image/avif", "image/webp"],
    // Çevrilmiş şəkil 31 gün keşdə qalsın — təkrar transformasiyanı azaldır
    // (həm sürət, həm Vercel image-optimization xərci üçün).
    minimumCacheTTL: 2678400,
    remotePatterns: [
      ...(r2PublicHost ? [{ protocol: "https", hostname: r2PublicHost }] : []),
      // Media proxy-si (app/cdn/[...key]/route.ts) — env köhnə host göstərsə də işləsin.
      { protocol: "https", hostname: "honsell.site", pathname: "/cdn/**" },
      ...(supabaseCdnHost ? [{ protocol: "https", hostname: supabaseCdnHost }] : []),
      { protocol: "https", hostname: "image.api.playstation.com" },
      { protocol: "https", hostname: "**.playstation.net" },
      { protocol: "https", hostname: "**.playstation.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "images.justwatch.com" },
      // Epic kataloqu (~5.9k oyun) şəkilləri bu hostlarda saxlayır. Siyahıda
      // olmadıqları üçün `unoptimized` verilməyən hər <Image> Epic oyununda
      // "Invalid src prop … hostname is not configured" ilə çökürdü.
      { protocol: "https", hostname: "**.epicgames.com" },
      { protocol: "https", hostname: "**.unrealengine.com" },
    ],
  },
  // Silinmiş bölmələr (2026-10: Epic, Süni İntellekt, Website Xidməti, Oyun
  // paketləri) — indeksdə qalmış linklər 404 əvəzinə ana səhifəyə getsin.
  async redirects() {
    return [
      { source: "/epic-games", destination: "/", permanent: true },
      { source: "/ai", destination: "/", permanent: true },
      { source: "/ai/:path*", destination: "/", permanent: true },
      { source: "/suni-intellekt", destination: "/", permanent: true },
      { source: "/xidmetler", destination: "/", permanent: true },
      { source: "/xidmetler/:path*", destination: "/", permanent: true },
      { source: "/paket/:slug*", destination: "/", permanent: true },
      // Qısa Spotify linki → əsl slug (lib/storeScope.ts SPOTIFY_STORE_PATH).
      { source: "/music/spotify", destination: "/music/spotify-premium", permanent: true },
      { source: "/spotify", destination: "/music/spotify-premium", permanent: true },
    ];
  },
};

export default nextConfig;
