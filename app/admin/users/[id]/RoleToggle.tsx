"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";

export default function RoleToggle({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === "ADMIN";
  const next = isAdmin ? "USER" : "ADMIN";

  function toggle() {
    setError(null);
    if (
      !confirm(
        isAdmin
          ? "Demote this user from admin?"
          : "Promote this user to admin?"
      )
    )
      return;

    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Update failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ring-1 transition disabled:opacity-50 ${
          isAdmin
            ? "bg-rose-500/10 text-rose-300 ring-rose-500/30 hover:bg-rose-500/20"
            : "bg-indigo-500/10 text-indigo-300 ring-indigo-500/30 hover:bg-indigo-500/20"
        }`}
      >
        {isAdmin ? (
          <>
            <ShieldOff className="h-4 w-4" />
            {pending ? "Demoting…" : "Demote to user"}
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            {pending ? "Promoting…" : "Promote to admin"}
          </>
        )}
      </button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}
