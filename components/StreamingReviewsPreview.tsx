import Link from "next/link";
import Image from "next/image";
import { Star, Film, Tv as TvIcon, BadgeCheck, ArrowRight, MessageSquare, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { STREAMING_SERVICE_LABELS } from "@/lib/streamingCart";
import { formatAzDate } from "@/lib/streamingLanguages";

/**
 * Streaming overview və per-service səhifələrində 2-3 son icmalın preview-i.
 * Tam icmal səhifəsindəki kart-ın kompakt, server-tərəfdə render olunan
 * (interaktivsiz) versiyası — like/dislike/favorit/share burda yoxdur, oxucu
 * "Hamısına bax" düyməsindən tam səhifəyə keçir.
 */
export default async function StreamingReviewsPreview({
  service,
  limit = 3,
}: {
  /// Yalnız bu xidmət üçün filter (məs: "HBO_MAX"). Boş — bütün xidmətlər.
  service?: string;
  limit?: number;
}) {
  const reviews = await prisma.streamingReview.findMany({
    where: {
      status: "APPROVED",
      ...(service ? { service } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true, streamingReviewTrusted: true } },
      reactions: { select: { kind: true } },
    },
  });

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
        <MessageSquare className="mx-auto h-9 w-9 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">
          Hələ heç bir icmal yoxdur. İlk icmal yazan sən ol!
        </p>
        <Link
          href="/streaming/icmallar"
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
        >
          İcmal yaz <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {reviews.map((r) => {
          const Kind = r.kind === "SERIES" ? TvIcon : Film;
          const likes = r.reactions.filter((x) => x.kind === "LIKE").length;
          const dislikes = r.reactions.filter((x) => x.kind === "DISLIKE").length;
          const author = r.user.name ?? r.user.email;
          const isSpoiler = r.spoiler;

          return (
            <li key={r.id}>
              <Link
                href={`/streaming/icmallar#r-${r.id}`}
                className="group block overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 transition hover:border-white/20"
              >
                <div className="grid gap-4 p-4 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-5 sm:p-5">
                  <div className="relative aspect-[2/3] w-24 overflow-hidden rounded-xl bg-zinc-900 sm:w-full">
                    {r.posterUrlSnap ? (
                      <Image
                        src={r.posterUrlSnap}
                        alt={r.titleSnap}
                        fill
                        sizes="100px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Kind className="h-7 w-7 text-zinc-700" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white ring-1 ring-white/15">
                        {STREAMING_SERVICE_LABELS[r.service] ?? r.service}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[12px] font-bold text-amber-300 ring-1 ring-amber-400/30">
                        <Star className="h-3 w-3 fill-current" /> {r.rating}/10
                      </span>
                      {isSpoiler && (
                        <span className="rounded-full bg-rose-500/25 px-2 py-0.5 text-[10px] font-semibold text-rose-200 ring-1 ring-rose-400/30">
                          SPOILER
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 truncate text-lg font-bold text-white group-hover:text-indigo-200">
                      {r.titleSnap}
                    </h3>

                    <p
                      className={`mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-300 ${
                        isSpoiler ? "blur-sm select-none" : ""
                      }`}
                    >
                      {r.body}
                    </p>
                    {isSpoiler && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-rose-300">
                        <Eye className="h-3 w-3" /> Spoiler-i açmaq üçün icmala daxil ol
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                      <span className="inline-flex items-center gap-1.5 text-zinc-300">
                        <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                        {author}
                        {r.user.streamingReviewTrusted && (
                          <BadgeCheck className="h-3.5 w-3.5 text-emerald-300" />
                        )}
                      </span>
                      <span>·</span>
                      <span>{formatAzDate(r.createdAt)}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">👍 {likes}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">👎 {dislikes}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-center">
        <Link
          href={service ? `/streaming/icmallar?service=${service}` : "/streaming/icmallar"}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Bütün icmallara bax <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
