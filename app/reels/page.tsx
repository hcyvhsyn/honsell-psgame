import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { getFirstReelsPageCached } from "@/lib/reels";
import { getStreamingPlatformsByCategory } from "@/lib/streamingPlatforms";
import ReelsFeedClient from "@/components/reels/ReelsFeedClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Reels — Honsell",
  description: "Oyun və film videoları — izlə, bəyən, tək toxunuşla al.",
};

/**
 * Reels feed — immersiv full-screen. Statik/edge-keşlənən qalır:
 * `cookies()`, `getCurrentUser()` və `searchParams` HEÇ BİRİ işlədilmir.
 *
 * Kateqoriya seçimi client-dədir (localStorage), ona görə server hansının
 * lazım olduğunu bilmir → HƏR İKİ kateqoriyanın ilk səhifəsi ötürülür və seçim
 * nə olursa olsun əlavə sorğu getmir. "Hamısı" azlıqda qalan seçimdir, onun ilk
 * səhifəsini client mount-da bir dəfə çəkir.
 *
 * Deep link (`?r=<id>`) client-də `useSearchParams` ilə oxunur — burada
 * `searchParams` işlətsək route dinamik olardı və keş arxitekturası dağılardı.
 */
export default async function ReelsPage() {
  const [game, streaming, platforms] = await Promise.all([
    getFirstReelsPageCached("GAME"),
    getFirstReelsPageCached("STREAMING"),
    getStreamingPlatformsByCategory("STREAMING").catch(() => []),
  ]);

  return (
    <main className="relative min-h-[100dvh] bg-black">
      {/* Üst sol overlay — ana səhifə. Kateqoriya keçidi client state-inə bağlıdır,
          ona görə onu feed client-i öz overlay-ində render edir. */}
      <div className="pointer-events-none absolute left-0 top-0 z-[90] p-4">
        <Link
          href="/"
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
          aria-label="Ana səhifə"
        >
          <Home className="h-5 w-5" />
        </Link>
      </div>

      {/* useSearchParams statik səhifədə Suspense sərhədi tələb edir. */}
      <Suspense fallback={<div className="h-[100dvh] w-full bg-black" />}>
        <ReelsFeedClient
          initialGame={game}
          initialStreaming={streaming}
          platforms={platforms.map((p) => ({ code: p.code, label: p.label }))}
        />
      </Suspense>
    </main>
  );
}
