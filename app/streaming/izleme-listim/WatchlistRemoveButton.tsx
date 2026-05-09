"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * İzləmə listindən sil — favorit toggle endpoint-i istifadə edir, sonra səhifəni
 * yeniləyir ki, server-side data yenidən gətirilsin.
 */
export default function WatchlistRemoveButton({
  tmdbId,
  kind,
  titleSnap,
}: {
  id: string;
  tmdbId: number;
  kind: string;
  titleSnap: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  async function remove() {
    if (!confirm(`"${titleSnap}" izləmə listindən çıxarılsın?`)) return;
    setHidden(true);
    const res = await fetch("/api/streaming/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId, kind, titleSnap }),
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      setHidden(false);
      alert("Silinə bilmədi");
    }
  }

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isPending}
      aria-label="Listdən çıxar"
      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-rose-500 group-hover:opacity-100 disabled:opacity-50"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
