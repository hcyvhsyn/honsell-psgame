"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/lib/dialogs";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import {
  WINNER_SOURCES,
  REVIEW_SOURCES,
  REVIEW_STATUSES,
  winnerSourceLabel,
  selectionMethodLabel,
  reviewSourceLabel,
  reviewStatusLabel,
  isStoreNote,
  type ReviewStatus,
} from "@/lib/giveawayWinnersShared";

type GiveawayLite = { id: string; title: string; prizeLabel: string; winnersCount: number };

type Participant = {
  id: string;
  isWinner: boolean;
  createdAt: string;
  user: { id: string; name: string | null; email: string; phone: string | null };
};

type Review = {
  id: string;
  text: string;
  rating: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  source: string;
  entryMethod: string;
  originalSubmittedAt: string | null;
  enteredByAdminId: string | null;
  hasPublishingConsent: boolean;
  status: string;
  isPublic: boolean;
  internalNote: string | null;
  createdAt: string;
};

type Winner = {
  id: string;
  entryId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  instagramUsername: string | null;
  avatarUrl: string | null;
  prizeTitle: string | null;
  source: string;
  selectionMethod: string;
  selectedAt: string;
  proofUrl: string | null;
  proofIsPublic: boolean;
  internalNote: string | null;
  isPublic: boolean;
  reviews: Review[];
};

type Tab = "participants" | "winners" | "reviews";

export default function GiveawayDetailModal({
  giveaway,
  onClose,
  onChanged,
}: {
  giveaway: GiveawayLite;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>("winners");
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddWinner, setShowAddWinner] = useState(false);
  const [reviewForWinner, setReviewForWinner] = useState<Winner | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [pRes, wRes] = await Promise.all([
      fetch(`/api/admin/giveaways/${giveaway.id}`, { cache: "no-store" }),
      fetch(`/api/admin/giveaways/${giveaway.id}/winners`, { cache: "no-store" }),
    ]);
    const pData = await pRes.json().catch(() => ({}));
    const wData = await wRes.json().catch(() => ({}));
    setParticipants(Array.isArray(pData.giveaway?.entries) ? pData.giveaway.entries : []);
    setWinners(Array.isArray(wData.winners) ? wData.winners : []);
  }, [giveaway.id]);

  useEffect(() => {
    load();
  }, [load]);

  const winnerCount = winners?.length ?? 0;
  const limitReached = winnerCount >= giveaway.winnersCount;

  async function refreshAll() {
    await load();
    onChanged();
  }

  async function markWinner(entryId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/giveaways/${giveaway.id}/winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (data.code === "WINNER_LIMIT") {
        const inc = await dialog.confirm({
          title: "Qalib sayı tamamlanıb",
          message: `${data.error} Qalib sayını artırmaq istəyirsən?`,
          confirmLabel: "Bəli, artır",
        });
        if (inc) await bumpWinnerCount();
        return;
      }
      setError(data.error ?? "Alınmadı.");
      return;
    }
    refreshAll();
  }

  async function bumpWinnerCount() {
    // winnersCount + 1 (mövcud qalibləri saxlayaraq limiti genişləndir).
    const res = await fetch(`/api/admin/giveaways/${giveaway.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnersCount: giveaway.winnersCount + 1 }),
    });
    if (res.ok) {
      await dialog.alert({
        title: "Yeniləndi",
        message: `Qalib sayı ${giveaway.winnersCount + 1}-ə qaldırıldı. Modalı bağlayıb yenidən aç ki, yeni limit tətbiq olunsun.`,
      });
      onChanged();
    }
  }

  async function deleteWinner(w: Winner) {
    const ok = await dialog.confirm({
      title: "Qalibi sil",
      message: `"${w.name}" qalib siyahısından silinsin? Rəyləri də silinəcək.`,
      confirmLabel: "Sil",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/admin/giveaways/${giveaway.id}/winners/${w.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Silinmədi.");
      return;
    }
    refreshAll();
  }

  async function toggleWinnerPublic(w: Winner) {
    setBusy(true);
    const res = await fetch(`/api/admin/giveaways/${giveaway.id}/winners/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !w.isPublic }),
    });
    setBusy(false);
    if (res.ok) refreshAll();
  }

  async function moderateReview(w: Winner, r: Review, patch: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(
      `/api/admin/giveaways/${giveaway.id}/winners/${w.id}/reviews/${r.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    setBusy(false);
    if (res.ok) refreshAll();
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Alınmadı.");
    }
  }

  async function deleteReview(w: Winner, r: Review) {
    const ok = await dialog.confirm({
      title: "Rəyi sil",
      message: "Bu rəy silinsin?",
      confirmLabel: "Sil",
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(
      `/api/admin/giveaways/${giveaway.id}/winners/${w.id}/reviews/${r.id}`,
      { method: "DELETE" }
    );
    setBusy(false);
    if (res.ok) refreshAll();
  }

  const winnerByEntry = new Map((winners ?? []).filter((w) => w.entryId).map((w) => [w.entryId!, w]));
  const allReviews = (winners ?? []).flatMap((w) => w.reviews.map((r) => ({ w, r })));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlıq */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-900">{giveaway.title}</h3>
            <p className="text-xs text-zinc-500">
              Qalib: {winnerCount}/{giveaway.winnersCount} · {giveaway.prizeLabel}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            ✕
          </button>
        </div>

        {/* Tablar */}
        <div className="flex border-b border-zinc-200 px-3">
          {([
            ["participants", `İştirakçılar (${participants?.length ?? "…"})`],
            ["winners", `Qaliblər (${winnerCount})`],
            ["reviews", `Rəylər (${allReviews.length})`],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold transition ${
                tab === t
                  ? "border-b-2 border-violet-600 text-violet-700"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── İştirakçılar ── */}
          {tab === "participants" && (
            participants === null ? (
              <p className="py-6 text-center text-sm text-zinc-500">Yüklənir…</p>
            ) : participants.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Hələ qoşulan yoxdur.</p>
            ) : (
              <ul className="space-y-2">
                {participants.map((p) => {
                  const w = winnerByEntry.get(p.id);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-zinc-900">
                          {p.user.name || p.user.email}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {p.user.email}
                          {p.user.phone ? ` · ${p.user.phone}` : " · nömrə yoxdur"}
                        </div>
                      </div>
                      {w ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                          🏆 Qalib
                        </span>
                      ) : (
                        <button
                          onClick={() => markWinner(p.id)}
                          disabled={busy || limitReached}
                          title={limitReached ? "Qalib sayı tamamlanıb" : undefined}
                          className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          Qalib et
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {/* ── Qaliblər ── */}
          {tab === "winners" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  Random, manual və xarici qaliblər birlikdə.
                </p>
                <button
                  onClick={() => setShowAddWinner(true)}
                  disabled={limitReached}
                  title={limitReached ? "Qalib sayı tamamlanıb" : undefined}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  + Qalib əlavə et (xarici)
                </button>
              </div>

              {showAddWinner && (
                <AddWinnerForm
                  giveawayId={giveaway.id}
                  onClose={() => setShowAddWinner(false)}
                  onSaved={() => {
                    setShowAddWinner(false);
                    refreshAll();
                  }}
                  onLimit={async (msg) => {
                    const inc = await dialog.confirm({
                      title: "Qalib sayı tamamlanıb",
                      message: `${msg} Qalib sayını artırmaq istəyirsən?`,
                      confirmLabel: "Bəli, artır",
                    });
                    if (inc) await bumpWinnerCount();
                  }}
                />
              )}

              {winners === null ? (
                <p className="py-6 text-center text-sm text-zinc-500">Yüklənir…</p>
              ) : winners.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">Hələ qalib yoxdur.</p>
              ) : (
                <ul className="space-y-2.5">
                  {winners.map((w) => (
                    <li key={w.id} className="rounded-xl border border-zinc-200 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-zinc-900">{w.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge tone="violet">{selectionMethodLabel(w.selectionMethod)}</Badge>
                            <Badge tone="zinc">{winnerSourceLabel(w.source)}</Badge>
                            {w.isPublic ? (
                              <Badge tone="emerald">İctimai</Badge>
                            ) : (
                              <Badge tone="zinc">Gizli</Badge>
                            )}
                            {w.reviews.length > 0 ? (
                              <Badge tone="blue">{w.reviews.length} rəy</Badge>
                            ) : (
                              <Badge tone="amber">Rəy yoxdur</Badge>
                            )}
                          </div>
                          {(w.instagramUsername || w.prizeTitle) && (
                            <div className="mt-1 text-xs text-zinc-500">
                              {w.instagramUsername ? `@${w.instagramUsername.replace(/^@/, "")}` : ""}
                              {w.instagramUsername && w.prizeTitle ? " · " : ""}
                              {w.prizeTitle ?? ""}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <button
                            onClick={() => setReviewForWinner(w)}
                            className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Rəy əlavə et
                          </button>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => toggleWinnerPublic(w)}
                              disabled={busy}
                              className="rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
                            >
                              {w.isPublic ? "Gizlət" : "İctimai et"}
                            </button>
                            <button
                              onClick={() => deleteWinner(w)}
                              disabled={busy}
                              className="rounded-lg border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      </div>
                      {reviewForWinner?.id === w.id && (
                        <AddReviewForm
                          giveawayId={giveaway.id}
                          winner={w}
                          onClose={() => setReviewForWinner(null)}
                          onSaved={() => {
                            setReviewForWinner(null);
                            refreshAll();
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Rəylər ── */}
          {tab === "reviews" && (
            winners === null ? (
              <p className="py-6 text-center text-sm text-zinc-500">Yüklənir…</p>
            ) : allReviews.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Hələ rəy yoxdur.</p>
            ) : (
              <ul className="space-y-3">
                {allReviews.map(({ w, r }) => (
                  <li key={r.id} className="rounded-xl border border-zinc-200 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-zinc-900">{w.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge tone={statusTone(r.status)}>{reviewStatusLabel(r.status)}</Badge>
                          <Badge tone="zinc">{reviewSourceLabel(r.source)}</Badge>
                          <Badge tone="zinc">{entryMethodLabel(r.entryMethod)}</Badge>
                          {r.isPublic ? <Badge tone="emerald">İctimai</Badge> : <Badge tone="zinc">Gizli</Badge>}
                          {r.hasPublishingConsent ? (
                            <Badge tone="emerald">İcazə var</Badge>
                          ) : (
                            <Badge tone="amber">İcazə yox</Badge>
                          )}
                          {isStoreNote(r.entryMethod) && <Badge tone="violet">Mağaza qeydi</Badge>}
                        </div>
                      </div>
                      {r.rating != null && (
                        <span className="shrink-0 text-xs font-bold text-amber-600">
                          {"★".repeat(r.rating)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{r.text}</p>
                    {r.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageUrl} alt="" className="mt-2 max-h-40 rounded-lg border border-zinc-200" />
                    )}
                    {r.internalNote && (
                      <p className="mt-1.5 text-xs text-zinc-400">Daxili qeyd: {r.internalNote}</p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {r.status !== "APPROVED" && (
                        <ModBtn onClick={() => moderateReview(w, r, { status: "APPROVED" })} tone="emerald">
                          Təsdiqlə
                        </ModBtn>
                      )}
                      {r.status !== "REJECTED" && (
                        <ModBtn onClick={() => moderateReview(w, r, { status: "REJECTED" })} tone="rose">
                          Rədd et
                        </ModBtn>
                      )}
                      {r.status !== "HIDDEN" && (
                        <ModBtn onClick={() => moderateReview(w, r, { status: "HIDDEN" })} tone="zinc">
                          Gizlət
                        </ModBtn>
                      )}
                      <ModBtn onClick={() => moderateReview(w, r, { isPublic: !r.isPublic })} tone="zinc">
                        {r.isPublic ? "Private et" : "Public et"}
                      </ModBtn>
                      <ModBtn
                        onClick={() => moderateReview(w, r, { hasPublishingConsent: !r.hasPublishingConsent })}
                        tone="zinc"
                      >
                        {r.hasPublishingConsent ? "İcazəni ləğv et" : "İcazə ver"}
                      </ModBtn>
                      <ModBtn onClick={() => deleteReview(w, r)} tone="rose">
                        Sil
                      </ModBtn>
                    </div>
                    {!isStoreNote(r.entryMethod) && r.status === "APPROVED" && r.isPublic && !r.hasPublishingConsent && (
                      <p className="mt-2 text-[11px] font-semibold text-amber-600">
                        ⚠ Bu rəy publik göstərilmir: qalibin paylaşma icazəsi yoxdur.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Xarici qalib əlavə formu ─────────────────────────────────────────────────

function AddWinnerForm({
  giveawayId,
  onClose,
  onSaved,
  onLimit,
}: {
  giveawayId: string;
  onClose: () => void;
  onSaved: () => void;
  onLimit: (msg: string) => void;
}) {
  const [f, setF] = useState({
    name: "",
    phone: "",
    instagramUsername: "",
    email: "",
    prizeTitle: "",
    source: "INSTAGRAM",
    selectedAt: new Date().toISOString().slice(0, 16),
    internalNote: "",
    isPublic: true,
    proofIsPublic: false,
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File, set: (u: string) => void) {
    setUploading(true);
    const res = await uploadAdminImage("/api/admin/giveaways/image-upload", file);
    setUploading(false);
    if (res.ok) set(res.url);
    else setErr(res.error);
  }

  async function save() {
    if (!f.name.trim()) {
      setErr("Ad tələb olunur.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/admin/giveaways/${giveawayId}/winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        instagramUsername: f.instagramUsername.trim() || null,
        email: f.email.trim() || null,
        prizeTitle: f.prizeTitle.trim() || null,
        source: f.source,
        selectedAt: f.selectedAt ? new Date(f.selectedAt).toISOString() : undefined,
        internalNote: f.internalNote.trim() || null,
        isPublic: f.isPublic,
        avatarUrl,
        proofUrl,
        proofIsPublic: f.proofIsPublic,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      if (data.code === "WINNER_LIMIT") {
        onLimit(data.error);
        return;
      }
      setErr(data.error ?? "Alınmadı.");
      return;
    }
    onSaved();
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold text-violet-800">Xarici qalib əlavə et</h4>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-800">
          Bağla
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ad *" value={f.name} onChange={(v) => setF({ ...f, name: v })} />
        <Field label="Telefon" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
        <Field
          label="Instagram username"
          value={f.instagramUsername}
          onChange={(v) => setF({ ...f, instagramUsername: v })}
        />
        <Field label="E-mail" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
        <Field label="Qazanılan hədiyyə" value={f.prizeTitle} onChange={(v) => setF({ ...f, prizeTitle: v })} />
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-zinc-600">Seçilmə mənbəyi</span>
          <select
            value={f.source}
            onChange={(e) => setF({ ...f, source: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
          >
            {WINNER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {winnerSourceLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-zinc-600">Seçilmə tarixi</span>
          <input
            type="datetime-local"
            value={f.selectedAt}
            onChange={(e) => setF({ ...f, selectedAt: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <Field label="Qeyd (daxili)" value={f.internalNote} onChange={(v) => setF({ ...f, internalNote: v })} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <UploadBtn label={avatarUrl ? "Profil şəkli ✓" : "Profil şəkli"} disabled={uploading} onFile={(file) => upload(file, setAvatarUrl)} />
        <UploadBtn label={proofUrl ? "Sübut faylı ✓" : "Sübut faylı"} disabled={uploading} onFile={(file) => upload(file, setProofUrl)} />
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />
          İctimai göstər
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={f.proofIsPublic}
            onChange={(e) => setF({ ...f, proofIsPublic: e.target.checked })}
          />
          Sübut ictimai
        </label>
      </div>

      {proofUrl && (
        <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
          ⚠ Sübut şəklində telefon, e-mail, sifariş məlumatı və şəxsi mesajları gizlət.
        </p>
      )}
      {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
      <button
        onClick={save}
        disabled={saving || uploading}
        className="mt-2.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {saving ? "Saxlanılır…" : "Qalibi əlavə et"}
      </button>
    </div>
  );
}

// ─── Rəy əlavə formu (admin transcribe / store note) ──────────────────────────

function AddReviewForm({
  giveawayId,
  winner,
  onClose,
  onSaved,
}: {
  giveawayId: string;
  winner: Winner;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    text: "",
    rating: "",
    source: "WHATSAPP",
    entryMethod: "ADMIN_TRANSCRIBED",
    originalSubmittedAt: "",
    hasPublishingConsent: false,
    status: "APPROVED" as ReviewStatus,
    isPublic: true,
    internalNote: "",
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const storeNote = f.entryMethod === "ADMIN_STORE_NOTE";

  async function upload(file: File) {
    setUploading(true);
    const res = await uploadAdminImage("/api/admin/giveaways/image-upload", file);
    setUploading(false);
    if (res.ok) setImageUrl(res.url);
    else setErr(res.error);
  }

  async function save() {
    if (!f.text.trim()) {
      setErr("Mətn tələb olunur.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/admin/giveaways/${giveawayId}/winners/${winner.id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: f.text,
        rating: f.rating ? Number(f.rating) : null,
        source: storeNote ? "STORE_NOTE" : f.source,
        entryMethod: f.entryMethod,
        originalSubmittedAt: f.originalSubmittedAt
          ? new Date(f.originalSubmittedAt).toISOString()
          : null,
        hasPublishingConsent: storeNote ? true : f.hasPublishingConsent,
        status: f.status,
        isPublic: f.isPublic,
        internalNote: f.internalNote.trim() || null,
        imageUrl,
        videoUrl: videoUrl.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setErr(data.error ?? "Alınmadı.");
      return;
    }
    onSaved();
  }

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-800">Rəy əlavə et — {winner.name}</h4>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-800">
          Bağla
        </button>
      </div>

      <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Daxiletmə üsulu</label>
      <select
        value={f.entryMethod}
        onChange={(e) => setF({ ...f, entryMethod: e.target.value })}
        className="mb-2 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
      >
        <option value="ADMIN_TRANSCRIBED">Qalibin mesajından köçürülüb (transcribe)</option>
        <option value="ADMIN_STORE_NOTE">Mağaza açıqlaması (qalib rəyi kimi göstərilmir)</option>
      </select>

      <textarea
        value={f.text}
        onChange={(e) => setF({ ...f, text: e.target.value })}
        rows={3}
        placeholder={storeNote ? "Mağaza açıqlaması mətni…" : "Qalibin real rəyinin mətni…"}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />

      {!storeNote && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-zinc-600">Reytinq (1–5)</span>
            <input
              type="number"
              min={1}
              max={5}
              value={f.rating}
              onChange={(e) => setF({ ...f, rating: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-zinc-600">Rəyin gəldiyi kanal</span>
            <select
              value={f.source}
              onChange={(e) => setF({ ...f, source: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
            >
              {REVIEW_SOURCES.filter((s) => s !== "STORE_NOTE").map((s) => (
                <option key={s} value={s}>
                  {reviewSourceLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-zinc-600">Göndərilmə tarixi</span>
            <input
              type="datetime-local"
              value={f.originalSubmittedAt}
              onChange={(e) => setF({ ...f, originalSubmittedAt: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-zinc-600">Video URL (opsional)</span>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>
      )}

      <label className="mt-2 block">
        <span className="mb-1 block text-[11px] font-semibold text-zinc-600">Moderasiya statusu</span>
        <select
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value as ReviewStatus })}
          className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
        >
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {reviewStatusLabel(s)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <UploadBtn label={imageUrl ? "Şəkil ✓" : "Şəkil / screenshot"} disabled={uploading} onFile={upload} />
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />
          İctimai göstər
        </label>
        {!storeNote && (
          <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
            <input
              type="checkbox"
              checked={f.hasPublishingConsent}
              onChange={(e) => setF({ ...f, hasPublishingConsent: e.target.checked })}
            />
            Qalibin paylaşmağa icazəsi var
          </label>
        )}
      </div>

      <Field
        label="Daxili qeyd"
        value={f.internalNote}
        onChange={(v) => setF({ ...f, internalNote: v })}
        className="mt-2"
      />

      {imageUrl && (
        <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
          ⚠ Screenshot-da telefon, e-mail, sifariş və şəxsi mesajları gizlət.
        </p>
      )}
      {!storeNote && f.isPublic && !f.hasPublishingConsent && (
        <p className="mt-1.5 text-[11px] font-semibold text-amber-600">
          Qeyd: icazə qeyd edilməsə bu rəy ictimai göstərilməyəcək.
        </p>
      )}
      {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
      <button
        onClick={save}
        disabled={saving || uploading}
        className="mt-2.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saxlanılır…" : "Rəyi əlavə et"}
      </button>
    </div>
  );
}

// ─── Kiçik köməkçi komponentlər ───────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold text-zinc-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
      />
    </label>
  );
}

function UploadBtn({
  label,
  disabled,
  onFile,
}: {
  label: string;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
      {label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

type Tone = "violet" | "zinc" | "emerald" | "amber" | "blue" | "rose";
const TONE: Record<Tone, string> = {
  violet: "bg-violet-100 text-violet-700",
  zinc: "bg-zinc-100 text-zinc-600",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  rose: "bg-rose-100 text-rose-700",
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[tone]}`}>{children}</span>
  );
}

function ModBtn({
  tone,
  onClick,
  children,
}: {
  tone: Tone;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${TONE[tone]} hover:opacity-80`}>
      {children}
    </button>
  );
}

function statusTone(status: string): Tone {
  if (status === "APPROVED") return "emerald";
  if (status === "REJECTED") return "rose";
  if (status === "HIDDEN") return "zinc";
  return "amber";
}

function entryMethodLabel(m: string): string {
  if (m === "USER_SUBMITTED") return "Qalib göndərib";
  if (m === "ADMIN_TRANSCRIBED") return "Admin köçürüb";
  if (m === "ADMIN_STORE_NOTE") return "Mağaza qeydi";
  return m;
}
