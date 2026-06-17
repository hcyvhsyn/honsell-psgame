"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, EyeOff, Heart, Loader2, MessageCircle, X } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

type AdminPost = {
  id: string;
  category: string;
  categoryLabel: string;
  title: string | null;
  body: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  moderatedAt: string | null;
  moderationNote: string | null;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
  commentCount: number;
  reactionCount: number;
};

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "ALL";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "PENDING", label: "Gözləyir" },
  { key: "APPROVED", label: "Onaylı" },
  { key: "REJECTED", label: "Rədd" },
  { key: "HIDDEN", label: "Gizli" },
  { key: "ALL", label: "Hamısı" },
];

const STATUS_BADGE: Record<AdminPost["status"], string> = {
  PENDING: "bg-amber-500/15 text-amber-700 ring-amber-500/40",
  APPROVED: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/40",
  REJECTED: "bg-rose-500/15 text-rose-700 ring-rose-500/40",
  HIDDEN: "bg-zinc-500/15 text-zinc-700 ring-admin-line2",
};

const STATUS_LABEL: Record<AdminPost["status"], string> = {
  PENDING: "Gözləyir",
  APPROVED: "Onaylı",
  REJECTED: "Rədd",
  HIDDEN: "Gizli",
};

export default function CommunityAdminClient({
  initialCounts,
}: {
  initialCounts: Record<string, number>;
}) {
  const dialog = useDialog();
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);

  const load = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/community?status=${encodeURIComponent(status)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPosts(json.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yükləmə xətası");
      setPosts([]);
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
      const res = await fetch(`/api/admin/community/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        await dialog.alert({
          title: "Əməliyyat alınmadı",
          message: json?.error ?? `Xəta: HTTP ${res.status}`,
          tone: "danger",
        });
        return;
      }
      setPosts((prev) => {
        const before = prev.find((p) => p.id === id);
        const after = before ? { ...before, status: json.status as AdminPost["status"] } : null;
        const stillFits = filter === "ALL" || (after && after.status === filter);
        return stillFits && after
          ? prev.map((p) => (p.id === id ? after : p))
          : prev.filter((p) => p.id !== id);
      });
      setCounts((prev) => {
        const updated = { ...prev };
        const before = posts.find((p) => p.id === id);
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
                  ? "border-violet-500/60 bg-violet-500/15 text-violet-700"
                  : "border-admin-line bg-admin-card text-zinc-600 hover:text-zinc-900",
              ].join(" ")}
            >
              {label}
              {count !== undefined ? (
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    active ? "bg-violet-500/30 text-violet-100" : "bg-admin-chip text-zinc-600",
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
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-admin-line bg-admin-card p-10 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-admin-line bg-admin-card p-10 text-center text-sm text-zinc-500">
          Bu filtə uyğun paylaşım yoxdur.
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id} className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATUS_BADGE[p.status]}`}
                >
                  {STATUS_LABEL[p.status]}
                </span>
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-500/40">
                  {p.categoryLabel}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {new Date(p.createdAt).toLocaleString("az-Latn-AZ")}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <Heart className="h-3 w-3" /> {p.reactionCount}
                  <MessageCircle className="ml-1.5 h-3 w-3" /> {p.commentCount}
                </span>
              </div>

              <div className="text-[11px] text-zinc-500">
                {p.author.name ?? p.author.email.split("@")[0]} ·{" "}
                <span className="text-zinc-600">{p.author.email}</span>
              </div>

              {p.title ? (
                <h3 className="mt-2 text-sm font-bold text-zinc-900">{p.title}</h3>
              ) : null}
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {p.body}
              </p>

              {p.moderationNote ? (
                <div className="mt-2 rounded-md border border-admin-line bg-admin-card px-3 py-2 text-[12px] text-zinc-600">
                  Admin qeydi: {p.moderationNote}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {p.status !== "APPROVED" ? (
                  <ActionButton
                    onClick={() => act(p.id, "APPROVE")}
                    disabled={busyId === p.id}
                    tone="emerald"
                    icon={<Check className="h-3.5 w-3.5" />}
                    label="Onayla"
                  />
                ) : null}
                {p.status === "APPROVED" ? (
                  <ActionButton
                    onClick={() => act(p.id, "HIDE")}
                    disabled={busyId === p.id}
                    tone="zinc"
                    icon={<EyeOff className="h-3.5 w-3.5" />}
                    label="Gizlət"
                  />
                ) : null}
                {p.status !== "REJECTED" ? (
                  <ActionButton
                    onClick={() => act(p.id, "REJECT")}
                    disabled={busyId === p.id}
                    tone="rose"
                    icon={<X className="h-3.5 w-3.5" />}
                    label="Rədd et"
                  />
                ) : null}
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
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
      : tone === "rose"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"
        : "border-admin-line2 bg-admin-card text-zinc-700 hover:bg-admin-chip2";
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
