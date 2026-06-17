"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Trash2, GripVertical, Eye, EyeOff, X } from "lucide-react";
import {
  STREAMING_SERVICE_LABELS,
  STREAMING_SERVICES,
  type StreamingService,
} from "@/lib/streamingCart";
import { useDialog } from "@/lib/dialogs";

type ScopeKey = "OVERVIEW" | StreamingService;

const SCOPES: { key: ScopeKey; label: string; description: string }[] = [
  { key: "OVERVIEW", label: "Overview (Streaming ana səhifə)", description: "Bütün platformalardan qarışıq seçim — /streaming üst banner-i" },
  ...STREAMING_SERVICES.map((s) => ({
    key: s as ScopeKey,
    label: STREAMING_SERVICE_LABELS[s] ?? s,
    description: `/streaming/${s.toLowerCase().replace("_", "-")} səhifəsində göstərilir`,
  })),
];

type StreamingTitle = {
  id: string;
  title: string;
  service: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  kind: "MOVIE" | "SERIES";
  year: number | null;
  isActive: boolean;
  azAvailable: boolean;
};

type FeaturedItem = {
  id: string;
  scope: string;
  titleId: string;
  isActive: boolean;
  sortOrder: number;
  title: StreamingTitle;
};

export default function StreamingFeaturedAdminClient() {
  const dialog = useDialog();
  const [activeScope, setActiveScope] = useState<ScopeKey>("OVERVIEW");
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOptions, setPickerOptions] = useState<StreamingTitle[]>([]);
  const [searching, setSearching] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/streaming/featured?scope=${activeScope}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [activeScope]);

  useEffect(() => { load(); }, [load]);

  // Picker üçün title axtarışı (overview üçün hamısı, scope spesifikdirsə yalnız o servisdən).
  useEffect(() => {
    if (!picking) return;
    const q = pickerQuery.trim();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        if (activeScope !== "OVERVIEW") params.set("service", activeScope);
        if (q.length >= 2) params.set("q", q);
        const res = await fetch(`/api/admin/streaming/titles?${params}`);
        if (res.ok) {
          const all: StreamingTitle[] = await res.json();
          const existingIds = new Set(items.map((it) => it.titleId));
          // Yalnız aktiv title-lar və scope-da artıq olmayanlar.
          setPickerOptions(all.filter((t) => t.isActive && !existingIds.has(t.id)));
        }
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [picking, pickerQuery, activeScope, items]);

  async function addTitle(titleId: string) {
    const res = await fetch("/api/admin/streaming/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ADD",
        scope: activeScope,
        titleId,
        sortOrder: items.length,
      }),
    });
    if (res.ok) {
      setPicking(false);
      setPickerQuery("");
      setPickerOptions([]);
      load();
    }
  }

  async function toggleActive(it: FeaturedItem) {
    const next = !it.isActive;
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, isActive: next } : x)));
    const res = await fetch("/api/admin/streaming/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_ACTIVE", id: it.id, isActive: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, isActive: it.isActive } : x)));
    }
  }

  async function removeItem(id: string) {
    if (
      !(await dialog.confirm({
        title: "Banner siyahısından sil?",
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    await fetch("/api/admin/streaming/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id }),
    });
    load();
  }

  function onDragStart(id: string) { setDragId(id); }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  }
  async function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = items.findIndex((b) => b.id === dragId);
    const toIdx = items.findIndex((b) => b.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...items];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setItems(next);
    setDragId(null);
    setDragOverId(null);
    await fetch("/api/admin/streaming/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REORDER", ids: next.map((x) => x.id) }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Scope tabs */}
      <div className="flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveScope(s.key)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              activeScope === s.key
                ? "bg-violet-600 text-white"
                : "bg-admin-card text-zinc-700 hover:bg-admin-chip2"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        {SCOPES.find((s) => s.key === activeScope)?.description}
      </p>

      <div className="flex justify-end">
        <button
          onClick={() => { setPicking(true); setPickerQuery(""); setPickerOptions([]); }}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" /> Title əlavə et
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card py-16 text-center text-zinc-500">
          Bu scope üçün hələ banner elementi yoxdur. &ldquo;Title əlavə et&rdquo; düyməsini klikləyin.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              draggable
              onDragStart={() => onDragStart(it.id)}
              onDragOver={(e) => onDragOver(e, it.id)}
              onDrop={() => onDrop(it.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={`flex items-center gap-3 rounded-xl border bg-admin-card p-3 transition ${
                dragId === it.id ? "opacity-40" : ""
              } ${dragOverId === it.id && dragId !== it.id ? "border-violet-500" : "border-admin-line"}`}
            >
              <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-zinc-500 active:cursor-grabbing" />
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-admin-card">
                {(it.title.backdropUrl || it.title.posterUrl) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={it.title.backdropUrl ?? it.title.posterUrl ?? ""} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900">{it.title.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {STREAMING_SERVICE_LABELS[it.title.service] ?? it.title.service} · {it.title.kind === "SERIES" ? "Serial" : "Film"}
                  {it.title.year ? ` · ${it.title.year}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${it.isActive ? "bg-emerald-500/20 text-emerald-600" : "bg-admin-chip text-zinc-500"}`}>
                    {it.isActive ? "Aktiv" : "Passiv"}
                  </span>
                  {!it.title.azAvailable && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-700">
                      AZ-da yox
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleActive(it)}
                  title={it.isActive ? "Passiv et" : "Aktiv et"}
                  className={`rounded p-2 ${it.isActive ? "text-emerald-600 hover:text-emerald-700" : "text-zinc-500 hover:text-zinc-700"}`}
                >
                  {it.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => removeItem(it.id)}
                  className="rounded p-2 text-zinc-500 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Picker modal */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-admin-line bg-admin-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Title seç</h3>
              <button onClick={() => setPicking(false)} className="text-zinc-500 hover:text-zinc-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Başlıq yaz..."
              className="w-full rounded border border-admin-line bg-admin-card px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none"
              autoFocus
            />
            <div className="mt-3 max-h-96 overflow-y-auto rounded border border-admin-line bg-admin-card">
              {searching && <div className="px-3 py-2 text-xs text-zinc-500">Axtarılır...</div>}
              {!searching && pickerOptions.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-zinc-500">
                  {activeScope === "OVERVIEW"
                    ? "Heç bir aktiv title tapılmadı."
                    : `${STREAMING_SERVICE_LABELS[activeScope] ?? activeScope} üçün title yoxdur.`}
                </div>
              )}
              {pickerOptions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => addTitle(t.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-admin-chip2"
                >
                  <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-admin-card">
                    {t.posterUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={t.posterUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {STREAMING_SERVICE_LABELS[t.service] ?? t.service} · {t.kind === "SERIES" ? "Serial" : "Film"}
                      {t.year ? ` · ${t.year}` : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
