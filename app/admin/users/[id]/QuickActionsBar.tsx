"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";

type Props = {
  userId: string;
  emailVerified: boolean;
};

export default function QuickActionsBar({ userId, emailVerified }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function run(label: string, url: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await fetch(url, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: j.error ?? `${label} alınmadı` });
        return;
      }
      setMsg({ type: "ok", text: `${label} ✓` });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!emailVerified && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                "Email təsdiqi",
                `/api/admin/users/${userId}/verify-email`,
                "Bu istifadəçinin email-ini manual olaraq təsdiqlə?"
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Email-i təsdiqlə
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              "Şifrə sıfırlama emaili",
              `/api/admin/users/${userId}/send-password-reset`,
              "İstifadəçiyə şifrə sıfırlama kodu göndərilsin?"
            )
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-500/30 transition hover:bg-indigo-500/20 disabled:opacity-50"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Şifrə sıfırla
        </button>
      </div>
      {msg && (
        <div
          className={`rounded px-2.5 py-1 text-[11px] ${
            msg.type === "ok"
              ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
