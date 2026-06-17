"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  Check,
  Crown,
  Edit2,
  Film,
  Gamepad2,
  Gift,
  Loader2,
  Music,
  Plus,
  Search as SearchIcon,
  Sparkles,
  Trash2,
  Trophy,
  Tv,
  X,
} from "lucide-react";
import {
  SEARCH_SUGGESTION_ICON_KEYS,
  SEARCH_SUGGESTION_ICON_LABEL,
  type SearchSuggestionIconKey,
} from "@/lib/searchSuggestions";
import { useDialog } from "@/lib/dialogs";

type Row = {
  id: string;
  label: string;
  iconKey: string;
  isActive: boolean;
  sortOrder: number;
};

const ICONS: Record<SearchSuggestionIconKey, React.ComponentType<{ className?: string }>> = {
  SEARCH: SearchIcon,
  GAMEPAD: Gamepad2,
  GIFT: Gift,
  TV: Tv,
  FILM: Film,
  SPARKLES: Sparkles,
  TROPHY: Trophy,
  CROWN: Crown,
  MUSIC: Music,
  BRAIN: Brain,
};

function iconOf(key: string) {
  return ICONS[(SEARCH_SUGGESTION_ICON_KEYS.includes(key as never)
    ? key
    : "SEARCH") as SearchSuggestionIconKey];
}

export default function SearchSuggestionsAdminClient() {
  const dialog = useDialog();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [form, setForm] = useState<{
    label: string;
    iconKey: SearchSuggestionIconKey;
    isActive: boolean;
    sortOrder: number;
  }>({ label: "", iconKey: "SEARCH", isActive: true, sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/search-suggestions", { cache: "no-store" });
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setError(null);
    setEditingId("NEW");
    setForm({
      label: "",
      iconKey: "SEARCH",
      isActive: true,
      sortOrder: rows.length,
    });
  }

  function startEdit(r: Row) {
    setError(null);
    setEditingId(r.id);
    setForm({
      label: r.label,
      iconKey: (SEARCH_SUGGESTION_ICON_KEYS.includes(r.iconKey as never)
        ? r.iconKey
        : "SEARCH") as SearchSuggestionIconKey,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/search-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT",
          id: editingId === "NEW" ? undefined : editingId,
          label: form.label,
          iconKey: form.iconKey,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Yadda saxlanmadı (${res.status})`);
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Row) {
    if (
      !(await dialog.confirm({
        title: "Sırauma sil?",
        message: <p>«{r.label}» sırauma silinsin?</p>,
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    const res = await fetch("/api/admin/search-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id: r.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Silinmədi",
        message: j.error ?? "Silinmədi",
        tone: "danger",
      });
      return;
    }
    await load();
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
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" /> Yeni sırauma
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-admin-card text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">İkon</th>
              <th className="px-5 py-4 font-medium">Mətn</th>
              <th className="px-5 py-4 font-medium">Sıralama</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {rows.map((r) => {
              const Icon = iconOf(r.iconKey);
              return (
                <tr key={r.id} className="transition hover:bg-admin-chip">
                  <td className="px-5 py-4">
                    <span className="inline-grid h-9 w-9 place-items-center rounded-xl border border-admin-line bg-admin-chip text-zinc-800">
                      <Icon className="h-4 w-4" />
                    </span>
                  </td>
                  <td className="px-5 py-4 font-medium text-zinc-900">{r.label}</td>
                  <td className="px-5 py-4 tabular-nums text-zinc-600">{r.sortOrder}</td>
                  <td className="px-5 py-4">
                    {r.isActive ? (
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700">
                        Aktiv
                      </span>
                    ) : (
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs text-rose-600">
                        Passiv
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => startEdit(r)}
                        title="Redaktə et"
                        className="p-2 text-zinc-500 hover:text-violet-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        title="Sil"
                        className="p-2 text-zinc-500 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-zinc-500">
            Hələ sırauma əlavə edilməyib. Boş olduqda axtarış modalı default 6 elementi göstərir.
          </div>
        )}
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold">Populyar axtarış</h3>
              <button
                onClick={() => {
                  setEditingId(null);
                  setError(null);
                }}
                className="rounded p-1 text-zinc-500 hover:bg-admin-chip2 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm">
                Mətn (istifadəçi gördüyü)
                <input
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={form.label}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Məs: Spider-Man"
                />
              </label>

              <label className="block text-sm">
                İkon
                <select
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={form.iconKey}
                  onChange={(e) =>
                    setForm({ ...form, iconKey: e.target.value as SearchSuggestionIconKey })
                  }
                >
                  {SEARCH_SUGGESTION_ICON_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {SEARCH_SUGGESTION_ICON_LABEL[k]} ({k})
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SEARCH_SUGGESTION_ICON_KEYS.map((k) => {
                    const Icon = ICONS[k];
                    const active = form.iconKey === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setForm({ ...form, iconKey: k })}
                        className={`inline-flex h-9 w-9 place-items-center justify-center rounded-lg border transition ${
                          active
                            ? "border-violet-500/60 bg-violet-500/15 text-violet-700"
                            : "border-admin-line bg-admin-chip text-zinc-600 hover:border-admin-line2 hover:text-zinc-900"
                        }`}
                        title={SEARCH_SUGGESTION_ICON_LABEL[k]}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </label>

              <label className="block text-sm">
                Sıralama (kiçik rəqəm ön sırada görünür)
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value || 0) })}
                />
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-admin-line bg-admin-card p-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Aktivdir
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingId(null);
                  setError(null);
                }}
                className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700"
              >
                İmtina
              </button>
              <button
                onClick={save}
                disabled={saving || !form.label.trim()}
                className="inline-flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
