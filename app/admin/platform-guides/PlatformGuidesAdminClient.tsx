"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Edit2, Trash2, Eye, EyeOff, X } from "lucide-react";
import { PLATFORM_GUIDE_SCOPES } from "@/lib/contentScopes";

type Guide = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  videoUrl: string | null;
  scope: string;
  isActive: boolean;
  sortOrder: number;
};

type EditForm = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  videoUrl: string;
  scope: string;
  isActive: boolean;
  sortOrder: string;
};

function emptyForm(scope: string): EditForm {
  return {
    title: "",
    slug: "",
    summary: "",
    body: "",
    videoUrl: "",
    scope,
    isActive: true,
    sortOrder: "0",
  };
}

export default function PlatformGuidesAdminClient() {
  const [activeScope, setActiveScope] = useState<string>("PLAYSTATION");
  const [items, setItems] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm("PLAYSTATION"));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/platform-guides?scope=${activeScope}`);
    if (res.ok) {
      const d = await res.json();
      setItems(d.items ?? []);
    }
    setLoading(false);
  }, [activeScope]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({ ...emptyForm(activeScope), sortOrder: String(items.length) });
  }

  function openEdit(g: Guide) {
    setSaveError(null);
    setEditingId(g.id);
    setEditForm({
      title: g.title,
      slug: g.slug,
      summary: g.summary ?? "",
      body: g.body,
      videoUrl: g.videoUrl ?? "",
      scope: g.scope,
      isActive: g.isActive,
      sortOrder: String(g.sortOrder),
    });
  }

  async function save() {
    if (!editForm.title.trim()) { setSaveError("Başlıq tələb olunur"); return; }
    if (!editForm.body.trim()) { setSaveError("Mətn tələb olunur"); return; }
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/platform-guides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT",
        id: editingId === "NEW" ? undefined : editingId,
        title: editForm.title,
        slug: editForm.slug || undefined,
        summary: editForm.summary || null,
        body: editForm.body,
        videoUrl: editForm.videoUrl.trim() || null,
        scope: editForm.scope,
        isActive: editForm.isActive,
        sortOrder: Number(editForm.sortOrder || 0),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Yadda saxlanmadı");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditingId(null);
    load();
  }

  async function toggleActive(g: Guide) {
    const next = !g.isActive;
    setItems((prev) => prev.map((x) => (x.id === g.id ? { ...x, isActive: next } : x)));
    const res = await fetch("/api/admin/platform-guides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ACTIVE", id: g.id, isActive: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((x) => (x.id === g.id ? { ...x, isActive: g.isActive } : x)));
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Bu bələdçini silmək istəyirsən?")) return;
    await fetch("/api/admin/platform-guides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PLATFORM_GUIDE_SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveScope(s.key)}
            title={s.description}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              activeScope === s.key
                ? "bg-indigo-500 text-white"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          <Plus className="h-4 w-4" /> Yeni Bələdçi
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center text-zinc-500">
          Bu scope üçün hələ bələdçi yoxdur.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((g) => (
            <article key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-white">{g.title}</p>
                  <p className="text-xs text-zinc-500">/{g.slug}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(g)}
                    title={g.isActive ? "Passiv et" : "Aktiv et"}
                    className={`rounded p-1.5 ${g.isActive ? "text-emerald-400" : "text-zinc-500"} hover:bg-zinc-800`}
                  >
                    {g.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(g)} className="rounded p-1.5 text-zinc-500 hover:text-indigo-400">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteItem(g.id)} className="rounded p-1.5 text-zinc-500 hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {g.summary && <p className="mt-2 text-sm text-zinc-300">{g.summary}</p>}
            </article>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingId === "NEW" ? "Yeni Bələdçi" : "Bələdçini redaktə et"}</h3>
              <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Başlıq <span className="text-rose-400">*</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="HBO Max-ı necə yükləmək olar?"
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Scope
                <select
                  value={editForm.scope}
                  onChange={(e) => setEditForm({ ...editForm, scope: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  {PLATFORM_GUIDE_SCOPES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-zinc-300">
                Slug (avtomatik yaradılır)
                <input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="hbo-max-yukleme"
                />
              </label>

              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Qısa təsvir
                <input
                  value={editForm.summary}
                  onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Bir cümləlik təsvir — kart preview-da göstəriləcək"
                />
              </label>

              <label className="block text-sm text-zinc-300 sm:col-span-2">
                Mətn <span className="text-rose-400">*</span>
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={10}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Tam mətn — paragraflar, addımlar..."
                />
              </label>

              <label className="block text-sm text-zinc-300 sm:col-span-2">
                YouTube video linki (opsional)
                <input
                  type="url"
                  value={editForm.videoUrl}
                  onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Boş buraxsan video düyməsi göstərilmir. Linkə basanda yeni tab-da açılır.
                </p>
              </label>

              <label className="block text-sm text-zinc-300">
                Sıralama
                <input
                  type="number"
                  value={editForm.sortOrder}
                  onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </label>

              <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Aktivdir
              </label>
            </div>

            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {saveError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setEditingId(null)}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
