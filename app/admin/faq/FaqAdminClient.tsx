"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { FAQ_SCOPES } from "@/lib/contentScopes";
import { useDialog } from "@/lib/dialogs";

type Faq = {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
  scope: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export default function FaqAdminClient() {
  const dialog = useDialog();
  const [activeScope, setActiveScope] = useState<string>("HOME");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [newSort, setNewSort] = useState(0);

  const refresh = useCallback(() => {
    startTransition(async () => {
      setError(null);
      setLoading(true);
      const res = await fetch(`/api/admin/faq?scope=${activeScope}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Yükləmə alınmadı.");
        return;
      }
      setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
    });
  }, [activeScope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
          scope: activeScope,
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

  function patchFaq(
    id: string,
    patch: Partial<Pick<Faq, "question" | "answer" | "isActive" | "sortOrder" | "scope">>,
  ) {
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

  async function deleteFaq(id: string) {
    if (
      !(await dialog.confirm({
        title: "FAQ-i sil?",
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
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
      {/* Scope tabs */}
      <div className="flex flex-wrap gap-2">
        {FAQ_SCOPES.map((s) => (
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
      <p className="text-xs text-zinc-500">
        {FAQ_SCOPES.find((s) => s.key === activeScope)?.description} səhifəsində göstəriləcək FAQ-lar.
      </p>

      {/* Create */}
      <div className="rounded-xl border border-admin-line bg-admin-card p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-600">Sual</label>
            <input
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
              placeholder="Məs: Ödəniş necə aparılır?"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-600">Sıra (sortOrder)</label>
            <input
              type="number"
              value={newSort}
              onChange={(e) => setNewSort(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-600">Cavab</label>
            <textarea
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              className="mt-1 min-h-[90px] w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
              placeholder="Cavabı yaz..."
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
            onClick={createFaq}
            className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Əlavə et ({FAQ_SCOPES.find((s) => s.key === activeScope)?.label})
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
      ) : faqs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card p-10 text-center text-zinc-500">
          Bu scope üçün hələ FAQ yoxdur.
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((f) => (
            <div key={f.id} className="rounded-xl border border-admin-line bg-admin-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    value={f.sortOrder}
                    onChange={(e) =>
                      setFaqs((prev) =>
                        prev.map((x) => (x.id === f.id ? { ...x, sortOrder: Number(e.target.value) } : x)),
                      )
                    }
                    onBlur={(e) => patchFaq(f.id, { sortOrder: Number(e.target.value) })}
                    className="w-24 rounded-md border border-admin-line bg-admin-card px-2 py-1.5 text-sm"
                    title="sortOrder"
                  />
                  <select
                    value={f.scope}
                    onChange={(e) => {
                      const newScope = e.target.value;
                      setFaqs((prev) => prev.map((x) => (x.id === f.id ? { ...x, scope: newScope } : x)));
                      patchFaq(f.id, { scope: newScope });
                    }}
                    className="rounded-md border border-admin-line bg-admin-card px-2 py-1.5 text-sm"
                  >
                    {FAQ_SCOPES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
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
                  className="rounded-md bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50"
                >
                  Sil
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-zinc-600">Sual</label>
                  <input
                    value={f.question}
                    onChange={(e) =>
                      setFaqs((prev) =>
                        prev.map((x) => (x.id === f.id ? { ...x, question: e.target.value } : x)),
                      )
                    }
                    onBlur={() => patchFaq(f.id, { question: f.question })}
                    className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-600">Cavab</label>
                  <textarea
                    value={f.answer}
                    onChange={(e) =>
                      setFaqs((prev) =>
                        prev.map((x) => (x.id === f.id ? { ...x, answer: e.target.value } : x)),
                      )
                    }
                    onBlur={() => patchFaq(f.id, { answer: f.answer })}
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
