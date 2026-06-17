"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Check, X, Trash2, Shield, ShieldOff, Star } from "lucide-react";
import { STREAMING_SERVICE_LABELS } from "@/lib/streamingCart";
import { formatAzDateTime } from "@/lib/streamingLanguages";
import { useDialog } from "@/lib/dialogs";

type Review = {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; trusted: boolean };
  tmdbId: number;
  kind: "MOVIE" | "SERIES";
  service: string;
  rating: number;
  body: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectedReason: string | null;
  titleSnap: string;
  posterUrlSnap: string | null;
  yearSnap: number | null;
  createdAt: string;
};

const TABS: { key: "PENDING" | "APPROVED" | "REJECTED"; label: string }[] = [
  { key: "PENDING", label: "Yoxlanılır" },
  { key: "APPROVED", label: "Yayımda" },
  { key: "REJECTED", label: "Rədd edilmiş" },
];

export default function StreamingReviewsAdminClient() {
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/streaming-reviews?status=${activeTab}`);
    if (res.ok) {
      const d = await res.json();
      setItems(d.reviews ?? []);
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    await fetch("/api/admin/streaming-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE", id }),
    });
    load();
  }

  async function reject(id: string) {
    const reason = prompt("Rədd səbəbi (opsional):");
    await fetch("/api/admin/streaming-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", id, reason }),
    });
    load();
  }

  async function deleteReview(id: string) {
    if (
      !(await dialog.confirm({
        title: "İcmalı sil?",
        message: "Bu icmal tamamilə silinəcək.",
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    await fetch("/api/admin/streaming-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  async function toggleTrusted(userId: string, currently: boolean) {
    await fetch("/api/admin/streaming-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_TRUSTED", userId, trusted: !currently }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              activeTab === t.key
                ? "bg-violet-600 text-white"
                : "bg-admin-card text-zinc-700 hover:bg-admin-chip2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card py-16 text-center text-zinc-500">
          Bu kateqoriyada icmal yoxdur.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <article key={r.id} className="grid gap-3 rounded-xl border border-admin-line bg-admin-card p-4 sm:grid-cols-[80px_minmax(0,1fr)]">
              <div className="relative h-28 w-20 overflow-hidden rounded bg-admin-card">
                {r.posterUrlSnap && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={r.posterUrlSnap} alt="" className="h-full w-full object-cover" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-zinc-900">{r.titleSnap}</p>
                    <p className="text-xs text-zinc-500">
                      {r.kind === "SERIES" ? "Serial" : "Film"}
                      {r.yearSnap ? ` · ${r.yearSnap}` : ""} ·
                      {" "}
                      {STREAMING_SERVICE_LABELS[r.service] ?? r.service} · TMDB {r.tmdbId}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[12px] font-bold text-amber-700 ring-1 ring-amber-400/30">
                    <Star className="h-3 w-3 fill-current" /> {r.rating}/10
                  </span>
                </div>

                <p className="mt-2 text-xs text-zinc-500">
                  Müəllif: <span className="text-zinc-700">{r.user.name}</span> · {r.user.email}
                  {r.user.trusted && (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Etibarlı
                    </span>
                  )}
                  <span className="ml-2 text-zinc-600">{formatAzDateTime(r.createdAt)}</span>
                </p>

                <p className="mt-2 whitespace-pre-line text-sm text-zinc-800">{r.body}</p>

                {r.rejectedReason && (
                  <p className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-700">
                    Rədd səbəbi: {r.rejectedReason}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status !== "APPROVED" && (
                    <button
                      onClick={() => approve(r.id)}
                      className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400"
                    >
                      <Check className="h-3.5 w-3.5" /> Təsdiqlə
                    </button>
                  )}
                  {r.status !== "REJECTED" && (
                    <button
                      onClick={() => reject(r.id)}
                      className="inline-flex items-center gap-1 rounded bg-rose-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      <X className="h-3.5 w-3.5" /> Rədd et
                    </button>
                  )}
                  <button
                    onClick={() => deleteReview(r.id)}
                    className="inline-flex items-center gap-1 rounded bg-admin-chip px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-admin-chip2"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Sil
                  </button>
                  <button
                    onClick={() => toggleTrusted(r.userId, r.user.trusted)}
                    title={r.user.trusted
                      ? "Etibarlılığı ləğv et — gələcək icmalları yoxlamadan keçəcək"
                      : "Etibarlı et — bu istifadəçinin icmalları dərhal yayımlansın"}
                    className={`ml-auto inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition ${
                      r.user.trusted
                        ? "bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30"
                        : "bg-admin-chip text-zinc-700 hover:bg-admin-chip2"
                    }`}
                  >
                    {r.user.trusted ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {r.user.trusted ? "Etibarlı (ləğv et)" : "Etibarlı et"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
