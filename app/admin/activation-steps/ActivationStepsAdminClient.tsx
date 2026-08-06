"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ACTIVATION_STEP_SCOPES } from "@/lib/contentScopes";
import { uploadAdminImage } from "@/lib/uploadImageClient";
import { useDialog } from "@/lib/dialogs";

type Step = {
  id: string;
  scope: string;
  method: string | null;
  title: string;
  body: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

type EditForm = {
  scope: string;
  method: string;
  title: string;
  body: string;
  imageUrl: string;
  isActive: boolean;
};

const DEFAULT_SCOPE = ACTIVATION_STEP_SCOPES[0].key;

function emptyForm(scope: string): EditForm {
  return { scope, method: "", title: "", body: "", imageUrl: "", isActive: true };
}

export default function ActivationStepsAdminClient() {
  const dialog = useDialog();
  const [activeScope, setActiveScope] = useState<string>(DEFAULT_SCOPE);
  const [items, setItems] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm(DEFAULT_SCOPE));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/activation-steps?scope=${activeScope}`);
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
    setEditForm(emptyForm(activeScope));
  }

  function openEdit(s: Step) {
    setSaveError(null);
    setEditingId(s.id);
    setEditForm({
      scope: s.scope,
      method: s.method ?? "",
      title: s.title,
      body: s.body ?? "",
      imageUrl: s.imageUrl ?? "",
      isActive: s.isActive,
    });
  }

  async function pickImage(file: File | null | undefined) {
    if (!file) return;
    setUploading(true);
    setSaveError(null);
    const res = await uploadAdminImage("/api/admin/activation-steps/image-upload", file);
    setUploading(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setEditForm((f) => ({ ...f, imageUrl: res.url }));
  }

  async function save() {
    if (!editForm.title.trim()) {
      setSaveError("Başlıq tələb olunur");
      return;
    }
    setSaving(true);
    setSaveError(null);
    // Yeni addım həmişə siyahının SONUNA düşür — mövcud nömrələr sürüşməsin.
    const sortOrder =
      editingId === "NEW"
        ? items.length
        : (items.find((x) => x.id === editingId)?.sortOrder ?? 0);
    const res = await fetch("/api/admin/activation-steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT",
        id: editingId === "NEW" ? undefined : editingId,
        scope: editForm.scope,
        method: editForm.method || null,
        title: editForm.title,
        body: editForm.body || null,
        imageUrl: editForm.imageUrl || null,
        isActive: editForm.isActive,
        sortOrder,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Yadda saxlanmadı");
      return;
    }
    setEditingId(null);
    load();
  }

  async function toggleActive(s: Step) {
    const next = !s.isActive;
    setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, isActive: next } : x)));
    const res = await fetch("/api/admin/activation-steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ACTIVE", id: s.id, isActive: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, isActive: s.isActive } : x)));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    const res = await fetch("/api/admin/activation-steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REORDER", ids: next.map((x) => x.id) }),
    });
    if (!res.ok) load();
  }

  async function deleteItem(id: string) {
    if (
      !(await dialog.confirm({ title: "Addımı sil?", confirmLabel: "Sil", tone: "danger" }))
    )
      return;
    await fetch("/api/admin/activation-steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  const scopeMeta = ACTIVATION_STEP_SCOPES.find((s) => s.key === activeScope);
  // Datalist təklifləri — admin yeni addımda üsul adını əldən yazıb səhv
  // yazmasın (məs. "Brauzer" vs "brauzer" iki ayrı tab yaradar).
  const knownMethods = Array.from(
    new Set(items.map((s) => (s.method ?? "").trim()).filter(Boolean)),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {ACTIVATION_STEP_SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveScope(s.key)}
            title={s.description}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              activeScope === s.key
                ? "bg-violet-600 text-white"
                : "bg-admin-card text-zinc-700 hover:bg-admin-chip2"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">{scopeMeta?.description}</p>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" /> Yeni Addım
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card py-16 text-center text-sm text-zinc-500">
          Bu səhifə üçün hələ addım yoxdur — addım əlavə edilməyənə qədər public
          səhifədə bölmə tamamilə göstərilmir.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s, i) => (
            <article
              key={s.id}
              className={`rounded-xl border border-admin-line bg-admin-card p-4 ${
                s.isActive ? "" : "opacity-60"
              }`}
            >
              <div className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-600 text-sm font-bold text-white">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  {s.method && (
                    <span className="mb-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-700">
                      {s.method}
                    </span>
                  )}
                  <p className="text-base font-bold text-zinc-900">{s.title}</p>
                  {s.body && (
                    <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{s.body}</p>
                  )}
                  {s.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={s.imageUrl}
                      alt={s.title}
                      className="mt-2 h-28 w-auto rounded-lg border border-admin-line object-cover"
                    />
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-center gap-1">
                  <div className="flex">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      title="Yuxarı"
                      className="rounded p-1.5 text-zinc-500 hover:bg-admin-chip2 disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      title="Aşağı"
                      className="rounded p-1.5 text-zinc-500 hover:bg-admin-chip2 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex">
                    <button
                      onClick={() => toggleActive(s)}
                      title={s.isActive ? "Passiv et" : "Aktiv et"}
                      className={`rounded p-1.5 ${
                        s.isActive ? "text-emerald-600" : "text-zinc-500"
                      } hover:bg-admin-chip2`}
                    >
                      {s.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      title="Redaktə et"
                      className="rounded p-1.5 text-zinc-500 hover:text-violet-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteItem(s.id)}
                      title="Sil"
                      className="rounded p-1.5 text-zinc-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editingId === "NEW" ? "Yeni Addım" : "Addımı redaktə et"}
              </h3>
              <button
                onClick={() => setEditingId(null)}
                className="text-zinc-500 hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4">
              <label className="block text-sm text-zinc-700">
                Səhifə
                <select
                  value={editForm.scope}
                  onChange={(e) => setEditForm({ ...editForm, scope: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                >
                  {ACTIVATION_STEP_SCOPES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-zinc-700">
                Üsul (tab adı)
                <input
                  value={editForm.method}
                  onChange={(e) => setEditForm({ ...editForm, method: e.target.value })}
                  list="activation-methods"
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="PS konsolu"
                />
                <datalist id="activation-methods">
                  {knownMethods.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Eyni üsul adı olan addımlar public-də BİR tab-da toplanır və
                  nömrələmə hər tab-ın içində 1-dən başlayır. Aktivləşdirmə
                  ardıcıl axın deyil, alternativ yollardır — konsol / mobil
                  tətbiq / brauzer kimi. Boş buraxsan bütün addımlar tab-sız
                  vahid siyahı kimi göstərilir.
                </p>
              </label>

              <label className="block text-sm text-zinc-700">
                Başlıq <span className="text-rose-600">*</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="PS konsolu üzərindən"
                />
              </label>

              <label className="block text-sm text-zinc-700">
                İzah (opsional)
                <textarea
                  value={editForm.body}
                  onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder={'Ana menyudan PSN hesabına daxil ol.\n"Kodu istifadə et" seçimini seç.'}
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Sətir sonları public səhifədə olduğu kimi qalır. Markdown işləmir.
                </p>
              </label>

              <div className="text-sm text-zinc-700">
                Şəkil / ekran görüntüsü (opsional)
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      pickImage(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-lg border border-admin-line px-3 py-2 text-sm hover:bg-admin-chip2 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {editForm.imageUrl ? "Şəkli dəyiş" : "Şəkil yüklə"}
                  </button>
                  {editForm.imageUrl && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editForm.imageUrl}
                        alt="Addım şəkli"
                        className="h-20 w-auto rounded-lg border border-admin-line object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, imageUrl: "" })}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Şəkli sil
                      </button>
                    </>
                  )}
                </div>
                <input
                  value={editForm.imageUrl}
                  onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  className="mt-2 w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
                  placeholder="Yaxud hazır URL yaz: https://cdn.honsell.store/..."
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  PNG / JPEG / WEBP, maks 10MB. Şəkil brauzerdə sıxılır (webp, maks 1600px).
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Aktivdir (public səhifədə görünür)
              </label>
            </div>

            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                {saveError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-admin-line px-4 py-2 text-sm hover:bg-admin-chip2"
              >
                Ləğv et
              </button>
              <button
                onClick={save}
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
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
