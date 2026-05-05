import Link from "next/link";
import { Heart, BellRing, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import GameCard, { type GameCardData } from "@/components/GameCard";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const settings = await getSettings();

  const rows = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { game: true },
  });

  const cards: GameCardData[] = rows
    .filter((r) => r.game?.isActive)
    .map((r) => {
      const g = r.game!;
      const d = computeDisplayPrice(g, settings);
      return {
        id: g.id,
        productId: g.productId,
        title: g.title,
        imageUrl: g.imageUrl,
        platform: g.platform,
        productType: g.productType,
        finalAzn: d.finalAzn,
        originalAzn: d.originalAzn,
        discountPct: d.discountPct,
        discountEndAt: g.discountEndAt ? g.discountEndAt.toISOString() : null,
      };
    });

  return (
    <div className="space-y-6">
      <header className="rounded-[24px] border border-white/5 bg-[#111116] p-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40">
            <Heart className="h-6 w-6 fill-rose-400 text-rose-400" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Favorilər
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {cards.length > 0
                ? `${cards.length} oyun gözləmə siyahında.`
                : "Bəyəndiyin oyunları ürək ikonu ilə əlavə et."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-xs leading-relaxed text-zinc-300">
              Favorilədiyin oyun yenidən endirimə düşəndə{" "}
              <b className="text-white">{user.email}</b> ünvanına email
              göndəririk — kampaniyanı qaçırmırsan.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-xs leading-relaxed text-zinc-300">
              Burada oyunun hazırkı qiymətini, faiz endirimini və kampaniyanın
              bitiş tarixini bir baxışda görürsən.
            </p>
          </div>
        </div>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-[#111116] p-10 text-center">
          <Heart className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-base font-semibold text-white">
            Hələ favori oyunun yoxdur
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Oyunun yanındakı ürək ikonuna toxun — endirim olduqda sənə
            xəbər verəcəyik.
          </p>
          <Link
            href="/oyunlar"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5B21B6]"
          >
            Oyunlara bax
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </ul>
      )}
    </div>
  );
}
