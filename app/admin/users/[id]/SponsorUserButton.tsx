"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";

type Props = {
  userId: string;
  isSponsored: boolean;
  /** Sponsorlu müştərilər üçün oyun referal faizi (məs. 8). */
  pct: number;
};

export default function SponsorUserButton({ userId, isSponsored, pct }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(sponsor: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsor }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      const j = await res.json().catch(() => ({}));
      // WhatsApp best-effort idi — uğursuz olubsa admini xəbərdar et, amma status dəyişdi.
      if (sponsor && j.whatsapp && j.whatsapp.ok === false) {
        alert(
          `Status təyin edildi, amma WhatsApp mesajı göndərilmədi (${j.whatsapp.reason ?? "naməlum səbəb"}).`
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (isSponsored) {
    return (
      <button
        type="button"
        onClick={() => submit(false)}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-admin-chip px-3 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-admin-line2 transition hover:bg-admin-chip2 disabled:opacity-50"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {pending ? "Götürülür..." : "Sponsor statusunu götür"}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/30 transition hover:bg-amber-500/20"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Sponsorlu et
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
            className="relative w-full max-w-lg rounded-2xl border border-amber-500/30 bg-admin-card p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => !pending && setOpen(false)}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-admin-chip hover:text-zinc-900"
              aria-label="Bağla"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
                <Sparkles className="h-5 w-5 text-amber-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-zinc-900">Sponsorlu müştəri et</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Bu müştərinin referal linkiylə qeydiyyatdan keçən istifadəçilərin{" "}
                  <span className="font-semibold text-amber-700">oyun alışlarından</span>{" "}
                  standart faiz əvəzinə{" "}
                  <span className="font-semibold text-amber-700">{pct}%</span> komissiya bu
                  müştəriyə yazılacaq. Müştəriyə dərhal WhatsApp ilə məlumat mesajı göndəriləcək.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded bg-admin-chip px-4 py-2 text-sm text-zinc-700 disabled:opacity-50"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {pending ? "Təyin edilir..." : "Sponsorlu et və mesaj göndər"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
