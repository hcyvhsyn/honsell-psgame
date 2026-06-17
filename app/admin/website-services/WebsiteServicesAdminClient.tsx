"use client";

import { useEffect, useState } from "react";
import { Edit2, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

type Pkg = {
  id: string;
  name: string;
  priceRange: string;
  description: string;
  features: unknown;
  deliveryTime: string | null;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
};

type EditState = {
  name: string;
  priceRange: string;
  description: string;
  featuresText: string;
  deliveryTime: string;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: string;
};

function featuresToText(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((v) => String(v ?? "")).join("\n");
  return "";
}

const EMPTY_FORM: EditState = {
  name: "",
  priceRange: "",
  description: "",
  featuresText: "",
  deliveryTime: "",
  isPopular: false,
  isActive: true,
  sortOrder: "0",
};

export default function WebsiteServicesAdminClient() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [form, setForm] = useState<EditState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dialog = useDialog();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/website-service-packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setSaveError(null);
    setEditingId("NEW");
    setForm({ ...EMPTY_FORM, sortOrder: String(packages.length) });
  }

  function startEdit(p: Pkg) {
    setSaveError(null);
    setEditingId(p.id);
    setForm({
      name: p.name,
      priceRange: p.priceRange,
      description: p.description,
      featuresText: featuresToText(p.features),
      deliveryTime: p.deliveryTime ?? "",
      isPopular: p.isPopular,
      isActive: p.isActive,
      sortOrder: String(p.sortOrder),
    });
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: form.name,
        priceRange: form.priceRange,
        description: form.description,
        features: form.featuresText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        deliveryTime: form.deliveryTime,
        isPopular: form.isPopular,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const url =
        editingId === "NEW"
          ? "/api/admin/website-service-packages"
          : `/api/admin/website-service-packages/${editingId}`;
      const method = editingId === "NEW" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(String(data.error ?? `Yadda saxlanmadı (${res.status})`));
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Pkg) {
    const ok = await dialog.confirm({
      title: "Paketi sil?",
      message: (
        <p>
          <span className="font-medium text-zinc-800">«{p.name}»</span> paketi silinəcək.
          Bu paketə bağlı müraciətlər saxlanılacaq, paket sahəsi NULL olacaq.
        </p>
      ),
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/website-service-packages/${p.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Silinmədi",
        message: String(data.error ?? res.status),
        tone: "danger",
      });
      return;
    }
    load();
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
      <div className="flex justify-end">
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" /> Yeni paket
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-admin-card text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">Sıra</th>
              <th className="px-5 py-4 font-medium">Ad</th>
              <th className="px-5 py-4 font-medium">Qiymət aralığı</th>
              <th className="px-5 py-4 font-medium">Təhvil</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {packages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                  Hələ paket əlavə edilməyib.
                </td>
              </tr>
            )}
            {packages.map((p) => (
              <tr key={p.id} className="transition hover:bg-admin-chip">
                <td className="px-5 py-4 tabular-nums text-zinc-600">{p.sortOrder}</td>
                <td className="px-5 py-4 font-medium text-zinc-800">
                  <span className="inline-flex items-center gap-2">
                    {p.name}
                    {p.isPopular && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-500/30">
                        <Star className="h-3 w-3" />
                        Ən çox seçilən
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-4 text-zinc-700">{p.priceRange}</td>
                <td className="px-5 py-4 text-zinc-600">{p.deliveryTime ?? "—"}</td>
                <td className="px-5 py-4">
                  {p.isActive ? (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Aktiv
                    </span>
                  ) : (
                    <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                      Passiv
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      title="Redaktə et"
                      className="p-2 text-zinc-500 hover:text-violet-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(p)}
                      title="Sil"
                      className="p-2 text-zinc-500 hover:text-rose-600"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">
              {editingId === "NEW" ? "Yeni paket" : "Paketi redaktə et"}
            </h3>
            <div className="grid gap-4">
              <label className="block text-sm">
                Paket adı
                <input
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Basic / Standard / Premium Paket"
                />
              </label>
              <label className="block text-sm">
                Qiymət aralığı
                <input
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={form.priceRange}
                  onChange={(e) => setForm({ ...form, priceRange: e.target.value })}
                  placeholder="150–300 AZN"
                />
              </label>
              <label className="block text-sm">
                Qısa təsvir
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Xüsusiyyətlər (hər sətirə bir element)
                <textarea
                  rows={6}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 font-mono text-xs text-emerald-700"
                  value={form.featuresText}
                  onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
                  placeholder={`1 səhifəlik website\nMobil uyğun dizayn\nWhatsApp əlaqə düyməsi`}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  Təhvil müddəti
                  <input
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={form.deliveryTime}
                    onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })}
                    placeholder="3–5 gün"
                  />
                </label>
                <label className="block text-sm">
                  Sıralama (0 ən öndə)
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isPopular}
                    onChange={(e) => setForm({ ...form, isPopular: e.target.checked })}
                  />{" "}
                  Ən çox seçilən
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />{" "}
                  Aktivdir
                </label>
              </div>
            </div>
            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                {saveError}
              </div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingId(null);
                  setSaveError(null);
                }}
                className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700"
              >
                İmtina
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Yadda saxlanır..." : "Yadda saxla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
