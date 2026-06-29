"use client";

import { useEffect, useState } from "react";
import {
  Gamepad2,
  Gift,
  Loader2,
  Pencil,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Trash2,
  Tv,
  Users,
} from "lucide-react";

type PsStoreRates = {
  games: number;
  psPlus: number;
  giftCards: number;
  accountCreation: number;
};

type ProductRate = {
  id: string;
  label: string;
  variantLabel: string;
  durationMonths: number | null;
  durationLabel: string;
  isActive: boolean;
  priceAznCents: number;
  costAznCents: number;
  referralPct: number;
  referralEnabled: boolean;
};

type Group = {
  key: string;
  kind: "STREAMING" | "PLATFORM";
  label: string;
  categoryLabel: string;
  products: ProductRate[];
};

type Fees = {
  epointFeePct: number;
  taxPct: number;
  cashoutFeePct: number;
};

type Tier = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  color: string | null;
  userCount: number;
  inviteBonusCents: number;
};

type ReferralData = {
  tiers: Tier[];
  tierId: string;
  isDefaultSelected: boolean;
  inviteBonusCents: number;
  psStore: PsStoreRates;
  other: { reviewAffiliateRatePct: number; reviewCashbackRatePct: number };
  fees: Fees;
  groups: Group[];
};

const emptyData: ReferralData = {
  tiers: [],
  tierId: "",
  isDefaultSelected: true,
  inviteBonusCents: 30,
  psStore: { games: 0, psPlus: 0, giftCards: 0, accountCreation: 0 },
  other: { reviewAffiliateRatePct: 0, reviewCashbackRatePct: 0 },
  fees: { epointFeePct: 3, taxPct: 2, cashoutFeePct: 1.5 },
  groups: [],
};

const psStoreFields: Array<{ key: keyof PsStoreRates; label: string; hint: string }> = [
  { key: "games", label: "Oyunlar", hint: "PS Store oyun alışları" },
  { key: "psPlus", label: "PS Plus", hint: "Abunəlik paketləri" },
  { key: "giftCards", label: "Gift Card", hint: "TRY hədiyyə kartları" },
  { key: "accountCreation", label: "Hesab açma", hint: "Türkiyə hesabı xidməti" },
];

function azn(cents: number) {
  return (cents / 100).toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clampNum(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function settlementFee(priceAzn: number, fees: Fees) {
  const epoint = (priceAzn * fees.epointFeePct) / 100;
  const afterEpoint = priceAzn - epoint;
  const tax = (afterEpoint * fees.taxPct) / 100;
  const cashout = (afterEpoint * fees.cashoutFeePct) / 100;
  return { epoint, tax, cashout, total: epoint + tax + cashout };
}

export default function ReferralRatesClient() {
  const [data, setData] = useState<ReferralData>(emptyData);
  const [costAzn, setCostAzn] = useState<Record<string, string>>({});
  const [inviteBonusAzn, setInviteBonusAzn] = useState("0.30");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(tierId?: string) {
    setLoading(true);
    setError(null);
    try {
      const qs = tierId ? `?tierId=${encodeURIComponent(tierId)}` : "";
      const res = await fetch(`/api/admin/referrals${qs}`, { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as ReferralData & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Referal faizləri yüklənmədi.");
      setData(payload);
      const nextCost: Record<string, string> = {};
      for (const group of payload.groups ?? []) {
        for (const p of group.products) nextCost[p.id] = (p.costAznCents / 100).toFixed(2);
      }
      setCostAzn(nextCost);
      setInviteBonusAzn(((payload.inviteBonusCents ?? 0) / 100).toFixed(2));
      setDirty(false);
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
      const productsPayload = data.groups.flatMap((group) =>
        group.products.map((p) => ({
          id: p.id,
          referralPct: p.referralPct,
          referralEnabled: p.referralEnabled,
          costAzn: Number(costAzn[p.id] ?? "0") || 0,
        })),
      );
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: data.tierId,
          psStore: data.psStore,
          other: data.other,
          fees: data.fees,
          inviteBonusAzn: Number(inviteBonusAzn) || 0,
          products: productsPayload,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Referal faizləri saxlanmadı.");
      setMessage("Yadda saxlanıldı.");
      await load(data.tierId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Referal faizləri saxlanmadı.");
    } finally {
      setSaving(false);
    }
  }

  function switchTier(tierId: string) {
    if (tierId === data.tierId) return;
    if (dirty && !window.confirm("Yadda saxlanmamış dəyişikliklər var. Davam edilsin?")) return;
    load(tierId);
  }

  async function createTier() {
    const name = window.prompt("Yeni müştəri tipinin adı:");
    if (!name || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Tip yaradılmadı.");
      await load(payload.tier?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tip yaradılmadı.");
    } finally {
      setBusy(false);
    }
  }

  async function renameTier() {
    const current = data.tiers.find((t) => t.id === data.tierId);
    const name = window.prompt("Yeni ad:", current?.name ?? "");
    if (!name || !name.trim() || name.trim() === current?.name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tiers/${data.tierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Ad dəyişdirilmədi.");
      }
      await load(data.tierId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ad dəyişdirilmədi.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTier() {
    const current = data.tiers.find((t) => t.id === data.tierId);
    if (!current || current.isDefault) return;
    if (
      !window.confirm(
        `"${current.name}" tipi silinsin? Bu tipdəki ${current.userCount} müştəri standart seqmentə keçəcək.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tiers/${data.tierId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Silinmədi.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinmədi.");
    } finally {
      setBusy(false);
    }
  }

  function setPsRate(key: keyof PsStoreRates, value: number) {
    setDirty(true);
    setData((prev) => ({ ...prev, psStore: { ...prev.psStore, [key]: value } }));
  }

  function setOtherRate(key: keyof ReferralData["other"], value: number) {
    setDirty(true);
    setData((prev) => ({ ...prev, other: { ...prev.other, [key]: value } }));
  }

  function setFee(key: keyof Fees, value: number) {
    setDirty(true);
    setData((prev) => ({ ...prev, fees: { ...prev.fees, [key]: value } }));
  }

  function setProduct(productId: string, patch: Partial<ProductRate>) {
    setDirty(true);
    setData((prev) => ({
      ...prev,
      groups: prev.groups.map((group) => ({
        ...group,
        products: group.products.map((p) => (p.id === productId ? { ...p, ...patch } : p)),
      })),
    }));
  }

  if (loading && data.tiers.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const activeTier = data.tiers.find((t) => t.id === data.tierId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-violet-700">
              <Percent className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-semibold text-zinc-900">Referal faizləri və qazanc</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Aşağıda müştəri tipini seçin və həmin tip üçün referal faizlərini, dəvət bonusunu və
            maya dəyərlərini təyin edin. Maya yalnız bu paneldə qazanc proqnozu üçündür — müştəriyə
            görünmür, komissiya ödənişinə təsir etmir (komissiya = qiymət × faiz).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load(data.tierId)}
            disabled={saving || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-admin-line2 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-admin-line2 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Yenilə
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || busy}
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

      {/* Müştəri tipi (tier) seçici */}
      <section className="rounded-xl border border-admin-line bg-admin-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-violet-700" />
          <span className="mr-1 text-sm font-semibold text-zinc-700">Müştəri tipi:</span>
          {data.tiers.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => switchTier(tier.id)}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                tier.id === data.tierId
                  ? "border-violet-500 bg-violet-600 text-white"
                  : "border-admin-line2 bg-admin-card text-zinc-700 hover:border-violet-400"
              }`}
            >
              {tier.name}
              {tier.isDefault && (
                <span
                  className={`rounded px-1 text-[10px] ${
                    tier.id === data.tierId ? "bg-white/20" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  standart
                </span>
              )}
              <span className="text-[11px] opacity-70">· {tier.userCount}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={createTier}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-violet-400 px-3 py-1.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-500/10 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Yeni tip
          </button>
          {activeTier && !activeTier.isDefault && (
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={renameTier}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-admin-line2 px-2 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                title="Adı dəyiş"
              >
                <Pencil className="h-3.5 w-3.5" /> Adı dəyiş
              </button>
              <button
                type="button"
                onClick={deleteTier}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"
                title="Tipi sil"
              >
                <Trash2 className="h-3.5 w-3.5" /> Sil
              </button>
            </span>
          )}
        </div>
        {!data.isDefaultSelected && (
          <p className="mt-3 text-xs text-amber-600">
            “{activeTier?.name}” seqmenti redaktə olunur. Bu seqmentdə açıq təyin etmədiyiniz
            faizlər standart seqmentdən miras alınır (göstərilən dəyərlər effektiv dəyərlərdir).
          </p>
        )}
      </section>

      {/* Dəvət bonusu (per tier) */}
      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Gift className="h-5 w-5 text-emerald-700" />
          <h2 className="text-base font-semibold text-zinc-900">Dəvət bonusu</h2>
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          “{activeTier?.name ?? "—"}” tipindəki dəvət edənə, dəvət olunan qeydiyyatı təsdiqlədikdə
          yazılan sabit məbləğ. 0 → bu tipdə dəvət bonusu bağlıdır.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-admin-line bg-admin-card p-3">
            <p className="text-sm font-semibold text-zinc-900">Bonus məbləği</p>
            <p className="mt-0.5 text-xs text-zinc-500">Hər uğurlu dəvətə görə</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={inviteBonusAzn}
                onChange={(e) => {
                  setDirty(true);
                  setInviteBonusAzn(e.target.value);
                }}
                className="w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-violet-500"
              />
              <span className="rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-600">
                AZN
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Ödəniş və vergi kəsintiləri (qlobal) */}
      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-rose-700" />
          <h2 className="text-base font-semibold text-zinc-900">Ödəniş və vergi kəsintiləri</h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            bütün tiplər üçün ümumi
          </span>
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Hər satışdan tutulan kəsintilər — paketlərin “Kəsinti” və “Xalis/satış” sütunlarına
          tətbiq olunur. Epoint qiymətdən, vergi və nağdlaşdırma isə (qiymət − epoint) məbləğindən.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <RateBox
            label="Epoint (ödəniş sistemi)"
            hint="Satış qiymətinin %-i"
            value={data.fees.epointFeePct}
            onChange={(value) => setFee("epointFeePct", value)}
          />
          <RateBox
            label="Vergi"
            hint="(Qiymət − epoint) üzərindən %"
            value={data.fees.taxPct}
            onChange={(value) => setFee("taxPct", value)}
          />
          <RateBox
            label="Nağdlaşdırma"
            hint="(Qiymət − epoint) üzərindən %"
            value={data.fees.cashoutFeePct}
            onChange={(value) => setFee("cashoutFeePct", value)}
          />
        </div>
      </section>

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
              value={data.psStore[field.key]}
              onChange={(value) => setPsRate(field.key, value)}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          PS Store kateqoriyaları üçün maya dinamik (FX əsaslı) olduğundan ayrıca qazanc proqnozu
          göstərilmir — yalnız referal faizi təyin olunur.
        </p>
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Percent className="h-5 w-5 text-amber-700" />
          <h2 className="text-base font-semibold text-zinc-900">Digər referal faizləri</h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            bütün tiplər üçün ümumi
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RateBox
            label="Rəy affiliate"
            hint="Təsdiqlənmiş oyun rəyi linkindən gələn alış"
            value={data.other.reviewAffiliateRatePct}
            onChange={(value) => setOtherRate("reviewAffiliateRatePct", value)}
          />
          <RateBox
            label="Rəy cashback"
            hint="Aldığı məhsula rəy yazan müştəriyə qiymətin %-i (təsdiqdə)"
            value={data.other.reviewCashbackRatePct}
            onChange={(value) => setOtherRate("reviewCashbackRatePct", value)}
          />
        </div>
      </section>

      {data.groups.map((group) => (
        <ProductGroupTable
          key={group.key}
          group={group}
          costAzn={costAzn}
          fees={data.fees}
          onRate={(id, value) => setProduct(id, { referralPct: value })}
          onEnabled={(id, enabled) => setProduct(id, { referralEnabled: enabled })}
          onCost={(id, value) => {
            setDirty(true);
            setCostAzn((prev) => ({ ...prev, [id]: value }));
          }}
        />
      ))}

      {data.groups.length === 0 && (
        <p className="rounded-xl border border-admin-line bg-admin-card p-5 text-sm text-zinc-500">
          Streaming/platforma paketi tapılmadı.
        </p>
      )}
    </div>
  );
}

function ProductGroupTable({
  group,
  costAzn,
  fees,
  onRate,
  onEnabled,
  onCost,
}: {
  group: Group;
  costAzn: Record<string, string>;
  fees: Fees;
  onRate: (id: string, value: number) => void;
  onEnabled: (id: string, enabled: boolean) => void;
  onCost: (id: string, value: string) => void;
}) {
  const Icon = group.kind === "STREAMING" ? Tv : Percent;
  return (
    <section className="rounded-xl border border-admin-line bg-admin-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-sky-700" />
        <h2 className="text-base font-semibold text-zinc-900">{group.label}</h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {group.categoryLabel}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-admin-line text-left text-xs font-semibold text-zinc-500">
              <th className="px-2 py-2">Paket</th>
              <th className="px-2 py-2 text-center">Aktiv</th>
              <th className="px-2 py-2 text-right">Faiz %</th>
              <th className="px-2 py-2 text-right">Maya (AZN)</th>
              <th className="px-2 py-2 text-right">Qiymət</th>
              <th className="px-2 py-2 text-right">Marja</th>
              <th className="px-2 py-2 text-right">Komissiya/satış</th>
              <th className="px-2 py-2 text-right">Kəsinti/satış</th>
              <th className="px-2 py-2 text-right">Xalis/satış</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line/60">
            {group.products.map((p) => {
              const price = p.priceAznCents / 100;
              const cost = Number(costAzn[p.id] ?? "0") || 0;
              const margin = price - cost;
              const commission = p.referralEnabled ? (price * p.referralPct) / 100 : 0;
              const fee = settlementFee(price, fees);
              const netPerSale = margin - commission - fee.total;
              const sub = [p.variantLabel, p.durationLabel].filter(Boolean).join(" · ");
              return (
                <tr key={p.id} className={p.isActive ? "" : "opacity-60"}>
                  <td className="px-2 py-2">
                    <p className="font-medium text-zinc-900">{p.label}</p>
                    {sub && <p className="text-xs text-zinc-500">{sub}</p>}
                    {!p.isActive && <p className="text-xs text-amber-600">Passiv məhsul</p>}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={p.referralEnabled}
                      onChange={(e) => onEnabled(p.id, e.target.checked)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={Number.isFinite(p.referralPct) ? String(p.referralPct) : "0"}
                      disabled={!p.referralEnabled}
                      onChange={(e) => onRate(p.id, clampNum(Number(e.target.value), 0, 100))}
                      className="w-20 rounded-lg border border-admin-line bg-admin-card px-2 py-1.5 text-right text-sm text-zinc-900 outline-none focus:border-violet-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costAzn[p.id] ?? ""}
                      onChange={(e) => onCost(p.id, e.target.value)}
                      placeholder="0.00"
                      className="w-24 rounded-lg border border-admin-line bg-admin-card px-2 py-1.5 text-right text-sm text-zinc-900 outline-none focus:border-violet-500"
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-700">{azn(p.priceAznCents)}</td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${margin < 0 ? "text-rose-600" : "text-sky-700"}`}
                  >
                    {azn(Math.round(margin * 100))}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-amber-700">
                    {azn(Math.round(commission * 100))}
                  </td>
                  <td
                    className="px-2 py-2 text-right tabular-nums text-rose-600"
                    title={`Epoint ${azn(Math.round(fee.epoint * 100))} + Vergi ${azn(
                      Math.round(fee.tax * 100),
                    )} + Nağd ${azn(Math.round(fee.cashout * 100))} AZN`}
                  >
                    {azn(Math.round(fee.total * 100))}
                  </td>
                  <td
                    className={`px-2 py-2 text-right font-semibold tabular-nums ${
                      netPerSale < 0 ? "text-rose-600" : "text-emerald-700"
                    }`}
                  >
                    {azn(Math.round(netPerSale * 100))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RateBox({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-lg border border-admin-line bg-admin-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-900">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={Number.isFinite(value) ? String(value) : "0"}
          onChange={(e) => onChange(clampNum(Number(e.target.value), 0, 100))}
          className="w-full rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-violet-500"
        />
        <span className="rounded-lg border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-600">
          %
        </span>
      </div>
    </div>
  );
}
