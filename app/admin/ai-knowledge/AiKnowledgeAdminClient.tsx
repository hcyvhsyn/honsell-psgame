"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { AI_KNOWLEDGE_CATEGORIES } from "@/lib/aiKnowledgeShared";
import { useDialog } from "@/lib/dialogs";

type Item = {
  id: string;
  title: string;
  content: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export default function AiKnowledgeAdminClient() {
  const dialog = useDialog();
  const [items, setItems] = useState<Item[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("GENERAL");
  const [newActive, setNewActive] = useState(true);
  const [newSort, setNewSort] = useState(0);

  const refresh = useCallback(() => {
    startTransition(async () => {
      setError(null);
      setLoading(true);
      const res = await fetch("/api/admin/ai-knowledge", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Yükləmə alınmadı.");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function createItem() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/admin/ai-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          category: newCategory,
          isActive: newActive,
          sortOrder: newSort,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Əlavə etmək alınmadı.");
        return;
      }
      setNewTitle("");
      setNewContent("");
      setNewCategory("GENERAL");
      setNewActive(true);
      setNewSort(0);
      refresh();
    });
  }

  function patchItem(
    id: string,
    patch: Partial<Pick<Item, "title" | "content" | "category" | "isActive" | "sortOrder">>
  ) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/ai-knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Yeniləmə alınmadı.");
        return;
      }
      refresh();
    });
  }

  async function deleteItem(id: string) {
    if (
      !(await dialog.confirm({
        title: "Bilik girişini sil?",
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/ai-knowledge/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Silmək alınmadı.");
        return;
      }
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="rounded-xl border border-admin-line bg-admin-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-600">Başlıq</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
              placeholder="Məs: Çatdırılma necə olur?"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-zinc-600">Kateqoriya</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
              >
                {AI_KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="text-xs text-zinc-600">Sıra</label>
              <input
                type="number"
                value={newSort}
                onChange={(e) => setNewSort(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-600">Mətn</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="mt-1 min-h-[90px] w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
              placeholder="Köməkçinin biləcəyi məlumatı yaz... (link əlavə edə bilərsən, məs. /streaming/prime)"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={newActive}
              onChange={(e) => setNewActive(e.target.checked)}
            />
            Aktiv
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={createItem}
            className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Əlavə et
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={refresh}
            className="rounded-md border border-admin-line px-3 py-2 text-sm text-zinc-800 hover:bg-admin-chip disabled:opacity-50"
          >
            Yenilə
          </button>
          {error && <span className="text-sm text-rose-700">{error}</span>}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-sm text-zinc-500">Yüklənir...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card p-10 text-center text-zinc-500">
          Hələ bilik girişi yoxdur.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-admin-line bg-admin-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    value={it.sortOrder}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === it.id ? { ...x, sortOrder: Number(e.target.value) } : x))
                      )
                    }
                    onBlur={(e) => patchItem(it.id, { sortOrder: Number(e.target.value) })}
                    className="w-20 rounded-md border border-admin-line bg-admin-card px-2 py-1.5 text-sm"
                    title="Sıra"
                  />
                  <select
                    value={it.category}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, category: v } : x)));
                      patchItem(it.id, { category: v });
                    }}
                    className="rounded-md border border-admin-line bg-admin-card px-2 py-1.5 text-sm"
                  >
                    {AI_KNOWLEDGE_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={it.isActive}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, isActive: v } : x)));
                        patchItem(it.id, { isActive: v });
                      }}
                    />
                    Aktiv
                  </label>
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => deleteItem(it.id)}
                  className="rounded-md bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50"
                >
                  Sil
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs text-zinc-600">Başlıq</label>
                  <input
                    value={it.title}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === it.id ? { ...x, title: e.target.value } : x))
                      )
                    }
                    onBlur={() => patchItem(it.id, { title: it.title })}
                    className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-600">Mətn</label>
                  <textarea
                    value={it.content}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x) => (x.id === it.id ? { ...x, content: e.target.value } : x))
                      )
                    }
                    onBlur={() => patchItem(it.id, { content: it.content })}
                    className="mt-1 min-h-[90px] w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
