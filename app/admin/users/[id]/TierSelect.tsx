"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

type TierOption = {
  id: string;
  name: string;
  displayName?: string | null;
  slug: string;
  kind: string;
  isDefault: boolean;
};

type Props = {
  userId: string;
  currentTierId: string | null;
  tiers: TierOption[];
};

const AUTO_VALUE = "__auto__";

/**
 * İstifadəçinin müştəri statusu. "Avtomatik" → tierId NULL (xərcə görə AUTO tier).
 * MANUAL tier seçilərsə avtomatik tier-i əvəz edir (override).
 */
export default function TierSelect({ userId, currentTierId, tiers }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const manualTiers = tiers.filter((t) => t.kind !== "AUTO");
  // Cari dəyər: manual tier-ə bağlıdırsa onun id-si, əks halda Avtomatik.
  const currentIsManual = currentTierId && manualTiers.some((t) => t.id === currentTierId);
  const selected = currentIsManual ? currentTierId! : AUTO_VALUE;

  function change(value: string) {
    setError(null);
    const tierId = value === AUTO_VALUE ? null : value;
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
          `Status təyin edildi, amma WhatsApp mesajı göndərilmədi (${j.whatsapp.reason ?? "naməlum səbəb"}).`,
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="inline-flex items-center gap-2 rounded-md bg-admin-chip px-2.5 py-2 text-xs font-semibold text-zinc-700 ring-1 ring-admin-line2">
        <Users className="h-3.5 w-3.5 text-violet-700" />
        <span className="text-zinc-500">Status:</span>
        <select
          value={selected}
          disabled={pending}
          onChange={(e) => change(e.target.value)}
          className="bg-transparent text-xs font-semibold text-zinc-900 outline-none disabled:opacity-50"
        >
          <option value={AUTO_VALUE}>Avtomatik (xərcə görə)</option>
          {manualTiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName || t.name}
            </option>
          ))}
        </select>
      </label>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
