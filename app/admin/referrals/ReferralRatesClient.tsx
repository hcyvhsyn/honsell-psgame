"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Briefcase,
  Gamepad2,
  Loader2,
  Music,
  Percent,
  RefreshCw,
  Save,
  Tv,
} from "lucide-react";

type PsStoreRates = {
  games: number;
  psPlus: number;
  giftCards: number;
  accountCreation: number;
};

type StreamingRate = {
  service: string;
  label: string;
  category: "STREAMING" | "MUSIC" | string;
  productCount: number;
  activeProductCount: number;
  referralPct: number;
  referralEnabled: boolean;
};

type PlatformRate = {
  id: string;
  title: string;
  category: "MUSIC" | "AI" | "WORK";
  categoryLabel: string;
  isActive: boolean;
  referralPct: number;
  referralEnabled: boolean;
};

type ReferralRates = {
  psStore: PsStoreRates;
  other: {
    reviewAffiliateRatePct: number;
  };
  streaming: StreamingRate[];
  platforms: PlatformRate[];
};

const emptyRates: ReferralRates = {
  psStore: { games: 0, psPlus: 0, giftCards: 0, accountCreation: 0 },
  other: { reviewAffiliateRatePct: 0 },
  streaming: [],
  platforms: [],
};

const psStoreFields: Array<{ key: keyof PsStoreRates; label: string; hint: string }> = [
  { key: "games", label: "Oyunlar", hint: "PS Store oyun alışları" },
  { key: "psPlus", label: "PS Plus", hint: "Abunəlik paketləri" },
  { key: "giftCards", label: "Gift Card", hint: "TRY hədiyyə kartları" },
  { key: "accountCreation", label: "Hesab açma", hint: "Türkiyə hesabı xidməti" },
];

const categoryIcon = {
  MUSIC: Music,
  AI: Brain,
  WORK: Briefcase,
} as const;

export default function ReferralRatesClient() {
  const [rates, setRates] = useState<ReferralRates>(emptyRates);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/referrals", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Referal faizləri yüklənmədi.");
      setRates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Referal faizləri yüklənmədi.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Referal faizləri saxlanmadı.");
      setMessage("Referal faizləri yadda saxlanıldı.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Referal faizləri saxlanmadı.");
    } finally {
      setSaving(false);
    }
  }

  function setPsRate(key: keyof PsStoreRates, value: number) {
    setRates((prev) => ({
      ...prev,
      psStore: { ...prev.psStore, [key]: value },
    }));
  }

  function setOtherRate(key: keyof ReferralRates["other"], value: number) {
    setRates((prev) => ({
      ...prev,
      other: { ...prev.other, [key]: value },
    }));
  }

  function setStreamingRate(service: string, patch: Partial<StreamingRate>) {
    setRates((prev) => ({
      ...prev,
      streaming: prev.streaming.map((item) =>
        item.service === service ? { ...item, ...patch } : item,
      ),
    }));
  }

  function setPlatformRate(id: string, patch: Partial<PlatformRate>) {
    setRates((prev) => ({
      ...prev,
      platforms: prev.platforms.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  const platformsByCategory = useMemo(() => {
    const grouped = new Map<string, PlatformRate[]>();
    for (const item of rates.platforms) {
      grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
    }
    return Array.from(grouped.entries());
  }, [rates.platforms]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-violet-700">
              <Percent className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-semibold text-zinc-900">Referal faizləri</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Bütün referal komissiya faizləri bu səhifədən idarə olunur. Digər admin
            bölmələrində məhsul və paket məlumatları saxlanılır, faizlər isə burada tək
            mənbədən yenilənir.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-admin-line2 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-admin-line2 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Yenilə
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Yadda saxla
          </button>
        </div>
      </header>

      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-violet-700" />
          <h2 className="text-base font-semibold text-zinc-900">PS Store</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {psStoreFields.map((field) => (
            <RateBox
              key={field.key}
              label={field.label}
              hint={field.hint}
              value={rates.psStore[field.key]}
              onChange={(value) => setPsRate(field.key, value)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Percent className="h-5 w-5 text-amber-700" />
          <h2 className="text-base font-semibold text-zinc-900">Digər referal faizləri</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RateBox
            label="Rəy affiliate"
            hint="Təsdiqlənmiş oyun rəyi linkindən gələn alış"
            value={rates.other.reviewAffiliateRatePct}
            onChange={(value) => setOtherRate("reviewAffiliateRatePct", value)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Tv className="h-5 w-5 text-sky-700" />
          <h2 className="text-base font-semibold text-zinc-900">Streaming və musiqi yayımı</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rates.streaming.map((item) => (
            <RateBox
              key={item.service}
              label={item.label}
              hint={`${item.activeProductCount}/${item.productCount} aktiv paket`}
              value={item.referralPct}
              enabled={item.referralEnabled}
              onChange={(value) => setStreamingRate(item.service, { referralPct: value })}
              onEnabledChange={(checked) =>
                setStreamingRate(item.service, {
                  referralEnabled: checked,
                  referralPct: checked ? item.referralPct : 0,
                })
              }
            />
          ))}
        </div>
        {rates.streaming.length === 0 && (
          <p className="text-sm text-zinc-500">Streaming paketi yoxdur.</p>
        )}
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-violet-700" />
          <h2 className="text-base font-semibold text-zinc-900">Platforma məhsulları</h2>
        </div>
        <div className="space-y-5">
          {platformsByCategory.map(([category, items]) => {
            const Icon = categoryIcon[category as keyof typeof categoryIcon] ?? Briefcase;
            return (
              <div key={category}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-800">
                  <Icon className="h-4 w-4 text-violet-700" />
                  {items[0]?.categoryLabel ?? category}
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <RateBox
                      key={item.id}
                      label={item.title}
                      hint={item.isActive ? "Aktiv məhsul" : "Passiv məhsul"}
                      value={item.referralPct}
                      enabled={item.referralEnabled}
                      onChange={(value) => setPlatformRate(item.id, { referralPct: value })}
                      onEnabledChange={(checked) =>
                        setPlatformRate(item.id, {
                          referralEnabled: checked,
                          referralPct: checked ? item.referralPct : 0,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {rates.platforms.length === 0 && (
          <p className="text-sm text-zinc-500">Platforma məhsulu yoxdur.</p>
        )}
      </section>
    </div>
  );
}

function RateBox({
  label,
  hint,
  value,
  enabled,
  onChange,
  onEnabledChange,
}: {
  label: string;
  hint: string;
  value: number;
  enabled?: boolean;
  onChange: (value: number) => void;
  onEnabledChange?: (checked: boolean) => void;
}) {
  const isEnabled = enabled ?? true;
  return (
    <div className="rounded-lg border border-admin-line bg-admin-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{label}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        </div>
        {onEnabledChange && (
          <label className="inline-flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Aktiv
          </label>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={Number.isFinite(value) ? String(value) : "0"}
          disabled={!isEnabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-violet-500 disabled:opacity-50"
        />
        <span className="rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-600">
          %
        </span>
      </div>
    </div>
  );
}
