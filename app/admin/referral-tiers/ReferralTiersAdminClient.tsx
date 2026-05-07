"use client";

import { useMemo, useState, useTransition } from "react";

type Tier = {
  id: string;
  thresholdPoints: number;
  label: string;
  emoji: string;
  bonusAznCents: number;
  position: number;
  isActive: boolean;
};

type FormState = {
  thresholdPoints: string;
  label: string;
  emoji: string;
  bonusAzn: string; // AZN, decimal — converted to cents on submit
  position: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  thresholdPoints: "",
  label: "",
  emoji: "",
  bonusAzn: "",
  position: "0",
  isActive: true,
};

export default function ReferralTiersAdminClient({
  initialTiers,
}: {
  initialTiers: Tier[];
}) {
  const [tiers, setTiers] = useState<Tier[]>(initialTiers);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const sorted = useMemo(
    () =>
      [...tiers].sort(
        (a, b) =>
          a.position - b.position || a.thresholdPoints - b.thresholdPoints
      ),
    [tiers]
  );

  function refresh() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/admin/referral-tiers", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Yükləmə alınmadı.");
        return;
      }
      setTiers(Array.isArray(data.tiers) ? data.tiers : []);
    });
  }

  function aznToCents(azn: string): number | null {
    const n = Number(azn.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function createTier() {
    const cents = aznToCents(form.bonusAzn);
    const points = Number(form.thresholdPoints);
    if (!Number.isFinite(points) || points <= 0) {
      setError("Bal həddi düzgün rəqəm olmalıdır (>0).");
      return;
    }
    if (cents == null) {
      setError("Bonus məbləği düzgün AZN dəyəri olmalıdır.");
      return;
    }
    if (!form.label.trim() || !form.emoji.trim()) {
      setError("Ad və emoji tələb olunur.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/admin/referral-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thresholdPoints: points,
          label: form.label.trim(),
          emoji: form.emoji.trim(),
          bonusAznCents: cents,
          position: Number(form.position) || 0,
          isActive: form.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Əlavə etmək alınmadı.");
        return;
      }
      setForm(EMPTY_FORM);
      refresh();
    });
  }

  function updateTier(id: string, patch: Partial<Tier>) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/referral-tiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Yeniləmə alınmadı.");
        return;
      }
      setTiers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...(data.tier ?? patch) } : t))
      );
    });
  }

  function deactivate(id: string) {
    if (!confirm("Bu pilləni deaktiv edirsən? (Tarixi qoruyur, silmir.)")) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/referral-tiers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Deaktivasiya alınmadı.");
        return;
      }
      setTiers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isActive: false } : t))
      );
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Add tier */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-white">Yeni pillə əlavə et</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-6">
          <input
            type="text"
            placeholder="Emoji 🥉"
            value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-1"
          />
          <input
            type="text"
            placeholder="Ad (Bronze)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-2"
          />
          <input
            type="number"
            placeholder="Bal həddi"
            value={form.thresholdPoints}
            onChange={(e) => setForm({ ...form, thresholdPoints: e.target.value })}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Bonus AZN"
            value={form.bonusAzn}
            onChange={(e) => setForm({ ...form, bonusAzn: e.target.value })}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            type="number"
            placeholder="Sıra"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Aktiv
          </label>
          <button
            type="button"
            onClick={createTier}
            disabled={pending}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Əlavə et
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center text-sm text-zinc-500">
            Hələ pillə yoxdur. Yuxarıdan əlavə et.
          </div>
        ) : (
          sorted.map((t) => (
            <TierRow
              key={t.id}
              tier={t}
              disabled={pending}
              onChange={(patch) => updateTier(t.id, patch)}
              onDeactivate={() => deactivate(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TierRow({
  tier,
  disabled,
  onChange,
  onDeactivate,
}: {
  tier: Tier;
  disabled: boolean;
  onChange: (patch: Partial<Tier>) => void;
  onDeactivate: () => void;
}) {
  const [draft, setDraft] = useState({
    emoji: tier.emoji,
    label: tier.label,
    thresholdPoints: String(tier.thresholdPoints),
    bonusAzn: (tier.bonusAznCents / 100).toFixed(2),
    position: String(tier.position),
  });
  const dirty =
    draft.emoji !== tier.emoji ||
    draft.label !== tier.label ||
    draft.thresholdPoints !== String(tier.thresholdPoints) ||
    draft.bonusAzn !== (tier.bonusAznCents / 100).toFixed(2) ||
    draft.position !== String(tier.position);

  function commit() {
    const points = Number(draft.thresholdPoints);
    const cents = Math.round(Number(draft.bonusAzn.replace(",", ".")) * 100);
    onChange({
      emoji: draft.emoji.trim(),
      label: draft.label.trim(),
      thresholdPoints: Number.isFinite(points) ? points : tier.thresholdPoints,
      bonusAznCents: Number.isFinite(cents) ? cents : tier.bonusAznCents,
      position: Number(draft.position) || 0,
    });
  }

  return (
    <div
      className={`grid grid-cols-1 items-center gap-3 rounded-2xl border px-4 py-3 sm:grid-cols-[60px_1.4fr_1fr_1fr_80px_auto] ${
        tier.isActive ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-60"
      }`}
    >
      <input
        type="text"
        value={draft.emoji}
        onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-center text-sm"
      />
      <input
        type="text"
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
      />
      <input
        type="number"
        value={draft.thresholdPoints}
        onChange={(e) => setDraft({ ...draft, thresholdPoints: e.target.value })}
        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
        title="Bal həddi"
      />
      <input
        type="text"
        inputMode="decimal"
        value={draft.bonusAzn}
        onChange={(e) => setDraft({ ...draft, bonusAzn: e.target.value })}
        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
        title="Bonus AZN"
      />
      <input
        type="number"
        value={draft.position}
        onChange={(e) => setDraft({ ...draft, position: e.target.value })}
        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
        title="Sıra"
      />
      <div className="flex items-center justify-end gap-2">
        <label className="flex items-center gap-1 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={tier.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
          />
          Aktiv
        </label>
        {dirty && (
          <button
            type="button"
            onClick={commit}
            disabled={disabled}
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Saxla
          </button>
        )}
        {tier.isActive && (
          <button
            type="button"
            onClick={onDeactivate}
            disabled={disabled}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            Deaktiv
          </button>
        )}
      </div>
    </div>
  );
}
