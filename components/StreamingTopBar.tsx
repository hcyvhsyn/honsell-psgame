import Link from "next/link";
import { Heart, MessageSquare, Film, Tv } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Streaming bölməsinin sticky alt-naviqasiyası — sağda izləmə listi və icmallar
 * keçidləri. Watchlist say badge-i logged-in istifadəçi üçün gerçək rəqəmdir,
 * qonaq üçün gizlidir.
 */
export default async function StreamingTopBar() {
  const user = await getCurrentUser();
  const watchlistCount = user
    ? await prisma.streamingTitleFavorite.count({ where: { userId: user.id } })
    : 0;

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/5 bg-zinc-950/80 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/streaming"
            className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-300 hover:text-white"
          >
            Streaming
          </Link>
          <Link
            href="/streaming/filmler"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <Film className="h-3.5 w-3.5" /> Filmlər
          </Link>
          <Link
            href="/streaming/seriallar"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <Tv className="h-3.5 w-3.5" /> Seriallar
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/streaming/icmallar"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <MessageSquare className="h-3.5 w-3.5" /> İcmallar
          </Link>
          <Link
            href="/streaming/izleme-listim"
            aria-label="İzləmə listim"
            className="relative inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-rose-500/20 hover:text-rose-200"
          >
            <Heart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">İzləmə Listim</span>
            {user && watchlistCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {watchlistCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
