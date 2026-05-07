/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.api.playstation.com" },
      { protocol: "https", hostname: "**.playstation.net" },
      { protocol: "https", hostname: "**.playstation.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 200, 256, 384],
  },
};

export default nextConfig;
