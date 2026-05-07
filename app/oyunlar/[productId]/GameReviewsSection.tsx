"use client";

import { useEffect, useState } from "react";
import { MessageCircle, PencilLine } from "lucide-react";
import ReviewCard, {
  type ReviewCardData,
  type ReviewCardGame,
} from "@/components/ReviewCard";
import ReviewComposer from "@/components/ReviewComposer";
import { useModals } from "@/lib/modals";

type Props = {
  game: ReviewCardGame;
  /** Server-rendered auth state. Null = qonaq. API cavabından daha etibarlıdır. */
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

const STATUS_LABEL_AZ: Record<string, string> = {
  PENDING: "Moderasiyadır",
  APPROVED: "Yayımdadır",
  REJECTED: "Rədd olundu",
  HIDDEN: "Gizlədilib",
};

export default function GameReviewsSection({ game, viewerUserId }: Props) {
  const { open: openModal } = useModals();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isAuthenticated = !!viewerUserId;

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
  }, [game.id, reloadKey]);

  const reviews = data?.reviews ?? [];
  const viewer = data?.viewer;
  const myReview = viewer?.myReview ?? null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">
            Oyunçu rəyləri{" "}
            <span className="text-zinc-500">({data?.total ?? 0})</span>
          </h2>
        </div>

        {!myReview ? (
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                openModal("login");
                return;
              }
              setComposerOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
          >
            <PencilLine className="h-4 w-4" />
            {composerOpen && isAuthenticated ? "Formu bağla" : "Rəy yazın"}
          </button>
        ) : null}
      </div>

      {/* Mövcud rəyim varsa kiçik info bandı */}
      {myReview ? (
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
          Siz bu oyun üçün artıq rəy göndərmisiniz. Status:{" "}
          <span className="font-semibold text-amber-300">
            {STATUS_LABEL_AZ[myReview.status] ?? myReview.status}
          </span>
          {myReview.status === "PENDING" ? (
            <span className="ml-1 text-zinc-500">— admin onayı gözlənilir.</span>
          ) : null}
        </div>
      ) : null}

      {/* Composer */}
      {composerOpen && isAuthenticated && !myReview ? (
        <div className="mb-6">
          <ReviewComposer
            games={[{ id: game.id, title: game.title }]}
            fixedGameId={game.id}
            onSuccess={() => {
              setComposerOpen(false);
              setReloadKey((k) => k + 1);
            }}
          />
        </div>
      ) : null}

      {/* Reviews list */}
      {loading ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500">
          Yüklənir...
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
          <p className="text-zinc-400">
            Bu oyun üçün hələ rəy yoxdur.
          </p>
          {isAuthenticated && !myReview ? (
            <p className="mt-2 text-sm text-zinc-500">
              İlk rəy sizdən olsun.
            </p>
          ) : null}
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
