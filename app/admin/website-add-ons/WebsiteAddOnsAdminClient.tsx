"use client";

import { useEffect, useState } from "react";
import { Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

type AddOn = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  pricingType: "FLAT" | "PER_UNIT";
  flatPrice: string | number | null;
  freeUnits: number | null;
  unitPrice: string | number | null;
  unitLabel: string | null;
  isActive: boolean;
  sortOrder: number;
};

type EditState = {
  slug: string;
  name: string;
  description: string;
  category: string;
  pricingType: "FLAT" | "PER_UNIT";
  flatPrice: string;
  freeUnits: string;
  unitPrice: string;
  unitLabel: string;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY: EditState = {
  slug: "",
  name: "",
  description: "",
  category: "",
  pricingType: "FLAT",
  flatPrice: "",
  freeUnits: "",
  unitPrice: "",
  unitLabel: "",
  isActive: true,
  sortOrder: "0",
};

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatPrice(a: AddOn): string {
  if (a.pricingType === "FLAT") {
    const p = toNum(a.flatPrice);
    return p !== null ? `${p} AZN` : "—";
  }
  const u = toNum(a.unitPrice);
  const free = a.freeUnits ?? 0;
  const label = a.unitLabel ?? "vahid";
  if (u === null) return "—";
  return free > 0
    ? `${free} ${label} pulsuz, sonra ${u} AZN/${label}`
    : `${u} AZN/${label}`;
}

export default function WebsiteAddOnsAdminClient() {
  const [items, setItems] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [form, setForm] = useState<EditState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useDialog();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/website-add-ons");
      if (res.ok) {
        const data = await res.json();
        setItems(data.addOns ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setError(null);
    setEditingId("NEW");
    setForm({ ...EMPTY, sortOrder: String(items.length) });
  }

  function startEdit(a: AddOn) {
    setError(null);
    setEditingId(a.id);
    setForm({
      slug: a.slug,
      name: a.name,
      description: a.description ?? "",
      category: a.category ?? "",
      pricingType: a.pricingType,
      flatPrice: a.flatPrice != null ? String(a.flatPrice) : "",
      freeUnits: a.freeUnits != null ? String(a.freeUnits) : "",
      unitPrice: a.unitPrice != null ? String(a.unitPrice) : "",
      unitLabel: a.unitLabel ?? "",
      isActive: a.isActive,
      sortOrder: String(a.sortOrder),
    });
  }

  function cancel() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Ad tələb olunur.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        slug: form.slug.trim() || undefined,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        pricingType: form.pricingType,
        flatPrice: form.pricingType === "FLAT" ? form.flatPrice : null,
        freeUnits: form.pricingType === "PER_UNIT" ? form.freeUnits : null,
        unitPrice: form.pricingType === "PER_UNIT" ? form.unitPrice : null,
        unitLabel: form.pricingType === "PER_UNIT" ? form.unitLabel : null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const isNew = editingId === "NEW";
      const url = isNew
        ? "/api/admin/website-add-ons"
        : `/api/admin/website-add-ons/${editingId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(String(data.error ?? "Yadda saxlanmadı."));
        return;
      }
      cancel();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: AddOn) {
    const ok = await dialog.confirm({
      title: "Əlavə xidməti sil?",
      message: (
        <p>
          <span className="font-medium text-zinc-800">«{a.name}»</span> add-on
          silinəcək.
        </p>
      ),
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/website-add-ons/${a.id}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Cəmi {items.length} add-on
        </p>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" />
          Yeni add-on
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-admin-card text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Ad / Slug</th>
              <th className="px-4 py-3 font-medium">Kateqoriya</th>
              <th className="px-4 py-3 font-medium">Qiymət</th>
              <th className="px-4 py-3 font-medium">Aktiv?</th>
              <th className="px-4 py-3 font-medium text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  Hələ add-on əlavə edilməyib.
                </td>
              </tr>
            )}
            {items.map((a) => (
              <tr key={a.id} className="hover:bg-admin-chip">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{a.name}</div>
                  <div className="text-xs text-zinc-500">{a.slug}</div>
                </td>
                <td className="px-4 py-3 text-zinc-700">{a.category ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-800">{formatPrice(a)}</td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      "rounded px-2 py-1 text-[10px] font-semibold ring-1",
                      a.isActive
                        ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30"
                        : "bg-admin-chip text-zinc-600 ring-admin-line2",
                    ].join(" ")}
                  >
                    {a.isActive ? "Aktiv" : "Söndürülüb"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => startEdit(a)}
                      className="rounded p-1.5 text-zinc-600 hover:bg-admin-chip2 hover:text-zinc-900"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="rounded p-1.5 text-rose-600 hover:bg-admin-chip2 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 w-full max-w-2xl rounded-2xl border border-admin-line bg-admin-card shadow-2xl">
            <div className="border-b border-admin-line px-6 py-4">
              <h3 className="text-lg font-bold">
                {editingId === "NEW" ? "Yeni add-on" : "Add-on-u redaktə et"}
              </h3>
            </div>

            <div className="space-y-4 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="Ad *"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder="Dark / Light mode"
                />
                <TextInput
                  label="Slug"
                  value={form.slug}
                  onChange={(v) => setForm({ ...form, slug: v })}
                  placeholder="ad əsasında avtomatik yaradılır"
                />
                <TextInput
                  label="Kateqoriya"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  placeholder="məs: Dizayn, Setup"
                />
                <NumberInput
                  label="Sıra"
                  value={form.sortOrder}
                  onChange={(v) => setForm({ ...form, sortOrder: v })}
                />
              </div>

              <TextArea
                label="Təsvir"
                value={form.description}
                onChange={(v) => setForm({ ...form, description: v })}
                placeholder="Müştəri formunda görünür"
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Qiymət tipi
                </label>
                <div className="mt-2 inline-flex rounded-lg border border-admin-line bg-admin-card p-1">
                  {(["FLAT", "PER_UNIT"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, pricingType: t })}
                      className={[
                        "rounded px-3 py-1.5 text-xs font-semibold transition",
                        form.pricingType === t
                          ? "bg-violet-600 text-white"
                          : "text-zinc-600 hover:text-zinc-900",
                      ].join(" ")}
                    >
                      {t === "FLAT" ? "Sabit qiymət" : "Vahid başına"}
                    </button>
                  ))}
                </div>
              </div>

              {form.pricingType === "FLAT" ? (
                <NumberInput
                  label="Sabit qiymət (AZN) *"
                  value={form.flatPrice}
                  onChange={(v) => setForm({ ...form, flatPrice: v })}
                  placeholder="30"
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberInput
                    label="Pulsuz vahid sayı"
                    value={form.freeUnits}
                    onChange={(v) => setForm({ ...form, freeUnits: v })}
                    placeholder="1"
                  />
                  <NumberInput
                    label="Vahid qiyməti (AZN) *"
                    value={form.unitPrice}
                    onChange={(v) => setForm({ ...form, unitPrice: v })}
                    placeholder="20"
                  />
                  <TextInput
                    label="Vahid adı"
                    value={form.unitLabel}
                    onChange={(v) => setForm({ ...form, unitLabel: v })}
                    placeholder="dil, məhsul, səhifə"
                  />
                </div>
              )}

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-admin-line2 bg-admin-card text-violet-500 focus:ring-violet-500"
                />
                <span className="text-sm text-zinc-800">Aktiv (müştəri görür)</span>
              </label>

              {error && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-admin-line px-6 py-4">
              <button
                onClick={cancel}
                disabled={saving}
                className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-800 hover:bg-admin-chip2 disabled:opacity-50"
              >
                Ləğv et
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {label}
      </span>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500"
      />
    </label>
  );
}
