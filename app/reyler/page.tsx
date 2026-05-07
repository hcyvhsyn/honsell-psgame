import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import ReviewCard, {
  type ReviewCardData,
  type ReviewCardGame,
} from "@/components/ReviewCard";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export const metadata: Metadata = {
  title: "Oyunçu Rəyləri — Real Alıcılardan",
  description:
    "PS oyunları haqqında həqiqi alıcıların yazdığı rəylər: ulduz reytinqləri, ətraflı təcrübələr və oyunçuların tövsiyələri. Aldığın oyun haqqında ikinci fikrə baxmadan qərar vermə.",
  alternates: { canonical: "/reyler" },
  openGraph: {
    title: `Oyunçu Rəyləri | ${SITE_NAME}`,
    description:
      "PS oyunları haqqında real alıcı rəyləri — ulduz, mətn və müzakirələr ilə.",
    url: "/reyler",
  },
};

type SortKey = "latest" | "top" | "discussed";

function parseSort(value: string | undefined): SortKey {
  if (value === "top" || value === "discussed") return value;
  return "latest";
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const sp = await searchParams;
  const sort = parseSort(sp.sort);

  const [settings, currentUser] = await Promise.all([
    getSettings(),
    getCurrentUser().catch(() => null),
  ]);

  // APPROVED rəylər — hamısı bir yerdə.
  const baseOrder =
    sort === "top"
      ? [{ rating: "desc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const reviews = await prisma.gameReview.findMany({
    where: { status: "APPROVED" },
    orderBy: baseOrder,
    take: PAGE_SIZE,
    include: {
      user: { select: { id: true, name: true, email: true } },
      game: true,
      _count: { select: { comments: { where: { isHidden: false } } } },
    },
  });

  // Reaksiya aggregation və mənim reaksiyalarım.
  const reviewIds = reviews.map((r) => r.id);
  const [reactions, myReactions] = await Promise.all([
    reviewIds.length === 0
      ? []
      : prisma.reviewReaction.groupBy({
          by: ["reviewId", "value"],
          where: { reviewId: { in: reviewIds } },
          _count: { _all: true },
        }),
    reviewIds.length === 0 || !currentUser
      ? []
      : prisma.reviewReaction.findMany({
          where: { reviewId: { in: reviewIds }, userId: currentUser.id },
          select: { reviewId: true, value: true },
        }),
  ]);

  const counts = new Map<string, { likes: number; dislikes: number }>();
  for (const id of reviewIds) counts.set(id, { likes: 0, dislikes: 0 });
  for (const r of reactions) {
    const slot = counts.get(r.reviewId)!;
    if (r.value > 0) slot.likes = r._count._all;
    else slot.dislikes = r._count._all;
  }
  const myMap = new Map(myReactions.map((r) => [r.reviewId, r.value]));

  // "Discussed" sıralamasını JS-də post-sort ilə tətbiq edirik (yorum sayına görə).
  let ordered = reviews;
  if (sort === "discussed") {
    ordered = [...reviews].sort(
      (a, b) => b._count.comments - a._count.comments
    );
  }

  const total = await prisma.gameReview.count({ where: { status: "APPROVED" } });

  return (
    <div className="min-h-screen bg-[#07070A] text-zinc-100">
      <SiteHeaderServer />

      <header className="border-b border-white/5 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex items-center gap-2 text-amber-400">
            <MessageCircle className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Real alıcılardan
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Oyunçu rəyləri
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
            Honsell-dən alış edən oyunçuların yazdığı və admin tərəfindən
            təsdiqlənən rəylər. Aldığın oyun haqqında həqiqi təcrübələri oxu,
            müzakirə et və qərar ver.
          </p>
          <div className="mt-2 text-xs text-zinc-500">
            Cəmi <span className="font-semibold text-zinc-300">{total}</span>{" "}
            təsdiqlənmiş rəy.
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <SortChip href="/reyler" active={sort === "latest"} label="Ən yeni" />
            <SortChip
              href="/reyler?sort=top"
              active={sort === "top"}
              label="Ən yüksək reytinq"
            />
            <SortChip
              href="/reyler?sort=discussed"
              active={sort === "discussed"}
              label="Ən çox müzakirə"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {ordered.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <p className="text-zinc-400">
              Hələ təsdiqlənmiş rəy yoxdur. Bir oyun səhifəsindən ilk rəyi
              sən yaza bilərsən.
            </p>
            <Link
              href="/oyunlar"
              className="mt-4 inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
            >
              Oyunlara bax
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {ordered.map((r) => {
              const display = computeDisplayPrice(r.game, settings);
              const game: ReviewCardGame = {
                id: r.game.id,
                productId: r.game.productId,
                title: r.game.title,
                coverImageUrl: r.game.heroImageUrl ?? r.game.imageUrl,
                finalAzn: display.finalAzn,
              };
              const data: ReviewCardData = {
                id: r.id,
                rating: r.rating,
                body: r.body,
                createdAt: r.createdAt.toISOString(),
                author: {
                  id: r.user.id,
                  name: r.user.name ?? r.user.email.split("@")[0],
                  avatarUrl: null,
                },
                likes: counts.get(r.id)?.likes ?? 0,
                dislikes: counts.get(r.id)?.dislikes ?? 0,
                myReaction: myMap.get(r.id) ?? 0,
                commentCount: r._count.comments,
              };
              return (
                <li key={r.id}>
                  <ReviewCard
                    review={data}
                    game={game}
                    currentUserId={currentUser?.id ?? null}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function SortChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
