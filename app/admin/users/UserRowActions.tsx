"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check, Pencil, Trash2, AlertTriangle, X } from "lucide-react";

export function CopyPhoneButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Kopyalandı" : "Kopyala"}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function UserRowActions({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function openDialog(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setOpen(true);
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Silmə alınmadı");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/admin/users/${userId}`}
          title="Redaktə et"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 ring-1 ring-zinc-800 transition hover:bg-indigo-500/10 hover:text-indigo-300 hover:ring-indigo-500/30"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={openDialog}
          disabled={pending}
          title="Sil"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 ring-1 ring-zinc-800 transition hover:bg-rose-500/10 hover:text-rose-300 hover:ring-rose-500/30 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => !pending && setOpen(false)}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
              aria-label="Bağla"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/30">
                <AlertTriangle className="h-5 w-5 text-rose-300" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-zinc-100">
                  Müştərini silmək?
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  <span className="font-mono text-zinc-200">{email}</span>{" "}
                  istifadəçisi və onun bütün əməliyyat tarixçəsi (transactions)
                  silinəcək. Bu əməliyyat geri qaytarıla bilməz.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 transition hover:bg-zinc-900 disabled:opacity-50"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 ring-1 ring-rose-500/40 transition hover:bg-rose-500/25 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {pending ? "Silinir…" : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
