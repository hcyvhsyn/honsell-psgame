"use client";

import { useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/lib/dialogs";

export default function ActionButtons({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const dialog = useDialog();

  async function act(action: "SUCCESS" | "FAILED") {
    if (
      !(await dialog.confirm({
        title: action === "SUCCESS" ? "Sifarişi tamamla?" : "Rədd et?",
        confirmLabel: action === "SUCCESS" ? "Tamamla" : "Rədd et",
        tone: action === "SUCCESS" ? "default" : "danger",
      }))
    )
      return;
    setBusy(true);
    await fetch(`/api/admin/service-orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    router.refresh();
  }

  if (busy) return <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />;

  return (
    <div className="flex gap-2">
      <button onClick={() => act("SUCCESS")} className="rounded bg-emerald-500/20 p-1 text-emerald-400 hover:bg-emerald-500/30" title="Tamamla (Success)">
        <Check className="h-4 w-4" />
      </button>
      <button onClick={() => act("FAILED")} className="rounded bg-rose-500/20 p-1 text-rose-400 hover:bg-rose-500/30" title="Rədd et (Failed)">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
