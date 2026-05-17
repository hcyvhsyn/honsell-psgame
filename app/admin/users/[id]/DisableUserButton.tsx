"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck, X } from "lucide-react";

type Props = {
  userId: string;
  disabled: boolean;
  isAdminTarget: boolean;
};

export default function DisableUserButton({ userId, disabled, isAdminTarget }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(action: "disable" | "enable") {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disable: action === "disable",
          reason: action === "disable" ? reason.trim() || null : null,
        }),
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

  if (disabled) {
    return (
      <button
        type="button"
        onClick={() => submit("enable")}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20 disabled:opacity-50"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {pending ? "Aktivləşdirilir..." : "Hesabı aktivləşdir"}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isAdminTarget}
        title={isAdminTarget ? "Admin hesabını bloklamaq olmaz" : "Hesabı blokla"}
        className="inline-flex items-center gap-2 rounded-md bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/30 transition hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Ban className="h-3.5 w-3.5" />
        Hesabı blokla
      </button>

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
            className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-zinc-950 p-6 shadow-2xl"
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
                <Ban className="h-5 w-5 text-rose-300" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-zinc-100">Hesabı blokla</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Bloklanan istifadəçi sayta daxil ola, alış edə və ya depozit qoya bilməz.
                  İstənilən vaxt geri aktivləşdirə bilərsiniz.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm">
              <span className="text-zinc-300">Bloklama səbəbi (ixtiyari)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                autoFocus
                placeholder="Məs. Şübhəli aktivlik, chargeback, fırıldaqçılıq..."
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
              />
              <div className="mt-1 text-right text-[10px] text-zinc-500">
                {reason.length} / 500
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
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={() => submit("disable")}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-400 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                {pending ? "Bloklanır..." : "Blokla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
