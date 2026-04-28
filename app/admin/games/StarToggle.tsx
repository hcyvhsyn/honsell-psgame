"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

export default function StarToggle({
  gameId,
  isFeatured,
}: {
  gameId: string;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(isFeatured);

  function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const res = await fetch(`/api/admin/games/${gameId}/featured`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: next }),
      });
      if (!res.ok) {
        setOptimistic(!next);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={optimistic ? "Unfeature" : "Mark as Most Popular"}
      className={`grid h-8 w-8 place-items-center rounded-md ring-1 transition disabled:opacity-50 ${
        optimistic
          ? "bg-amber-500/15 text-amber-300 ring-amber-500/40 hover:bg-amber-500/25"
          : "bg-zinc-900 text-zinc-500 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-300"
      }`}
    >
      <Star
        className={`h-4 w-4 ${optimistic ? "fill-amber-300" : ""}`}
      />
    </button>
  );
}
