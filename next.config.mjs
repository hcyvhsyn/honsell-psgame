/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Optimizasiya AÇIQ — Next şəkilləri cihaza görə ölçüləndirir, AVIF/WebP-ə
    // çevirir və uzun müddət keşləyir. (Əvvəl `unoptimized: true` idi — bütün
    // şəkillər tam orijinal ölçüdə yüklənirdi, bu da yavaşlığın əsas səbəbi idi.)
    formats: ["image/avif", "image/webp"],
    // Çevrilmiş şəkil 31 gün keşdə qalsın — təkrar transformasiyanı azaldır
    // (həm sürət, həm Vercel image-optimization xərci üçün).
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: "https", hostname: "image.api.playstation.com" },
      { protocol: "https", hostname: "**.playstation.net" },
      { protocol: "https", hostname: "**.playstation.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "images.justwatch.com" },
    ],
  },
};

export default nextConfig;
