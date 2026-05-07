"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, EyeOff, Loader2, Star, X } from "lucide-react";

type AdminReview = {
  id: string;
  rating: number;
  body: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  moderatedAt: string | null;
  moderationNote: string | null;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
  game: { id: string; title: string; imageUrl: string | null };
};

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "ALL";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "PENDING", label: "Gözləyir" },
  { key: "APPROVED", label: "Onaylı" },
  { key: "REJECTED", label: "Rədd" },
  { key: "HIDDEN", label: "Gizli" },
  { key: "ALL", label: "Hamısı" },
];

const STATUS_BADGE: Record<AdminReview["status"], string> = {
  PENDING: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  APPROVED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  REJECTED: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
  HIDDEN: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/40",
};

const STATUS_LABEL: Record<AdminReview["status"], string> = {
  PENDING: "Gözləyir",
  APPROVED: "Onaylı",
  REJECTED: "Rədd",
  HIDDEN: "Gizli",
};

export default function ReviewsAdminClient({
  initialCounts,
}: {
  initialCounts: Record<string, number>;
}) {
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);

  const load = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/game-reviews?status=${encodeURIComponent(status)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setReviews(json.reviews ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yükləmə xətası");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function act(id: string, action: "APPROVE" | "REJECT" | "HIDE") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/game-reviews/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error ?? `Xəta: HTTP ${res.status}`);
        return;
      }
      // Lokal siyahı və sayğacları yenilə.
      setReviews((prev) => {
        const before = prev.find((r) => r.id === id);
        const after = before ? { ...before, status: json.status as AdminReview["status"] } : null;
        // Cari filtə uyğun gəlmirsə kartı siyahıdan çıxar.
        const stillFits =
          filter === "ALL" || (after && after.status === filter);
        const next = stillFits && after
          ? prev.map((r) => (r.id === id ? after : r))
          : prev.filter((r) => r.id !== id);
        return next;
      });
      setCounts((prev) => {
        const updated = { ...prev };
        const before = reviews.find((r) => r.id === id);
        if (before) updated[before.status] = Math.max(0, (updated[before.status] ?? 0) - 1);
        const target = json.status as string;
        updated[target] = (updated[target] ?? 0) + 1;
        return updated;
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const active = key === filter;
          const count = key === "ALL" ? undefined : counts[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              {label}
              {count !== undefined ? (
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    active ? "bg-indigo-500/30 text-indigo-100" : "bg-zinc-800 text-zinc-400",
                  ].join(" ")}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center text-sm text-zinc-500">
          Bu filtə uyğun rəy yoxdur.
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* Game thumb + meta */}
                <div className="flex shrink-0 items-start gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
                    {r.game.imageUrl ? (
                      <Image
                        src={r.game.imageUrl}
                        alt={r.game.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/oyunlar/${r.game.id}`}
                      target="_blank"
                      className="line-clamp-2 text-sm font-semibold text-zinc-200 hover:text-indigo-300"
                    >
                      {r.game.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-1 text-amber-300">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={[
                            "h-3.5 w-3.5",
                            i < r.rating ? "fill-amber-400" : "opacity-30",
                          ].join(" ")}
                        />
                      ))}
                      <span className="ml-1 text-xs text-zinc-400">{r.rating}/5</span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {r.author.name ?? r.author.email.split("@")[0]} ·{" "}
                      <span className="text-zinc-600">{r.author.email}</span>
                    </div>
                  </div>
                </div>

                {/* Body + status + actions */}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATUS_BADGE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {new Date(r.createdAt).toLocaleString("az-Latn-AZ")}
                    </span>
                    {r.moderatedAt ? (
                      <span className="text-[11px] text-zinc-600">
                        moderasiya: {new Date(r.moderatedAt).toLocaleString("az-Latn-AZ")}
                      </span>
                    ) : null}
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                    {r.body}
                  </p>

                  {r.moderationNote ? (
                    <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[12px] text-zinc-400">
                      Admin qeydi: {r.moderationNote}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status !== "APPROVED" ? (
                      <ActionButton
                        onClick={() => act(r.id, "APPROVE")}
                        disabled={busyId === r.id}
                        tone="emerald"
                        icon={<Check className="h-3.5 w-3.5" />}
                        label="Onayla"
                      />
                    ) : null}
                    {r.status === "APPROVED" ? (
                      <ActionButton
                        onClick={() => act(r.id, "HIDE")}
                        disabled={busyId === r.id}
                        tone="zinc"
                        icon={<EyeOff className="h-3.5 w-3.5" />}
                        label="Gizlət"
                      />
                    ) : null}
                    {r.status !== "REJECTED" ? (
                      <ActionButton
                        onClick={() => act(r.id, "REJECT")}
                        disabled={busyId === r.id}
                        tone="rose"
                        icon={<X className="h-3.5 w-3.5" />}
                        label="Rədd et"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  tone,
  icon,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  tone: "emerald" | "rose" | "zinc";
  icon: React.ReactNode;
  label: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
      : tone === "rose"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}
