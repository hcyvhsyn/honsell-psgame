"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useDialog } from "@/lib/dialogs";
import {
  ENTRY_CONDITION_LABELS,
  SOCIAL_PLATFORMS,
  giveawayShareUrl,
  buildGiveawayShareText,
} from "@/lib/giveawaysShared";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import { SITE_URL } from "@/lib/site";
import GiveawayDetailModal from "./GiveawayDetailModal";

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
  conditionUrl: string | null;
  isVip: boolean;
  participantBoost: number;
  minSpendAznCents: number | null;
  ticketUnitAznCents: number | null;
  endAt: string;
  drawnAt: string | null;
  createdAt: string;
  _count: { entries: number };
};

type BatchState = {
  title: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  skippedNoPhone: number;
  currentName: string | null;
  nextInSec: number | null;
  done: boolean;
  cancelled: boolean;
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
  DRAFT: "bg-admin-chip text-zinc-600",
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
  conditionPlatform: "INSTAGRAM",
  conditionUrl: "",
  isVip: false,
  participantBoost: 0,
  minSpendAzn: "",
  ticketUnitAzn: "",
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

  // Mükafat şəkli yükləməsi
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  // Qalib/rəy idarəetmə modalı (İştirakçılar / Qaliblər / Rəylər tabları)
  const [detailFor, setDetailFor] = useState<Giveaway | null>(null);

  // WhatsApp toplu göndəriş (10s aralıq + geri sayım)
  const [batch, setBatch] = useState<BatchState | null>(null);
  const batchCancelRef = useRef(false);

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

  async function onPickPrizeImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Yalnız şəkil faylı seçilə bilər.");
      return;
    }
    setImgUploading(true);
    setError(null);
    const up = await uploadAdminImage("/api/admin/giveaways/image-upload", file);
    setImgUploading(false);
    if (!up.ok) {
      setError(up.error);
      return;
    }
    setForm((f) => ({ ...f, prizeImageUrl: up.url }));
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
      // conditionType DB-də şərtə görə ya məhsul tipi, ya platforma kodudur.
      conditionType:
        g.entryCondition === "PURCHASE_PRODUCT" ? g.conditionType ?? "STREAMING" : "STREAMING",
      conditionPlatform:
        g.entryCondition === "FOLLOW_SOCIAL" ? g.conditionType ?? "INSTAGRAM" : "INSTAGRAM",
      conditionUrl: g.conditionUrl ?? "",
      isVip: g.isVip,
      participantBoost: g.participantBoost,
      minSpendAzn: g.minSpendAznCents != null ? String(g.minSpendAznCents / 100) : "",
      ticketUnitAzn: g.ticketUnitAznCents != null ? String(g.ticketUnitAznCents / 100) : "",
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
        conditionType:
          form.entryCondition === "FOLLOW_SOCIAL" ? form.conditionPlatform : form.conditionType,
        conditionUrl: form.conditionUrl,
        isVip: form.isVip,
        participantBoost: Number(form.participantBoost),
        // AZN → qəpik. Boş/0 → null (PATCH-də təmizlənir).
        minSpendAznCents:
          form.entryCondition === "PURCHASE_MIN_AMOUNT" && Number(form.minSpendAzn) > 0
            ? Math.round(Number(form.minSpendAzn) * 100)
            : null,
        ticketUnitAznCents:
          Number(form.ticketUnitAzn) > 0 ? Math.round(Number(form.ticketUnitAzn) * 100) : null,
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
    await runBatchSend({
      endpoint: `/api/admin/giveaways/${g.id}/notify`,
      title: "Qaliblərə təbrik mesajı",
      confirmMessage: (n) =>
        `"${g.title}" üçün ${n} qalibə təbrik + rəy linki 10 saniyə aralıqla göndəriləcək. Davam edilsin?`,
    });
  }

  async function sendReviewLinks(g: Giveaway) {
    await runBatchSend({
      endpoint: `/api/admin/giveaways/${g.id}/send-review-links`,
      title: "Qaliblərə rəy linki",
      confirmMessage: (n) =>
        `"${g.title}" üçün ${n} qalibə rəy linki 10 saniyə aralıqla göndəriləcək. Bunu mükafatları çatdırdıqdan SONRA et. Davam edilsin?`,
    });
  }

  // 10 saniyə aralıqla, bir-bir göndəriş + ekranda canlı geri sayım.
  async function runBatchSend({
    endpoint,
    title,
    confirmMessage,
  }: {
    endpoint: string;
    title: string;
    confirmMessage: (n: number) => string;
  }) {
    setError(null);
    // 1) Göndəriləcək qalibləri gətir.
    const listRes = await fetch(endpoint, { cache: "no-store" });
    const listData = await listRes.json().catch(() => ({}));
    if (!listRes.ok) {
      setError(listData.error ?? "Siyahı alınmadı.");
      return;
    }
    const recipients: { entryId: string; name: string | null }[] = listData.recipients ?? [];
    const skippedNoPhone: number = listData.skippedNoPhone ?? 0;

    if (recipients.length === 0) {
      await dialog.alert({
        title,
        message:
          skippedNoPhone > 0
            ? `Göndəriləcək qalib yoxdur. ${skippedNoPhone} qalibin nömrəsi yoxdur.`
            : "Göndəriləcək qalib yoxdur (hamısına artıq göndərilib və ya nömrə yoxdur).",
      });
      return;
    }

    const ok = await dialog.confirm({
      title,
      message: confirmMessage(recipients.length),
      confirmLabel: "Başla",
    });
    if (!ok) return;

    // 2) Batch vəziyyətini başlat.
    batchCancelRef.current = false;
    setBatch({
      title,
      total: recipients.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      skippedNoPhone,
      currentName: null,
      nextInSec: null,
      done: false,
      cancelled: false,
    });

    const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (let i = 0; i < recipients.length; i++) {
      if (batchCancelRef.current) {
        setBatch((b) => (b ? { ...b, done: true, cancelled: true, nextInSec: null, currentName: null } : b));
        break;
      }
      const r = recipients[i];
      setBatch((b) => (b ? { ...b, currentName: r.name || "(adsız)", nextInSec: null } : b));

      let status = "FAILED";
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId: r.entryId }),
        });
        const data = await res.json().catch(() => ({}));
        status = res.ok ? data.status ?? "FAILED" : "FAILED";
      } catch {
        status = "FAILED";
      }
      setBatch((b) =>
        b
          ? {
              ...b,
              sent: b.sent + (status === "SENT" || status === "SKIPPED" ? 1 : 0),
              failed: b.failed + (status === "FAILED" || status === "NO_PHONE" ? 1 : 0),
            }
          : b
      );

      // Sonuncu deyilsə 10 saniyə geri sayım.
      if (i < recipients.length - 1 && !batchCancelRef.current) {
        for (let s = 10; s > 0; s--) {
          if (batchCancelRef.current) break;
          setBatch((b) => (b ? { ...b, nextInSec: s } : b));
          await sleepMs(1000);
        }
      }
    }

    setBatch((b) => (b ? { ...b, done: true, currentName: null, nextInSec: null } : b));
    refresh();
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
    "w-full rounded-lg border border-admin-line2 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400";

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Yaratma / redaktə formu */}
      <div className="rounded-2xl border border-admin-line bg-admin-card p-5 shadow-sm">
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
          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-600">
              Mükafat şəkli (opsional)
            </span>
            <div className="flex items-center gap-2">
              {form.prizeImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.prizeImageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg border border-admin-line object-cover"
                />
              )}
              <input
                className={inputCls}
                value={form.prizeImageUrl}
                onChange={(e) => setForm((f) => ({ ...f, prizeImageUrl: e.target.value }))}
                placeholder="https://... və ya sağdan yüklə"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imgUploading}
                className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
              >
                {imgUploading ? "Yüklənir…" : "Şəkil yüklə"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onPickPrizeImage}
              />
            </div>
          </div>
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
          {form.entryCondition === "PURCHASE_MIN_AMOUNT" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-600">
                Minimum xərc (AZN)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={form.minSpendAzn}
                onChange={(e) => setForm((f) => ({ ...f, minSpendAzn: e.target.value }))}
                placeholder="30"
              />
              <span className="mt-1 block text-[11px] text-zinc-400">
                Bu qədər (və ya çox) uğurlu xərci olan qoşula bilər.
              </span>
            </label>
          )}
          {form.entryCondition === "FOLLOW_SOCIAL" && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-600">Platforma</span>
                <select
                  className={inputCls}
                  value={form.conditionPlatform}
                  onChange={(e) => setForm((f) => ({ ...f, conditionPlatform: e.target.value }))}
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-zinc-600">
                  Səhifəmizin linki (izlənəcək)
                </span>
                <input
                  className={inputCls}
                  value={form.conditionUrl}
                  onChange={(e) => setForm((f) => ({ ...f, conditionUrl: e.target.value }))}
                  placeholder="https://www.facebook.com/honsellstore"
                />
              </label>
            </>
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
            <span className="mb-1 block text-xs font-semibold text-zinc-600">
              Bilet vahidi (AZN) — opsional
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputCls}
              value={form.ticketUnitAzn}
              onChange={(e) => setForm((f) => ({ ...f, ticketUnitAzn: e.target.value }))}
              placeholder="məs. 30"
            />
            <span className="mt-1 block text-[11px] text-zinc-400">
              Doldurulsa: hər bu qədər AZN xərc = 1 əlavə şans (weighted çəkiliş). Boş = hamı bərabər.
            </span>
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
              className="rounded-lg border border-admin-line2 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-admin-chip"
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
                    : "bg-admin-card text-zinc-600 ring-zinc-300 hover:bg-admin-chip"
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
                className="rounded-2xl border border-admin-line bg-admin-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          STATUS_BADGE[g.status] ?? "bg-admin-chip text-zinc-600"
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
                      onClick={() => setDetailFor(g)}
                      className="rounded-lg border border-admin-line2 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-admin-chip"
                    >
                      Qalib / Rəy idarəsi ({g._count.entries})
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
                          className="rounded-lg border border-admin-line2 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-admin-chip"
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
                          onClick={() => sendReviewLinks(g)}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          Rəy linki göndər
                        </button>
                        <button
                          onClick={() => drawWinners(g)}
                          className="rounded-lg border border-admin-line2 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-admin-chip"
                        >
                          Yenidən çək
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => startEdit(g)}
                      className="rounded-lg border border-admin-line2 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-admin-chip"
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

      {/* Qalib / Rəy idarəetmə modalı (3 tab) */}
      {detailFor && (
        <GiveawayDetailModal
          giveaway={{
            id: detailFor.id,
            title: detailFor.title,
            prizeLabel: detailFor.prizeLabel,
            winnersCount: detailFor.winnersCount,
          }}
          onClose={() => setDetailFor(null)}
          onChanged={refresh}
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

      {/* WhatsApp toplu göndəriş — irəliləyiş + geri sayım */}
      {batch && (
        <BatchProgressModal
          batch={batch}
          onCancel={() => {
            batchCancelRef.current = true;
          }}
          onClose={() => setBatch(null)}
        />
      )}
    </div>
  );
}

function BatchProgressModal({
  batch,
  onCancel,
  onClose,
}: {
  batch: BatchState;
  onCancel: () => void;
  onClose: () => void;
}) {
  const processed = batch.sent + batch.failed;
  const pct = batch.total ? Math.round((processed / batch.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-admin-card p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-zinc-900">{batch.title}</h3>

        {/* İrəliləyiş */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-semibold text-zinc-700">
              {processed} / {batch.total} göndərildi
            </span>
            <span className="tabular-nums text-zinc-500">{pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-admin-chip2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Cari vəziyyət */}
        {!batch.done && (
          <div className="mt-4 rounded-xl bg-admin-chip px-4 py-3 text-sm">
            {batch.nextInSec != null ? (
              <span className="text-zinc-700">
                Növbəti mesaj: <span className="font-black tabular-nums text-violet-600">{batch.nextInSec}s</span>
              </span>
            ) : batch.currentName ? (
              <span className="text-zinc-700">
                Göndərilir: <span className="font-bold">{batch.currentName}</span>…
              </span>
            ) : (
              <span className="text-zinc-500">Hazırlanır…</span>
            )}
          </div>
        )}

        {/* Nəticə */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">✓ {batch.sent}</span>
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">✗ {batch.failed}</span>
          {batch.skippedNoPhone > 0 && (
            <span className="rounded-full bg-admin-chip px-2.5 py-1 text-zinc-600">
              Nömrəsiz: {batch.skippedNoPhone}
            </span>
          )}
        </div>

        {/* Düymələr */}
        <div className="mt-5 flex justify-end gap-2">
          {batch.done ? (
            <button
              onClick={onClose}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
            >
              {batch.cancelled ? "Dayandırıldı — bağla" : "Bitdi — bağla"}
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              Dayandır
            </button>
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
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-admin-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-admin-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-900">WhatsApp-la paylaş</h3>
            <p className="truncate text-xs text-zinc-500">{giveaway.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-admin-line2 px-3 py-1 text-sm font-semibold text-zinc-600 hover:bg-admin-chip"
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
                className="w-full rounded-lg border border-admin-line2 bg-admin-chip px-3 py-2 text-sm text-zinc-700"
              />
              <button
                onClick={() => onCopy(url)}
                className="shrink-0 rounded-lg border border-admin-line2 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-admin-chip"
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
