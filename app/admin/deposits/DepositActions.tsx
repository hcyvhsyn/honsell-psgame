"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

export default function DepositActions({ depositId }: { depositId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(action: "approve" | "reject") {
    if (
      !confirm(
        action === "approve"
          ? "Bu deposit-i təsdiqləmək istəyirsən? Müştərinin balansı artırılacaq."
          : "Bu deposit-i rədd etmək istəyirsən?"
      )
    )
      return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/deposits/${depositId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => act("reject")}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1.5 text-xs font-medium text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/25 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
      {error && <span className="text-[10px] text-rose-300">{error}</span>}
    </div>
  );
}
