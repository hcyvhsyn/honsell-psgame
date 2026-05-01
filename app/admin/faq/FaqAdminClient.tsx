"use client";

import { useMemo, useState, useTransition } from "react";

type Faq = {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export default function FaqAdminClient({ initialFaqs }: { initialFaqs: Faq[] }) {
  const [faqs, setFaqs] = useState<Faq[]>(initialFaqs);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [newSort, setNewSort] = useState(0);

  const sorted = useMemo(() => {
    return [...faqs].sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.createdAt).localeCompare(String(b.createdAt)));
  }, [faqs]);

  function refresh() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/admin/faq", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Yükləmə alınmadı.");
        return;
      }
      setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
    });
  }

  function createFaq() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: newQ,
          answer: newA,
          isActive: newActive,
          sortOrder: newSort,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Əlavə etmək alınmadı.");
        return;
      }
      setNewQ("");
      setNewA("");
      setNewActive(true);
      setNewSort(0);
      refresh();
    });
  }

  function patchFaq(id: string, patch: Partial<Pick<Faq, "question" | "answer" | "isActive" | "sortOrder">>) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/faq/${id}`, {
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

  function deleteFaq(id: string) {
    if (!confirm("Bu FAQ silinsin?")) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/faq/${id}`, { method: "DELETE" });
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-400">Sual</label>
            <input
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Məs: Ödəniş necə aparılır?"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Sıra (sortOrder)</label>
            <input
              type="number"
              value={newSort}
              onChange={(e) => setNewSort(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-400">Cavab</label>
            <textarea
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              className="mt-1 min-h-[90px] w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Cavabı yaz..."
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
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
            onClick={createFaq}
            className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Əlavə et
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={refresh}
            className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
          >
            Yenilə
          </button>
          {error && <span className="text-sm text-rose-300">{error}</span>}
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((f) => (
          <div key={f.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={f.sortOrder}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((x) => (x.id === f.id ? { ...x, sortOrder: Number(e.target.value) } : x))
                    )
                  }
                  onBlur={(e) => patchFaq(f.id, { sortOrder: Number(e.target.value) })}
                  className="w-24 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
                  title="sortOrder"
                />
                <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={f.isActive}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setFaqs((prev) => prev.map((x) => (x.id === f.id ? { ...x, isActive: v } : x)));
                      patchFaq(f.id, { isActive: v });
                    }}
                  />
                  Aktiv
                </label>
              </div>

              <button
                type="button"
                disabled={pending}
                onClick={() => deleteFaq(f.id)}
                className="rounded-md bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50"
              >
                Sil
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-400">Sual</label>
                <input
                  value={f.question}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((x) => (x.id === f.id ? { ...x, question: e.target.value } : x))
                    )
                  }
                  onBlur={() => patchFaq(f.id, { question: f.question })}
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Cavab</label>
                <textarea
                  value={f.answer}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((x) => (x.id === f.id ? { ...x, answer: e.target.value } : x))
                    )
                  }
                  onBlur={() => patchFaq(f.id, { answer: f.answer })}
                  className="mt-1 min-h-[90px] w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

