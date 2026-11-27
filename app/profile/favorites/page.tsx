import Link from "next/link";
import { Heart, BellRing } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import GameCard, { type GameCardData } from "@/components/GameCard";
import { buildGameCard, GAME_CARD_SELECT } from "@/lib/gameCardMapper";
import ProfilePageHeader from "@/components/profile/ProfilePageHeader";

export const dynamic = "force-dynamic";

/**
 * Profil → Favorilər. 2026-11:
 * - kart `buildGameCard` ilə qurulur (göstərmə adı, slug linki, janr və s. kataloqla eyni);
 * - `include: { game: true }` əvəzinə `GAME_CARD_SELECT` — `Game.embedding` vektoru çəkilmir;
 * - iki izah qutulu böyük başlıq kartı tək sətirlik qeydə endirildi; telefonda 2 sütun.
 */
export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [settings, rows] = await Promise.all([
    getSettings(),
    prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { game: { select: { ...GAME_CARD_SELECT, isActive: true } } },
    }),
  ]);

  const cards: GameCardData[] = rows
    .map((r) => r.game)
    .filter((g): g is NonNullable<typeof g> => Boolean(g?.isActive))
    .map((g) => buildGameCard(g, computeDisplayPrice(g, settings)));

  return (
    <div className="space-y-5">
      <ProfilePageHeader
        title="Favorilər"
        description={
          cards.length > 0
            ? `${cards.length} oyun izləmə siyahında.`
            : "Bəyəndiyin oyunları ürək ikonu ilə əlavə et."
        }
      />

      <p className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
        <span>
          Favori oyun endirimə düşəndə <b className="text-zinc-900 dark:text-white">{user.email}</b> ünvanına
          xəbər göndəririk.
        </span>
      </p>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-white/10 dark:bg-[#111116]">
          <Heart className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-600" />
          <p className="mt-3 text-base font-semibold text-zinc-900 dark:text-white">Hələ favori oyunun yoxdur</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Oyunun üstündəki ürək ikonuna toxun — endirim olanda sənə xəbər verəcəyik.
          </p>
          <Link
            href="/oyunlar"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5B21B6]"
          >
            Oyunlara bax
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {cards.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </ul>
      )}
    </div>
  );
}
