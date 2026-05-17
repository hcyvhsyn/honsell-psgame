"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type Props = {
  transactionId: string;
  kind: "game" | "service";
  title: string;
};

export default function CancelPurchaseButton({ transactionId, kind, title }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const closeModal = useCallback(() => {
    if (pending) return;
    setOpen(false);
    setReason("");
    setError(null);
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, closeModal]);

  function openModal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setReason("");
    setError(null);
    setOpen(true);
  }

  function submit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Səbəbi yazın.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const url =
        kind === "game"
          ? `/api/admin/game-orders/${transactionId}`
          : `/api/admin/service-orders/${transactionId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FAILED", reason: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Sifarişi ləğv et və balansa qaytar"
        className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-500/30 transition hover:bg-rose-500/20"
      >
        <X className="h-3 w-3" />
        Ləğv et
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-zinc-950 p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
              aria-label="Bağla"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/30">
                <X className="h-5 w-5 text-rose-300" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-zinc-100">Sifarişi ləğv et</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  <span className="text-zinc-200">{title}</span> sifarişi ləğv ediləcək.
                  Ödəniş məbləği müştərinin cüzdanına (və ya referal balansına, ödəniş
                  oradan gəlibsə) geri qaytarılacaq. Əgər sifariş artıq təsdiqlənibsə,
                  referal komissiyaları da geri alınacaq.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm">
              <span className="text-zinc-300">Ləğv etmə səbəbi</span>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                rows={4}
                maxLength={1000}
                placeholder="Məs. Müştəri ilə əlaqə qurula bilmədi, məhsul stokda yoxdur, yanlış sifariş..."
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
              />
              <div className="mt-1 text-right text-[10px] text-zinc-500">
                {reason.length} / 1000
              </div>
            </label>

            {error && (
              <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={pending}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !reason.trim()}
                className="inline-flex items-center gap-2 rounded bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-400 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                {pending ? "Ləğv edilir..." : "Ləğv et və geri qaytar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
