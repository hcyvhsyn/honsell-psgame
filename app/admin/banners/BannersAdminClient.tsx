"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Plus, Edit2, Trash2, Upload, X, GripVertical } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Banner = {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  actionType: "LINK" | "ADD_TO_CART";
  gameId: string | null;
  game?: { id: string; title: string; imageUrl: string | null } | null;
  isActive: boolean;
  sortOrder: number;
};

type EditForm = {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  actionType: "LINK" | "ADD_TO_CART";
  gameId: string;
  gameLabel: string;
  isActive: boolean;
  sortOrder: string;
};

type GameOption = { id: string; title: string; imageUrl: string | null };

export default function BannersAdminClient() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: "", subtitle: "", imageUrl: "", linkUrl: "", actionType: "LINK", gameId: "", gameLabel: "", isActive: true, sortOrder: "0" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gameQuery, setGameQuery] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [searchingGames, setSearchingGames] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  async function persistOrder(ordered: Banner[]) {
    await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REORDER", ids: ordered.map((b) => b.id) }),
    });
  }

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    setBanners((prev) => {
      const fromIdx = prev.findIndex((b) => b.id === dragId);
      const toIdx = prev.findIndex((b) => b.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const reindexed = next.map((b, i) => ({ ...b, sortOrder: i }));
      persistOrder(reindexed);
      return reindexed;
    });
    setDragId(null);
    setDragOverId(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/banners");
    if (res.ok) setBanners(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({ title: "", subtitle: "", imageUrl: "", linkUrl: "", actionType: "LINK", gameId: "", gameLabel: "", isActive: true, sortOrder: String(banners.length) });
    setGameQuery("");
    setGameOptions([]);
  }

  function openEdit(b: Banner) {
    setSaveError(null);
    setEditingId(b.id);
    setEditForm({
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl ?? "",
      actionType: b.actionType ?? "LINK",
      gameId: b.gameId ?? "",
      gameLabel: b.game?.title ?? "",
      isActive: b.isActive,
      sortOrder: String(b.sortOrder),
    });
    setGameQuery("");
    setGameOptions([]);
  }

  useEffect(() => {
    if (editForm.actionType !== "ADD_TO_CART") return;
    const q = gameQuery.trim();
    if (q.length < 2) { setGameOptions([]); return; }
    const t = setTimeout(async () => {
      setSearchingGames(true);
      try {
        const res = await fetch(`/api/games?q=${encodeURIComponent(q)}&type=GAME&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setGameOptions((data.results ?? []).map((g: { id: string; title: string; imageUrl: string | null }) => ({ id: g.id, title: g.title, imageUrl: g.imageUrl })));
        }
      } finally {
        setSearchingGames(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [gameQuery, editForm.actionType]);

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) { alert("Yalnız şəkil faylı"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Fayl çox böyükdür (max 10 MB)"); return; }
    setUploadingImage(true);
    try {
      const init = await fetch("/api/admin/banners/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const initData = await init.json();
      if (!init.ok) { alert(initData.error ?? "Upload hazırlanmadı"); return; }
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage.from(initData.bucket).uploadToSignedUrl(initData.path, initData.token, file);
      if (upErr) { alert(`Upload alınmadı: ${upErr.message}`); return; }
      setEditForm((prev) => ({ ...prev, imageUrl: initData.publicUrl }));
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveBanner() {
    if (!editForm.imageUrl) { setSaveError("Şəkil yükləmək mütləqdir!"); return; }
    if (editForm.actionType === "ADD_TO_CART" && !editForm.gameId) { setSaveError("Oyun seçməlisiniz!"); return; }
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT",
        id: editingId === "NEW" ? undefined : editingId,
        title: editForm.title,
        subtitle: editForm.subtitle,
        imageUrl: editForm.imageUrl,
        linkUrl: editForm.linkUrl,
        actionType: editForm.actionType,
        gameId: editForm.gameId || null,
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

  async function deleteBanner(id: string) {
    if (!confirm("Bu banneri silmək istəyirsiniz?")) return;
    await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
          <Plus className="h-4 w-4" /> Yeni Banner
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center text-zinc-500">
          Hələ heç bir banner yoxdur. &ldquo;Yeni Banner&rdquo; düyməsini klikləyin.
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div
              key={b.id}
              draggable
              onDragStart={() => onDragStart(b.id)}
              onDragOver={(e) => onDragOver(e, b.id)}
              onDrop={() => onDrop(b.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={`flex items-center gap-4 rounded-xl border bg-zinc-900/50 p-4 transition ${
                dragId === b.id ? "opacity-40" : ""
              } ${dragOverId === b.id && dragId !== b.id ? "border-indigo-500" : "border-zinc-800"}`}
            >
              <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-zinc-500 active:cursor-grabbing" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt={b.title ?? ""} className="h-16 w-28 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-200">{b.title || <span className="text-zinc-600">Başlıq yoxdur</span>}</p>
                {b.subtitle && <p className="truncate text-sm text-zinc-500">{b.subtitle}</p>}
                {b.actionType === "ADD_TO_CART"
                  ? <p className="truncate text-xs text-emerald-400">Səbətə əlavə: {b.game?.title ?? "—"}</p>
                  : b.linkUrl && <p className="truncate text-xs text-indigo-400">{b.linkUrl}</p>}
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${b.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                    {b.isActive ? "Aktiv" : "Passiv"}
                  </span>
                  <span className="text-[11px] text-zinc-600">Sıra: {b.sortOrder}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(b)} className="rounded p-2 text-zinc-500 hover:text-indigo-400"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => deleteBanner(b.id)} className="rounded p-2 text-zinc-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">{editingId === "NEW" ? "Yeni Banner" : "Banneri Redaktə et"}</h3>

            <div className="space-y-4">
              {/* Image Upload */}
              <div>
                <p className="mb-1 text-sm text-zinc-300">Şəkil <span className="text-rose-400">*</span></p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
                />
                {editForm.imageUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editForm.imageUrl} alt="" className="h-40 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, imageUrl: "" })}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80"
                    >
                      Dəyiş
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-36 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900 text-sm text-zinc-400 hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-50"
                  >
                    {uploadingImage ? <><Loader2 className="h-4 w-4 animate-spin" /> Yüklənir...</> : <><Upload className="h-5 w-5" /> Şəkil seç (PNG/JPEG/WEBP, max 10 MB)</>}
                  </button>
                )}
              </div>

              <label className="block text-sm text-zinc-300">
                Başlıq (ixtiyari)
                <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none" placeholder="Məs: Yay Endirimi" />
              </label>
              <label className="block text-sm text-zinc-300">
                Alt başlıq (ixtiyari)
                <input value={editForm.subtitle} onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none" placeholder="Məs: Seçilmiş oyunlarda 50%-ə qədər endirim" />
              </label>
              <label className="block text-sm text-zinc-300">
                Klikləndikdə
                <select
                  value={editForm.actionType}
                  onChange={(e) => setEditForm({ ...editForm, actionType: e.target.value as "LINK" | "ADD_TO_CART" })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="LINK">Linkə yönləndir</option>
                  <option value="ADD_TO_CART">Səbətə əlavə et (oyun)</option>
                </select>
              </label>

              {editForm.actionType === "LINK" ? (
                <label className="block text-sm text-zinc-300">
                  Link (ixtiyari)
                  <input value={editForm.linkUrl} onChange={(e) => setEditForm({ ...editForm, linkUrl: e.target.value })} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none" placeholder="/hediyye-kartlari" />
                </label>
              ) : (
                <div>
                  <p className="mb-1 text-sm text-zinc-300">Oyun <span className="text-rose-400">*</span></p>
                  {editForm.gameId && editForm.gameLabel ? (
                    <div className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white">
                      <span className="truncate">{editForm.gameLabel}</span>
                      <button
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, gameId: "", gameLabel: "" }))}
                        className="ml-2 text-zinc-500 hover:text-rose-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={gameQuery}
                        onChange={(e) => setGameQuery(e.target.value)}
                        placeholder="Oyun adı yaz (min 2 hərf)..."
                        className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                      />
                      {(searchingGames || gameOptions.length > 0) && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded border border-zinc-800 bg-zinc-900">
                          {searchingGames && <div className="px-3 py-2 text-xs text-zinc-500">Axtarılır...</div>}
                          {gameOptions.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setEditForm((p) => ({ ...p, gameId: g.id, gameLabel: g.title }));
                                setGameQuery("");
                                setGameOptions([]);
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                            >
                              {g.imageUrl && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={g.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                              )}
                              <span className="truncate">{g.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="flex gap-4">
                <label className="block flex-1 text-sm text-zinc-300">
                  Sıralama
                  <input type="number" value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none" />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Aktivdir
                </label>
              </div>
            </div>

            {saveError && <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{saveError}</div>}

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => { setEditingId(null); setSaveError(null); }} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700">İmtina</button>
              <button onClick={saveBanner} disabled={saving || uploadingImage} className="inline-flex items-center gap-2 rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
