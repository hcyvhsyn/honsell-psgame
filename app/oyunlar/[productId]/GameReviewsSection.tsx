"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import ReviewCard, {
  type ReviewCardData,
  type ReviewCardGame,
} from "@/components/ReviewCard";

type Props = {
  game: ReviewCardGame;
  /** Server-rendered auth state. Null = qonaq. */
  viewerUserId: string | null;
};

type ApiResponse = {
  total: number;
  viewer: {
    isAuthenticated: boolean;
    userId: string | null;
    myReview: { id: string; status: string; rating: number } | null;
  };
  reviews: ReviewCardData[];
};

export default function GameReviewsSection({ game, viewerUserId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/game-reviews?gameId=${encodeURIComponent(game.id)}&limit=20`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((j: ApiResponse) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [game.id]);

  const reviews = data?.reviews ?? [];

  if (!loading && reviews.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-zinc-200">
          Oyunçu rəyləri{" "}
          <span className="text-zinc-500">({data?.total ?? 0})</span>
        </h2>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
          Yüklənir...
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard
                review={r}
                game={game}
                currentUserId={viewerUserId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
