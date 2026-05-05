"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Edit2, Trash2, X, GripVertical, Star, ChevronDown, ChevronUp, Search } from "lucide-react";

type GameRef = { id: string; productId: string; title: string; imageUrl: string | null; platform: string | null };
type CollectionGameRow = { gameId: string; position: number; game: GameRef };
type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  games: CollectionGameRow[];
};

type EditForm = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: string;
};

const EMPTY_FORM: EditForm = { slug: "", title: "", description: "", imageUrl: "", isActive: true, isFeatured: false, sortOrder: "0" };

type GameOption = { id: string; title: string; imageUrl: string | null };

export default function CollectionsAdminClient() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gameQuery, setGameQuery] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [searchingGames, setSearchingGames] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [gameDragId, setGameDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/collections");
    if (res.ok) setCollections(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setSaveError(null);
    setEditingId("NEW");
    setEditForm({ ...EMPTY_FORM, sortOrder: String(collections.length) });
  }

  function openEdit(c: Collection) {
    setSaveError(null);
    setEditingId(c.id);
    setEditForm({
      slug: c.slug,
      title: c.title,
      description: c.description ?? "",
      imageUrl: c.imageUrl ?? "",
      isActive: c.isActive,
      isFeatured: c.isFeatured,
      sortOrder: String(c.sortOrder),
    });
  }

  async function saveCollection() {
    if (!editForm.title.trim()) { setSaveError("Başlıq tələb olunur!"); return; }
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT",
        id: editingId === "NEW" ? undefined : editingId,
        slug: editForm.slug,
        title: editForm.title,
        description: editForm.description,
        imageUrl: editForm.imageUrl,
        isActive: editForm.isActive,
        isFeatured: editForm.isFeatured,
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

  async function deleteCollection(id: string) {
    if (!confirm("Bu kolleksiyanı silmək istəyirsiniz? İçindəki oyun bağlantıları da silinəcək.")) return;
    await fetch("/api/admin/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  async function persistOrder(ordered: Collection[]) {
    await fetch("/api/admin/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REORDER", ids: ordered.map((c) => c.id) }),
    });
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    setCollections((prev) => {
      const fromIdx = prev.findIndex((c) => c.id === dragId);
      const toIdx = prev.findIndex((c) => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const reindexed = next.map((c, i) => ({ ...c, sortOrder: i }));
      persistOrder(reindexed);
      return reindexed;
    });
    setDragId(null);
  }

  // Game search for the expanded panel
  useEffect(() => {
    if (!expandedId) return;
    const q = gameQuery.trim();
    if (q.length < 2) { setGameOptions([]); return; }
    const t = setTimeout(async () => {
      setSearchingGames(true);
      try {
        const res = await fetch(`/api/games?q=${encodeURIComponent(q)}&type=GAME&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setGameOptions(
            (data.results ?? []).map((g: { id: string; title: string; imageUrl: string | null }) => ({
              id: g.id,
              title: g.title,
              imageUrl: g.imageUrl,
            }))
          );
        }
      } finally {
        setSearchingGames(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [gameQuery, expandedId]);

  async function addGameToCollection(collectionId: string, gameId: string) {
    await fetch("/api/admin/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADD_GAME", collectionId, gameId }),
    });
    setGameQuery("");
    setGameOptions([]);
    load();
  }

  async function removeGameFromCollection(collectionId: string, gameId: string) {
    await fetch("/api/admin/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REMOVE_GAME", collectionId, gameId }),
    });
    load();
  }

  async function persistGameOrder(collectionId: string, gameIds: string[]) {
    await fetch("/api/admin/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REORDER_GAMES", collectionId, gameIds }),
    });
  }

  function onGameDrop(collectionId: string, targetGameId: string) {
    if (!gameDragId || gameDragId === targetGameId) {
      setGameDragId(null);
      return;
    }
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== collectionId) return c;
        const fromIdx = c.games.findIndex((g) => g.gameId === gameDragId);
        const toIdx = c.games.findIndex((g) => g.gameId === targetGameId);
        if (fromIdx === -1 || toIdx === -1) return c;
        const next = [...c.games];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        const reindexed = next.map((g, i) => ({ ...g, position: i }));
        persistGameOrder(collectionId, reindexed.map((g) => g.gameId));
        return { ...c, games: reindexed };
      })
    );
    setGameDragId(null);
  }

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
          <Plus className="h-4 w-4" /> Yeni Kolleksiya
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center text-zinc-500">
          Hələ heç bir kolleksiya yoxdur.
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border bg-zinc-900/50 transition ${
                dragId === c.id ? "opacity-40" : ""
              } border-zinc-800`}
            >
              <div
                draggable
                onDragStart={() => setDragId(c.id)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(c.id)}
                onDragEnd={() => setDragId(null)}
                className="flex items-center gap-4 p-4"
              >
                <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-zinc-500 active:cursor-grabbing" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium text-zinc-200">
                    {c.title}
                    {c.isFeatured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                  </p>
                  <p className="truncate text-xs text-zinc-500">/{c.slug} · {c.games.length} oyun</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                      {c.isActive ? "Aktiv" : "Passiv"}
                    </span>
                    <span className="text-[11px] text-zinc-600">Sıra: {c.sortOrder}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="rounded p-2 text-zinc-500 hover:text-indigo-400"
                    aria-label="Oyunları idarə et"
                  >
                    {expandedId === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button onClick={() => openEdit(c)} className="rounded p-2 text-zinc-500 hover:text-indigo-400"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => deleteCollection(c.id)} className="rounded p-2 text-zinc-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {expandedId === c.id && (
                <div className="border-t border-zinc-800 p-4">
                  <div className="mb-4">
                    <label className="block text-sm text-zinc-300">
                      <Search className="mr-1.5 inline h-4 w-4" />
                      Oyun əlavə et
                      <input
                        value={gameQuery}
                        onChange={(e) => setGameQuery(e.target.value)}
                        placeholder="Oyun adı yaz (min 2 hərf)..."
                        className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </label>
                    {(searchingGames || gameOptions.length > 0) && (
                      <div className="mt-2 max-h-48 overflow-y-auto rounded border border-zinc-800 bg-zinc-900">
                        {searchingGames && <div className="px-3 py-2 text-xs text-zinc-500">Axtarılır...</div>}
                        {gameOptions
                          .filter((g) => !c.games.some((cg) => cg.gameId === g.id))
                          .map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => addGameToCollection(c.id, g.id)}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                            >
                              {g.imageUrl && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={g.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                              )}
                              <span className="truncate">{g.title}</span>
                              <Plus className="ml-auto h-4 w-4 shrink-0 text-emerald-400" />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {c.games.length === 0 ? (
                    <p className="text-center text-sm text-zinc-500 py-4">Bu kolleksiyada hələ oyun yoxdur. Yuxarıdan axtarıb əlavə edin.</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="mb-2 text-xs text-zinc-500">{c.games.length} oyun · soldakı tutacaqdan sürükləyərək sıralayın</p>
                      {c.games.map((cg) => (
                        <div
                          key={cg.gameId}
                          draggable
                          onDragStart={() => setGameDragId(cg.gameId)}
                          onDragOver={onDragOver}
                          onDrop={() => onGameDrop(c.id, cg.gameId)}
                          onDragEnd={() => setGameDragId(null)}
                          className={`flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 p-2 ${gameDragId === cg.gameId ? "opacity-40" : ""}`}
                        >
                          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-600 active:cursor-grabbing" />
                          {cg.game.imageUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={cg.game.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-zinc-200">{cg.game.title}</p>
                            <p className="truncate text-xs text-zinc-600">{cg.game.platform ?? "—"}</p>
                          </div>
                          <button
                            onClick={() => removeGameFromCollection(c.id, cg.gameId)}
                            className="rounded p-1.5 text-zinc-500 hover:text-rose-400"
                            aria-label="Çıxar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">{editingId === "NEW" ? "Yeni Kolleksiya" : "Kolleksiyanı Redaktə et"}</h3>

            <div className="space-y-4">
              <label className="block text-sm text-zinc-300">
                Başlıq <span className="text-rose-400">*</span>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Məs: Ən yaxşı RPG oyunları"
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Slug (URL) — boş buraxsanız başlıqdan avtomatik yaranır
                <input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="en-yaxsi-rpg-oyunlari"
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Açıqlama (ixtiyari)
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="Bu kolleksiya haqqında qısa məlumat..."
                />
              </label>

              <label className="block text-sm text-zinc-300">
                Cover Image URL (ixtiyari)
                <input
                  value={editForm.imageUrl}
                  onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="https://..."
                />
              </label>

              <div className="flex gap-4">
                <label className="block flex-1 text-sm text-zinc-300">
                  Sıralama
                  <input
                    type="number"
                    value={editForm.sortOrder}
                    onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                    className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Aktiv
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={editForm.isFeatured} onChange={(e) => setEditForm({ ...editForm, isFeatured: e.target.checked })} /> Featured
                </label>
              </div>
            </div>

            {saveError && <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{saveError}</div>}

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => { setEditingId(null); setSaveError(null); }} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700">İmtina</button>
              <button onClick={saveCollection} disabled={saving} className="inline-flex items-center gap-2 rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
