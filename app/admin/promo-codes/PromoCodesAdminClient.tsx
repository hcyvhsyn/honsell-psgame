"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, X, Loader2, Eye, EyeOff, TicketPercent, Copy, Check } from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import {
  PROMO_SCOPE_PRODUCT_TYPES,
  PROMO_SCOPE_TYPE_LABELS,
  buildCustomerCouponMessage,
} from "@/lib/promoScopeShared";
import PromoScopePicker from "./PromoScopePicker";

type PromoCode = {
  id: string;
  code: string;
  kind: string;
  value: number;
  maxDiscountCents: number | null;
  minOrderCents: number;
  productTypes: string[];
  gameIds: string[];
  serviceProductIds: string[];
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  source: string;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  _count?: { redemptions: number };
};

type FormState = {
  id?: string;
  code: string;
  kind: string;
  value: string; // PERCENT: %, FIXED: AZN
  maxDiscountAzn: string;
  minOrderAzn: string;
  productTypes: string[];
  gameIds: string[];
  serviceProductIds: string[];
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  kind: "PERCENT",
  value: "",
  maxDiscountAzn: "",
  minOrderAzn: "",
  productTypes: [],
  gameIds: [],
  serviceProductIds: [],
  usageLimit: "",
  perUserLimit: "1",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function PromoCodesAdminClient() {
  const dialog = useDialog();
  const [items, setItems] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  /** Seçilmiş scope məhsullarının id → ad xəritəsi (müştəri mətni üçün). */
  const [scopeNames, setScopeNames] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-codes", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setForm(EMPTY);
    setScopeNames({});
    setCopied(false);
    setOpen(true);
  }
  function openEdit(p: PromoCode) {
    setScopeNames({});
    setCopied(false);
    setForm({
      id: p.id,
      code: p.code,
      kind: p.kind,
      value: p.kind === "FIXED" ? (p.value / 100).toString() : p.value.toString(),
      maxDiscountAzn: p.maxDiscountCents ? (p.maxDiscountCents / 100).toString() : "",
      minOrderAzn: p.minOrderCents ? (p.minOrderCents / 100).toString() : "",
      productTypes: p.productTypes ?? [],
      gameIds: p.gameIds ?? [],
      serviceProductIds: p.serviceProductIds ?? [],
      usageLimit: p.usageLimit ? p.usageLimit.toString() : "",
      perUserLimit: p.perUserLimit.toString(),
      startsAt: toDateInput(p.startsAt),
      expiresAt: toDateInput(p.expiresAt),
      isActive: p.isActive,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.code.trim()) {
      await dialog.alert({ title: "Kod tələb olunur", tone: "warning" });
      return;
    }
    const valueNum = Number(form.value);
    if (!(valueNum > 0)) {
      await dialog.alert({ title: "Dəyər 0-dan böyük olmalıdır", tone: "warning" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        action: "UPSERT",
        id: form.id,
        code: form.code,
        kind: form.kind,
        value: form.kind === "FIXED" ? Math.round(valueNum * 100) : Math.round(valueNum),
        maxDiscountCents: form.maxDiscountAzn ? Math.round(Number(form.maxDiscountAzn) * 100) : null,
        minOrderCents: form.minOrderAzn ? Math.round(Number(form.minOrderAzn) * 100) : 0,
        productTypes: form.productTypes,
        gameIds: form.gameIds,
        serviceProductIds: form.serviceProductIds,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : 1,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        isActive: form.isActive,
      };
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        await dialog.alert({ title: "Yadda saxlanmadı", message: data.error, tone: "danger" });
        return;
      }
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: PromoCode) {
    await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ACTIVE", id: p.id, isActive: !p.isActive }),
    });
    await load();
  }

  async function remove(p: PromoCode) {
    const ok = await dialog.confirm({
      title: "Kupon silinsin?",
      message: `"${p.code}" həmişəlik silinəcək.`,
      tone: "danger",
      confirmLabel: "Sil",
    });
    if (!ok) return;
    await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id: p.id }),
    });
    await load();
  }

  function fmtDiscount(p: PromoCode): string {
    return p.kind === "FIXED" ? `${(p.value / 100).toFixed(2)} ₼` : `${p.value}%`;
  }

  /** Cədvəldə scope-u qısa göstər: növ etiketləri + neçə konkret məhsul. */
  function fmtScope(p: PromoCode): string {
    const parts = (p.productTypes ?? []).map((t) => PROMO_SCOPE_TYPE_LABELS[t] ?? t);
    const products = (p.gameIds?.length ?? 0) + (p.serviceProductIds?.length ?? 0);
    if (products > 0) parts.push(`${products} məhsul`);
    return parts.join(" · ");
  }

  const scopeCount =
    form.productTypes.length + form.gameIds.length + form.serviceProductIds.length;

  // Müştəriyə göndərilə bilən izah mətni — formun canlı dəyərlərindən qurulur.
  const customerMessage = useMemo(() => {
    if (!form.code.trim() || !(Number(form.value) > 0)) return "";
    const productNames = [...form.gameIds, ...form.serviceProductIds].map(
      (id) => scopeNames[id] ?? id,
    );
    return buildCustomerCouponMessage({
      code: form.code.trim().toUpperCase(),
      kind: form.kind,
      value: Number(form.value),
      maxDiscountAzn: form.maxDiscountAzn ? Number(form.maxDiscountAzn) : null,
      minOrderAzn: form.minOrderAzn ? Number(form.minOrderAzn) : null,
      productTypes: form.productTypes,
      productNames,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
      perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
    });
  }, [form, scopeNames]);

  async function copyMessage() {
    if (!customerMessage) return;
    try {
      await navigator.clipboard.writeText(customerMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await dialog.alert({ title: "Kopyalanmadı", message: "Mətni əl ilə seçin.", tone: "warning" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{items.length} kupon</span>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" /> Yeni kupon
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center text-sm text-zinc-500">
          Hələ kupon yoxdur.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Kod</th>
                <th className="px-3 py-2">Endirim</th>
                <th className="px-3 py-2">Min / Scope</th>
                <th className="px-3 py-2">İstifadə</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 font-mono font-semibold">
                      <TicketPercent className="h-3.5 w-3.5 text-violet-500" />
                      {p.code}
                    </div>
                    {p.source === "BONUS_REWARD" && (
                      <span className="text-[10px] text-fuchsia-500">bonus mükafatı</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-semibold">{fmtDiscount(p)}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {p.minOrderCents > 0 ? `min ${(p.minOrderCents / 100).toFixed(0)}₼` : "—"}
                    {fmtScope(p) ? ` · ${fmtScope(p)}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {p.usedCount}
                    {p.usageLimit != null ? `/${p.usageLimit}` : ""} ({p._count?.redemptions ?? 0})
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-500"
                      }`}
                    >
                      {p.isActive ? "Aktiv" : "Deaktiv"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-md p-1.5 hover:bg-zinc-200"
                        title="Redaktə"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(p)}
                        className="rounded-md p-1.5 hover:bg-zinc-200"
                        title={p.isActive ? "Deaktiv et" : "Aktiv et"}
                      >
                        {p.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                        title="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <h2 className="text-lg font-bold">{form.id ? "Kupon redaktə" : "Yeni kupon"}</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <Field label="Kod">
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="promo-input font-mono uppercase"
                  placeholder="YAY2026"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Növ">
                  <select
                    value={form.kind}
                    onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                    className="promo-input"
                  >
                    <option value="PERCENT">Faiz (%)</option>
                    <option value="FIXED">Sabit (AZN)</option>
                  </select>
                </Field>
                <Field label={form.kind === "FIXED" ? "Endirim (AZN)" : "Endirim (%)"}>
                  <input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className="promo-input"
                  />
                </Field>
              </div>
              {form.kind === "PERCENT" && (
                <Field label="Maksimum endirim (AZN, opsional)">
                  <input
                    type="number"
                    value={form.maxDiscountAzn}
                    onChange={(e) => setForm((f) => ({ ...f, maxDiscountAzn: e.target.value }))}
                    className="promo-input"
                  />
                </Field>
              )}
              <Field label="Min sifariş (AZN)">
                <input
                  type="number"
                  value={form.minOrderAzn}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderAzn: e.target.value }))}
                  className="promo-input"
                />
              </Field>

              <div className="rounded-xl border border-zinc-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-800">Scope (opsional)</span>
                  {scopeCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, productTypes: [], gameIds: [], serviceProductIds: [] }))
                      }
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
                    >
                      Təmizlə
                    </button>
                  )}
                </div>
                <p className="mb-3 text-xs text-zinc-500">
                  {scopeCount === 0
                    ? "Heç nə seçilməyib — kupon bütün səbətə tətbiq olunur."
                    : "Kupon yalnız seçilənlərə tətbiq olunur (endirim həmin sətirlərin cəmindən hesablanır)."}
                </p>

                <Field label="Məhsul növü üzrə">
                  <div className="flex flex-wrap gap-1.5">
                    {PROMO_SCOPE_PRODUCT_TYPES.map((t) => {
                      const on = form.productTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              productTypes: on
                                ? f.productTypes.filter((x) => x !== t)
                                : [...f.productTypes, t],
                            }))
                          }
                          className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                            on
                              ? "border-violet-500 bg-violet-100 text-violet-800"
                              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          }`}
                        >
                          {PROMO_SCOPE_TYPE_LABELS[t] ?? t}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="mt-3">
                  <Field label="Konkret məhsula özəl (oyun / platforma paketi)">
                    <PromoScopePicker
                      gameIds={form.gameIds}
                      serviceProductIds={form.serviceProductIds}
                      onChange={(next) => setForm((f) => ({ ...f, ...next }))}
                      onNamesChange={setScopeNames}
                    />
                  </Field>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Qlobal limit (opsional)">
                  <input
                    type="number"
                    value={form.usageLimit}
                    onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                    className="promo-input"
                  />
                </Field>
                <Field label="İstifadəçi başına limit">
                  <input
                    type="number"
                    value={form.perUserLimit}
                    onChange={(e) => setForm((f) => ({ ...f, perUserLimit: e.target.value }))}
                    className="promo-input"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Başlanğıc (opsional)">
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className="promo-input"
                  />
                </Field>
                <Field label="Bitmə (opsional)">
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="promo-input"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4"
                />
                Aktiv
              </label>

              {customerMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-800">
                      Müştəriyə göndəriləcək mətn
                    </span>
                    <button
                      type="button"
                      onClick={copyMessage}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        copied
                          ? "bg-emerald-600 text-white"
                          : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Kopyalandı" : "Kopyala"}
                    </button>
                  </div>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-white p-2.5 text-xs leading-relaxed text-zinc-700">
                    {customerMessage}
                  </pre>
                  <p className="mt-1.5 text-[11px] text-emerald-700/80">
                    Bu mətn formdakı dəyərlərə görə avtomatik yenilənir — kodu yadda saxladıqdan sonra kopyalayıb müştəriyə göndərin.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-100 p-4">
              <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-100">
                Ləğv et
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Yadda saxla
              </button>
            </div>
          </div>

          <style jsx>{`
            :global(.promo-input) {
              width: 100%;
              border-radius: 0.5rem;
              border: 1px solid rgb(228 228 231);
              padding: 0.5rem 0.75rem;
              font-size: 0.875rem;
              outline: none;
            }
            :global(.promo-input:focus) {
              border-color: rgb(139 92 246);
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-zinc-600">{label}</label>
      {children}
    </div>
  );
}
