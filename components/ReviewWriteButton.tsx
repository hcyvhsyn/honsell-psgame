"use client";

import { useState } from "react";
import { Pen } from "lucide-react";
import { useModals } from "@/lib/modals";

export default function ReviewWriteButton() {
  const { open } = useModals();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data?.user) {
        open("login");
        return;
      }
      open("review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-2 rounded-full bg-[#6D28D9] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#5B21B6] shadow-lg shadow-purple-500/20 disabled:opacity-50"
    >
      <Pen className="h-4 w-4" /> Rəy yaz
    </button>
  );
}

