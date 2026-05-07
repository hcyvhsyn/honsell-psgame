"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  ShoppingBag,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { REVIEW_COMMENT_BODY_MAX } from "@/lib/reviewAffiliateConstants";

export type ReviewCardData = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  likes: number;
  dislikes: number;
  /** İstifadəçinin mövcud reaksiyası: 1, -1, və ya 0. */
  myReaction: number;
  commentCount: number;
};

export type ReviewCardGame = {
  id: string;
  productId: string;
  title: string;
  coverImageUrl: string | null;
  finalAzn: number;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
};

type Props = {
  review: ReviewCardData;
  game: ReviewCardGame;
  /** Cari istifadəçinin id-si (varsa). Yorum/reaksiya UX-ı üçün. */
  currentUserId: string | null;
};

export default function ReviewCard({ review, game, currentUserId }: Props) {
  const [likes, setLikes] = useState(review.likes);
  const [dislikes, setDislikes] = useState(review.dislikes);
  const [myReaction, setMyReaction] = useState(review.myReaction);
  const [reactionPending, startReactionTransition] = useTransition();

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(review.commentCount);

  const isSelf = currentUserId === review.author.id;
  const buyHref = `/oyunlar/${encodeURIComponent(game.productId)}?via=${encodeURIComponent(review.id)}`;

  async function loadComments() {
    if (comments !== null) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/game-reviews/${review.id}/comments`, {
        cache: "no-store",
      });
      const json = await res.json();
      setComments(Array.isArray(json.comments) ? json.comments : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  function toggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next) loadComments();
  }

  function reactTo(value: 1 | -1) {
    if (!currentUserId) {
      window.location.href = "/giris";
      return;
    }
    if (reactionPending) return;
    startReactionTransition(async () => {
      try {
        const res = await fetch(`/api/game-reviews/${review.id}/reaction`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value }),
        });
        const json = await res.json();
        if (res.ok) {
          setLikes(Number(json.likes) || 0);
          setDislikes(Number(json.dislikes) || 0);
          setMyReaction(Number(json.myReaction) || 0);
        }
      } catch {
        /* silently ignore */
      }
    });
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) {
      window.location.href = "/giris";
      return;
    }
    const text = commentDraft.trim();
    if (text.length === 0 || text.length > REVIEW_COMMENT_BODY_MAX) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/game-reviews/${review.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (res.ok && json.comment) {
        setComments((prev) => [...(prev ?? []), json.comment as Comment]);
        setCommentCount((c) => c + 1);
        setCommentDraft("");
      }
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function deleteComment(id: string) {
    if (!confirm("Yorumu silmək istəyirsiniz?")) return;
    const res = await fetch(`/api/game-reviews/${review.id}/comments/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
      setCommentCount((c) => Math.max(0, c - 1));
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg shadow-black/30">
      {/* Cover image */}
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-zinc-900">
        {game.coverImageUrl ? (
          <Image
            src={game.coverImageUrl}
            alt={game.title}
            fill
            sizes="(min-width: 1024px) 720px, 100vw"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
          <h3 className="text-lg font-semibold text-white drop-shadow-md sm:text-xl">
            {game.title}
          </h3>
          <span className="rounded-full bg-amber-500/90 px-3 py-1 text-xs font-bold text-zinc-950">
            {game.finalAzn.toFixed(2)} ₼
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-5">
        {/* Author + rating */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={review.author.name} src={review.author.avatarUrl} />
            <div>
              <div className="font-medium text-zinc-100">{review.author.name}</div>
              <div className="text-xs text-zinc-500">
                {formatDate(review.createdAt)}
              </div>
            </div>
          </div>
          <StarRating value={review.rating} />
        </div>

        {/* Review body */}
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
          {review.body}
        </p>

        {/* Reaction + comment toggle */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <div className="flex items-center gap-2">
            <ReactionButton
              active={myReaction === 1}
              onClick={() => reactTo(1)}
              disabled={reactionPending}
              icon={<ThumbsUp className="h-4 w-4" />}
              label={likes.toString()}
              activeColor="emerald"
            />
            <ReactionButton
              active={myReaction === -1}
              onClick={() => reactTo(-1)}
              disabled={reactionPending}
              icon={<ThumbsDown className="h-4 w-4" />}
              label={dislikes.toString()}
              activeColor="rose"
            />
            <button
              type="button"
              onClick={toggleComments}
              className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
            >
              <MessageSquare className="h-4 w-4" />
              <span>{commentCount}</span>
              {commentsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Buy CTA — affiliate link */}
        <Link
          href={buyHref}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-5 py-3.5 text-center text-base font-bold text-zinc-950 shadow-lg shadow-orange-500/20 transition hover:shadow-orange-500/40"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <ShoppingBag className="relative h-5 w-5" />
          <span className="relative">Bu oyunu sat&#305;n al — {game.finalAzn.toFixed(2)} ₼</span>
        </Link>

        {/* Comments accordion */}
        {commentsOpen ? (
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            {commentsLoading ? (
              <div className="py-2 text-center text-sm text-zinc-500">Yüklənir...</div>
            ) : (comments ?? []).length === 0 ? (
              <div className="py-2 text-center text-sm text-zinc-500">
                Hələ yorum yoxdur. İlk olun.
              </div>
            ) : (
              <ul className="space-y-3">
                {(comments ?? []).map((c) => {
                  const canDelete = currentUserId === c.author.id;
                  return (
                    <li
                      key={c.id}
                      className="flex items-start gap-3 rounded-lg bg-zinc-950/50 p-3"
                    >
                      <Avatar name={c.author.name} src={c.author.avatarUrl} small />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-zinc-100">
                            {c.author.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-zinc-500">
                              {formatDate(c.createdAt)}
                            </span>
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => deleteComment(c.id)}
                                className="text-zinc-500 transition hover:text-rose-400"
                                aria-label="Yorumu sil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-300">
                          {c.body}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Comment composer */}
            <form onSubmit={submitComment} className="flex items-start gap-2 pt-1">
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value.slice(0, REVIEW_COMMENT_BODY_MAX))}
                rows={2}
                placeholder={
                  currentUserId
                    ? isSelf
                      ? "Öz rəyinizə yorum yaza bilərsiniz..."
                      : "Yorum yazın..."
                    : "Yorum yazmaq üçün giriş edin"
                }
                disabled={!currentUserId}
                className="flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={
                  !currentUserId || commentDraft.trim().length === 0 || commentSubmitting
                }
                className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-zinc-100 px-3 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </article>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Reytinq: ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= value ? "fill-amber-400 text-amber-400" : "text-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

function ReactionButton({
  active,
  onClick,
  disabled,
  icon,
  label,
  activeColor,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  activeColor: "emerald" | "rose";
}) {
  const activeClass =
    activeColor === "emerald"
      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
      : "border-rose-500/60 bg-rose-500/10 text-rose-300";
  const idleClass =
    "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        active ? activeClass : idleClass
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Avatar({
  name,
  src,
  small,
}: {
  name: string;
  src: string | null;
  small?: boolean;
}) {
  const size = small ? 32 : 40;
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${
          small ? "h-8 w-8" : "h-10 w-10"
        }`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-500 ${
        small ? "h-8 w-8" : "h-10 w-10"
      }`}
      aria-hidden
    >
      <UserCircle2 className={small ? "h-5 w-5" : "h-6 w-6"} />
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("az-AZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
