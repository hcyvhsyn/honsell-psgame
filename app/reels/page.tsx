import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";
import { getFirstReelsPageCached } from "@/lib/reels";
import ReelsFeedClient from "@/components/reels/ReelsFeedClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Reels — Honsell",
  description: "Oyun və film videoları — izlə, bəyən, tək toxunuşla al.",
};

/**
 * Reels feed — immersiv full-screen. Statik/edge-keşlənən qalır (cookies YOX):
 * ilk səhifə `getFirstReelsPageCached` (tag "reels") RSC-də render olunur,
 * per-user vəziyyət client-də /api/reels/state-dən gəlir.
 */
export default async function ReelsPage() {
  // `.catch` DEPLOY BLOKUNU AÇIR, sadəcə "ehtiyat tədbiri" deyil.
  //
  // Bu səhifə build zamanı prerender olunur və Docker build-i DB-yə qoşulur.
  // Miqrasiya serverdə tətbiq edilməyibsə (deploy.sh `migrate deploy`
  // çağırmır — bax: docs) sorğu `The column Reel.editionGameIds does not
  // exist` ilə atılır, prerender sınır və BÜTÜN deploy exit code 1 verir —
  // yəni bir səhifənin sorğusu bütün saytın yayımını bloklayır.
  //
  // Kataloqun qalan hissəsi onsuz da bu qaydaya əməl edir (məs. /qutular
  // `getBoxes().catch(() => [])`), ona görə həmin loot box sorğuları eyni
  // build-də uğursuz olsa da səhifələr generasiya olundu. Boş feed ilə
  // yayımlanmaq, heç yayımlanmamaqdan yaxşıdır; feed onsuz da mount-dan sonra
  // `/api/reels`-dən doldurulur.
  const { items, nextCursor } = await getFirstReelsPageCached().catch((e) => {
    console.error("reels: ilk səhifə yüklənmədi", e);
    return { items: [], nextCursor: null };
  });

  return (
    <main className="relative min-h-[100dvh] bg-black">
      {/* Üst overlay — geri/ana səhifə (immersiv, tam header əvəzinə). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[80] flex items-center justify-between p-4">
        <Link
          href="/"
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
          aria-label="Ana səhifə"
        >
          <Home className="h-5 w-5" />
        </Link>
        <span className="pointer-events-none text-sm font-black tracking-wide text-white/90 drop-shadow">
          Reels
        </span>
        <span className="h-10 w-10" />
      </div>

      <ReelsFeedClient initialItems={items} initialCursor={nextCursor} />
    </main>
  );
}
