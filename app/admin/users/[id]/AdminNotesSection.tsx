"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Trash2, Plus } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { useDialog } from "@/lib/dialogs";

type Note = {
  id: string;
  body: string;
  createdAt: Date | string;
  author: { email: string; name: string | null } | null;
};

export default function AdminNotesSection({
  userId,
  notes,
}: {
  userId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useDialog();

  function add() {
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Qeyd boş ola bilməz");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əlavə edilmədi");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  async function remove(noteId: string) {
    if (
      !(await dialog.confirm({
        title: "Qeydi sil?",
        message: "Bu qeydi silməyi təsdiqlə?",
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/notes/${noteId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <StickyNote className="h-4 w-4 text-amber-300" />
          Daxili qeydlər ({notes.length})
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Yalnız adminlər görür
        </span>
      </header>

      <div className="p-5">
        <div className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError(null);
            }}
            rows={3}
            maxLength={5000}
            placeholder="Müştəri haqqında daxili qeyd (telefon zəngi, şikayət, balans dəyişikliyinin səbəbi...)"
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">{body.length} / 5000</span>
            <button
              type="button"
              onClick={add}
              disabled={pending || !body.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/30 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {pending ? "Əlavə edilir..." : "Qeyd əlavə et"}
            </button>
          </div>
          {error && <div className="text-xs text-rose-300">{error}</div>}
        </div>

        {notes.length > 0 && (
          <ul className="mt-5 space-y-3 border-t border-zinc-800 pt-5">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="whitespace-pre-line text-sm text-zinc-100">
                      {n.body}
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-500">
                      {n.author
                        ? `${n.author.name ?? n.author.email}`
                        : "silinmiş admin"}{" "}
                      · {fmtDate(n.createdAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    disabled={pending}
                    title="Sil"
                    className="rounded-md p-1.5 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
