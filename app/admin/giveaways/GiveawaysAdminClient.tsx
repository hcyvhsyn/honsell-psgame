"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useDialog } from "@/lib/dialogs";
import {
  ENTRY_CONDITION_LABELS,
  giveawayShareUrl,
  buildGiveawayShareText,
} from "@/lib/giveawaysShared";
import { SITE_URL } from "@/lib/site";

type Giveaway = {
  id: string;
  title: string;
  description: string | null;
  prizeLabel: string;
  prizeImageUrl: string | null;
  status: string;
  winnersCount: number;
  entryCondition: string;
  conditionType: string | null;
  isVip: boolean;
  participantBoost: number;
  endAt: string;
  drawnAt: string | null;
  createdAt: string;
  _count: { entries: number };
};

type Participant = {
  id: string;
  isWinner: boolean;
  notifiedAt: string | null;
  waStatus: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string; phone: string | null };
};

/** PURCHASE_PRODUCT şərti üçün ServiceProduct tipləri. */
const PRODUCT_TYPES: { value: string; label: string }[] = [
  { value: "STREAMING", label: "Streaming / Musiqi (Spotify, Netflix, ...)" },
  { value: "PS_PLUS", label: "PS Plus" },
  { value: "EA_PLAY", label: "EA Play" },
  { value: "TRY_BALANCE", label: "TL Balans / Gift Card" },
  { value: "HONSELL_GIFT_CARD", label: "Honsell Gift Card" },
  { value: "PLATFORM", label: "Platforma abunəliyi (AI/iş)" },
  { value: "PUBG_UC", label: "PUBG UC" },
  { value: "POINT_BLANK_TG", label: "Point Blank" },
  { value: "ACCOUNT_CREATION", label: "PSN Hesab açma" },
  { value: "EPIC_ACCOUNT_CREATION", label: "Epic Hesab açma" },
];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-violet-100 text-violet-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Qaralama",
  ACTIVE: "Aktiv",
  COMPLETED: "Tamamlandı",
  CANCELLED: "Ləğv olundu",
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "Hamısı" },
  { value: "ACTIVE", label: "Aktiv" },
  { value: "COMPLETED", label: "Keçmiş" },
  { value: "DRAFT", label: "Qaralama" },
  { value: "CANCELLED", label: "Ləğv" },
];

function toLocalInput(iso: string): string {
  // datetime-local üçün "YYYY-MM-DDTHH:mm".
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const EMPTY_FORM = {
  title: "",
  description: "",
  prizeLabel: "",
  prizeImageUrl: "",
  winnersCount: 1,
  entryCondition: "REGISTER_ONLY",
  conditionType: "STREAMING",
  isVip: false,
  participantBoost: 0,
  endAt: "",
  activateNow: false,
};

export default function GiveawaysAdminClient() {
  const dialog = useDialog();
  const [items, setItems] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // İştirakçılar modalı
  const [participantsFor, setParticipantsFor] = useState<Giveaway | null>(null);
  const [participants, setParticipants] = useState<Participant[] | null>(null);

  // Paylaş modalı
  const [shareFor, setShareFor] = useState<Giveaway | null>(null);
  const [copied, setCopied] = useState(false);

  // Status filtri (keçmiş çəkilişləri asan tapmaq üçün)
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const refresh = useCallback(() => {
    startTransition(async () => {
      setError(null);
      setLoading(true);
      const res = await fetch("/api/admin/giveaways", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Yükləmə alınmadı.");
        return;
      }
      setItems(Array.isArray(data.giveaways) ? data.giveaways : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  }

  function startEdit(g: Giveaway) {
    setEditingId(g.id);
    setForm({
      title: g.title,
      description: g.description ?? "",
      prizeLabel: g.prizeLabel,
      prizeImageUrl: g.prizeImageUrl ?? "",
      winnersCount: g.winnersCount,
      entryCondition: g.entryCondition,
      conditionType: g.conditionType ?? "STREAMING",
      isVip: g.isVip,
      participantBoost: g.participantBoost,
      endAt: toLocalInput(g.endAt),
      activateNow: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    startTransition(async () => {
      setError(null);
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        prizeLabel: form.prizeLabel,
        prizeImageUrl: form.prizeImageUrl,
        winnersCount: Number(form.winnersCount),
        entryCondition: form.entryCondition,
        conditionType: form.conditionType,
        isVip: form.isVip,
        participantBoost: Number(form.participantBoost),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : "",
      };
      const isEdit = Boolean(editingId);
      if (!isEdit && form.activateNow) payload.status = "ACTIVE";

      const res = await fetch(
        isEdit ? `/api/admin/giveaways/${editingId}` : "/api/admin/giveaways",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Yadda saxlamaq alınmadı.");
        return;
      }
      resetForm();
      refresh();
    });
  }

  function patchStatus(g: Giveaway, status: string) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/giveaways/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Alınmadı.");
        return;
      }
      refresh();
    });
  }

  async function drawWinners(g: Giveaway) {
    const ok = await dialog.confirm({
      title: "Qalibləri çək",
      message: `"${g.title}" üçün ${g.winnersCount} qalib random seçiləcək. Əvvəlki qaliblər varsa sıfırlanacaq. Davam edilsin?`,
      confirmLabel: "Qalibləri çək",
    });
    if (!ok) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/giveaways/${g.id}/draw`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Çəkiliş alınmadı.");
        return;
      }
      await dialog.alert({
        title: "Qaliblər çəkildi",
        message: `${data.winners?.length ?? 0} qalib seçildi. İndi qaliblərə WhatsApp bildirişi göndərə bilərsən.`,
      });
      refresh();
    });
  }

  async function notifyWinners(g: Giveaway) {
    const ok = await dialog.confirm({
      title: "Qaliblərə bildiriş",
      message: `"${g.title}" qaliblərinin WhatsApp-ına təbrik mesajı göndərilsin? (yalnız hələ bildirilməmişlərə)`,
      confirmLabel: "Göndər",
    });
    if (!ok) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/giveaways/${g.id}/notify`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Göndərmək alınmadı.");
        return;
      }
      await dialog.alert({
        title: "Bildiriş nəticəsi",
        message: `Göndərildi: ${data.sent} · Uğursuz: ${data.failed} · Telefonsuz: ${data.skipped}`,
      });
      refresh();
    });
  }

  function openParticipants(g: Giveaway) {
    setParticipantsFor(g);
    setParticipants(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/giveaways/${g.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setParticipants([]);
        return;
      }
      setParticipants(Array.isArray(data.giveaway?.entries) ? data.giveaway.entries : []);
    });
  }

  function openShare(g: Giveaway) {
    setShareFor(g);
    setCopied(false);
  }

  async function copyShareLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard bloklanıbsa istifadəçi əllə kopyalayır */
    }
  }

  async function remove(g: Giveaway) {
    const ok = await dialog.confirm({
      title: "Sil",
      message: `"${g.title}" çəkilişi və bütün qoşulmalar silinsin?`,
      confirmLabel: "Sil",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/giveaways/${g.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Silmək alınmadı.");
        return;
      }
      refresh();
    });
  }

  const visibleItems =
    statusFilter === "ALL" ? items : items.filter((g) => g.status === statusFilter);

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400";

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Yaratma / redaktə formu */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? "Çəkilişi redaktə et" : "Yeni çəkiliş"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">Başlıq</span>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="10 kişiyə Amazon 1000 TL hədiyyə çeki!"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">Mükafat etiketi</span>
            <input
              className={inputCls}
              value={form.prizeLabel}
              onChange={(e) => setForm((f) => ({ ...f, prizeLabel: e.target.value }))}
              placeholder="Amazon 1000 TL"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">
              Mükafat şəkli (URL, opsional)
            </span>
            <input
              className={inputCls}
              value={form.prizeImageUrl}
              onChange={(e) => setForm((f) => ({ ...f, prizeImageUrl: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">Təsvir (opsional)</span>
            <textarea
              className={inputCls}
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">Qoşulma şərti</span>
            <select
              className={inputCls}
              value={form.entryCondition}
              onChange={(e) => setForm((f) => ({ ...f, entryCondition: e.target.value }))}
            >
              {Object.entries(ENTRY_CONDITION_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {form.entryCondition === "PURCHASE_PRODUCT" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-600">Məhsul tipi</span>
              <select
                className={inputCls}
                value={form.conditionType}
                onChange={(e) => setForm((f) => ({ ...f, conditionType: e.target.value }))}
              >
                {PRODUCT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">Qalib sayı</span>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={form.winnersCount}
              onChange={(e) => setForm((f) => ({ ...f, winnersCount: Number(e.target.value) }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">
              İştirakçı boost (sosial sübut)
            </span>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.participantBoost}
              onChange={(e) => setForm((f) => ({ ...f, participantBoost: Number(e.target.value) }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">Bitiş tarixi</span>
            <input
              type="datetime-local"
              className={inputCls}
              value={form.endAt}
              onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
            />
          </label>
          <div className="flex items-end gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input
                type="checkbox"
                checked={form.isVip}
                onChange={(e) => setForm((f) => ({ ...f, isVip: e.target.checked }))}
              />
              VIP nişanı
            </label>
            {!editingId && (
              <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.activateNow}
                  onChange={(e) => setForm((f) => ({ ...f, activateNow: e.target.checked }))}
                />
                Dərhal aktivləşdir
              </label>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {editingId ? "Dəyişiklikləri saxla" : "Çəkiliş yarat"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Ləğv et
            </button>
          )}
        </div>
      </div>

      {/* Status filtri */}
      {!loading && items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.value === "ALL" ? items.length : items.filter((g) => g.status === f.value).length;
            const on = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
                  on
                    ? "bg-violet-600 text-white ring-violet-600"
                    : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Siyahı */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Yüklənir...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500">Hələ çəkiliş yoxdur.</p>
        ) : visibleItems.length === 0 ? (
          <p className="text-sm text-zinc-500">Bu statusda çəkiliş yoxdur.</p>
        ) : (
          visibleItems.map((g) => {
            const ended = new Date(g.endAt).getTime() <= Date.now();
            return (
              <div
                key={g.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          STATUS_BADGE[g.status] ?? "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {STATUS_LABEL[g.status] ?? g.status}
                      </span>
                      {g.isVip && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                          VIP
                        </span>
                      )}
                      {ended && g.status === "ACTIVE" && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                          Vaxtı bitib — çəkiliş gözləyir
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 font-semibold text-zinc-900">{g.title}</h3>
                    <p className="text-sm text-zinc-500">
                      🎁 {g.prizeLabel} · {g.winnersCount} qalib ·{" "}
                      {ENTRY_CONDITION_LABELS[g.entryCondition as keyof typeof ENTRY_CONDITION_LABELS] ??
                        g.entryCondition}
                      {g.conditionType ? ` (${g.conditionType})` : ""}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Qoşulan: <strong>{g._count.entries}</strong>
                      {g.participantBoost > 0 && (
                        <> · Göstərilən: <strong>{g._count.entries + g.participantBoost}</strong> (boost +{g.participantBoost})</>
                      )}{" "}
                      · Bitiş: {new Date(g.endAt).toLocaleString("az-AZ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openParticipants(g)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      İştirakçılar ({g._count.entries})
                    </button>
                    <button
                      onClick={() => openShare(g)}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      WhatsApp paylaş
                    </button>
                    {g.status === "DRAFT" && (
                      <button
                        onClick={() => patchStatus(g, "ACTIVE")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Aktivləşdir
                      </button>
                    )}
                    {g.status === "ACTIVE" && (
                      <>
                        <button
                          onClick={() => drawWinners(g)}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          Qalibləri çək
                        </button>
                        <button
                          onClick={() => patchStatus(g, "DRAFT")}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          Dayandır
                        </button>
                      </>
                    )}
                    {g.status === "COMPLETED" && (
                      <>
                        <button
                          onClick={() => notifyWinners(g)}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          Qaliblərə WhatsApp
                        </button>
                        <button
                          onClick={() => drawWinners(g)}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          Yenidən çək
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => startEdit(g)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Redaktə
                    </button>
                    <button
                      onClick={() => remove(g)}
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* İştirakçılar modalı */}
      {participantsFor && (
        <ParticipantsModal
          giveaway={participantsFor}
          participants={participants}
          onClose={() => {
            setParticipantsFor(null);
            setParticipants(null);
          }}
        />
      )}

      {/* Paylaş modalı */}
      {shareFor && (
        <ShareModal
          giveaway={shareFor}
          copied={copied}
          onCopy={copyShareLink}
          onClose={() => setShareFor(null)}
        />
      )}
    </div>
  );
}

function ParticipantsModal({
  giveaway,
  participants,
  onClose,
}: {
  giveaway: Giveaway;
  participants: Participant[] | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-900">İştirakçılar</h3>
            <p className="truncate text-xs text-zinc-500">{giveaway.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Bağla
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {participants === null ? (
            <p className="py-6 text-center text-sm text-zinc-500">Yüklənir…</p>
          ) : participants.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Hələ qoşulan yoxdur.</p>
          ) : (
            <ul className="space-y-2">
              {participants.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5"
                >
                  <span className="w-5 shrink-0 text-right text-xs font-semibold text-zinc-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-zinc-900">
                        {p.user.name || p.user.email}
                      </span>
                      {p.isWinner && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          🏆 Qalib
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {p.user.email}
                      {p.user.phone ? ` · ${p.user.phone}` : " · nömrə yoxdur"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ShareModal({
  giveaway,
  copied,
  onCopy,
  onClose,
}: {
  giveaway: Giveaway;
  copied: boolean;
  onCopy: (url: string) => void;
  onClose: () => void;
}) {
  const url = giveawayShareUrl(SITE_URL, giveaway.id);
  const shareText = buildGiveawayShareText(
    { title: giveaway.title, prizeLabel: giveaway.prizeLabel, winnersCount: giveaway.winnersCount },
    url
  );
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-900">WhatsApp-la paylaş</h3>
            <p className="truncate text-xs text-zinc-500">{giveaway.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Bağla
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {giveaway.status !== "ACTIVE" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Diqqət: çəkiliş aktiv deyil. Müştərilər linkə keçə bilər, amma yalnız «Aktiv»
              olduqda qoşula bilər.
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">Çəkilişin linki</span>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
              />
              <button
                onClick={() => onCopy(url)}
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                {copied ? "✓ Kopyalandı" : "Kopyala"}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">
              Göndəriləcək mesaj (önizləmə)
            </span>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-emerald-600/20 bg-emerald-50/40 p-3 text-xs text-zinc-800">
              {shareText}
            </pre>
          </label>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
          >
            WhatsApp-da aç
          </a>
          <p className="text-xs text-zinc-500">
            «WhatsApp-da aç» mesajı hazır şəkildə açır — istədiyin müştəri və ya qrupu seçib
            göndər. Linki birbaşa da kopyalayıb göndərə bilərsən.
          </p>
        </div>
      </div>
    </div>
  );
}
