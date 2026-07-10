"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useDialog } from "@/lib/dialogs";
import { ENTRY_CONDITION_LABELS } from "@/lib/giveawaysShared";

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

      {/* Siyahı */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Yüklənir...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500">Hələ çəkiliş yoxdur.</p>
        ) : (
          items.map((g) => {
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
    </div>
  );
}
