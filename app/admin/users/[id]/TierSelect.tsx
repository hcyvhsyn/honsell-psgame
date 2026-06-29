"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

type TierOption = { id: string; name: string; slug: string; isDefault: boolean };

type Props = {
  userId: string;
  currentTierId: string | null;
  tiers: TierOption[];
};

export default function TierSelect({ userId, currentTierId, tiers }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Default seqment "Standart" kimi göstərilir; tierId = null da ona uyğundur.
  const defaultTier = tiers.find((t) => t.isDefault) ?? null;
  const selected = currentTierId ?? defaultTier?.id ?? "";

  function change(value: string) {
    setError(null);
    // Default seqment seçilirsə tierId = null göndər (miras davranışı ilə uyğun).
    const tierId = value && value !== defaultTier?.id ? value : null;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/tier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (j.whatsapp && j.whatsapp.ok === false) {
        alert(
          `Tip təyin edildi, amma WhatsApp mesajı göndərilmədi (${j.whatsapp.reason ?? "naməlum səbəb"}).`,
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="inline-flex items-center gap-2 rounded-md bg-admin-chip px-2.5 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-admin-line2">
        <Users className="h-3.5 w-3.5 text-violet-700" />
        <span className="text-zinc-500">Müştəri tipi:</span>
        <select
          value={selected}
          disabled={pending}
          onChange={(e) => change(e.target.value)}
          className="bg-transparent text-xs font-semibold text-zinc-900 outline-none disabled:opacity-50"
        >
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.isDefault ? " (standart)" : ""}
            </option>
          ))}
        </select>
      </label>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
