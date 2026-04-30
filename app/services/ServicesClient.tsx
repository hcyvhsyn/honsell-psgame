"use client";

import { useState } from "react";
import { Gamepad2, PlusCircle, CheckCircle2, AlertTriangle, ArrowRight, Loader2, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PsnOption } from "@/components/CartView";

type ProductType = "ACCOUNT_CREATION" | "TRY_BALANCE" | "PS_PLUS";

type ServiceProduct = {
  id: string;
  type: ProductType;
  title: string;
  description: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  _count?: { codes: number };
};

export default function ServicesClient({
  products,
  isAuthed,
  walletBalanceAzn,
  psnAccounts,
  userProfile,
}: {
  products: ServiceProduct[];
  isAuthed: boolean;
  walletBalanceAzn: number;
  psnAccounts: PsnOption[];
  userProfile: { name: string; email: string; birthDate: string; gender: string } | null;
}) {
  const [tab, setTab] = useState<ProductType>("TRY_BALANCE");

  const tryBalances = products.filter((p) => p.type === "TRY_BALANCE");
  const psPlusPlans = products.filter((p) => p.type === "PS_PLUS");
  const accountCreation = products.find((p) => p.type === "ACCOUNT_CREATION");

  return (
    <section className="mx-auto max-w-4xl px-6 py-10 pb-24">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">Xidmətlər</h1>
        <p className="mt-2 text-zinc-400">PS Store-da ən uyğun hədiyyə kartları və xidmətlər.</p>
      </div>

      <div className="mb-10 flex flex-wrap justify-center gap-2">
        <TabButton active={tab === "TRY_BALANCE"} onClick={() => setTab("TRY_BALANCE")} icon={<KeyRound className="h-4 w-4" />} label="TRY Balans" />
        <TabButton active={tab === "PS_PLUS"} onClick={() => setTab("PS_PLUS")} icon={<PlusCircle className="h-4 w-4" />} label="PS Plus" />
        <TabButton active={tab === "ACCOUNT_CREATION"} onClick={() => setTab("ACCOUNT_CREATION")} icon={<Gamepad2 className="h-4 w-4" />} label="TR Hesab Açılışı" />
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {tab === "TRY_BALANCE" && (
          <TryBalanceBlock items={tryBalances} isAuthed={isAuthed} balance={walletBalanceAzn} />
        )}
        {tab === "PS_PLUS" && (
          <PsPlusBlock items={psPlusPlans} isAuthed={isAuthed} balance={walletBalanceAzn} psnAccounts={psnAccounts} />
        )}
        {tab === "ACCOUNT_CREATION" && (
          <AccountCreationBlock item={accountCreation} isAuthed={isAuthed} balance={walletBalanceAzn} profile={userProfile} />
        )}
      </div>
    </section>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          : "bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      {icon} {label}
    </button>
  );
}

// ─── TRY Balance Block ──────────────────────────────────────────────────────────

function TryBalanceBlock({ items, isAuthed, balance }: { items: ServiceProduct[]; isAuthed: boolean; balance: number }) {
  const [selected, setSelected] = useState<string | null>(null);

  if (items.length === 0) return <EmptyState text="Hələ TRY balans paketləri əlavə olunmayıb." />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const inStock = (item._count?.codes ?? 0) > 0;
          const isActive = selected === item.id;
          return (
            <button
              key={item.id}
              disabled={!inStock}
              onClick={() => setSelected(item.id)}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center transition ${
                inStock
                  ? isActive
                    ? "border-indigo-500/60 bg-indigo-500/10 shadow-[0_8px_30px_-12px_rgba(99,102,241,0.5)]"
                    : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/80 hover:bg-zinc-900"
                  : "cursor-not-allowed border-zinc-800/40 bg-zinc-950/40 opacity-50"
              }`}
            >
              <span className={`text-2xl font-bold tracking-tighter ${inStock ? (isActive ? "text-indigo-300" : "text-white") : "text-zinc-500"}`}>
                {String((item.metadata as Record<string, unknown>)?.tryAmount || "")} TRY
              </span>
              <span className="text-sm font-medium text-zinc-400">{(item.priceAznCents / 100).toFixed(2)} AZN</span>
              {!inStock && <span className="absolute -top-3 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-rose-400">Stokda yoxdur</span>}
            </button>
          );
        })}
      </div>

      {selected && (
        <CheckoutPanel
          item={items.find((i) => i.id === selected)!}
          isAuthed={isAuthed}
          balance={balance}
        />
      )}
    </div>
  );
}

// ─── PS Plus Block ─────────────────────────────────────────────────────────────

function PsPlusBlock({
  items,
  isAuthed,
  balance,
  psnAccounts,
}: {
  items: ServiceProduct[];
  isAuthed: boolean;
  balance: number;
  psnAccounts: PsnOption[];
}) {
  const [tier, setTier] = useState<"ESSENTIAL" | "EXTRA" | "DELUXE">("EXTRA");
  const [duration, setDuration] = useState<1 | 3 | 12>(1);
  const [psnAccountId, setPsnAccountId] = useState(psnAccounts[0]?.id ?? "");

  if (items.length === 0) return <EmptyState text="Hələ PS Plus paketləri əlavə olunmayıb." />;

  const filtered = items.filter((i) => (i.metadata as Record<string, unknown>)?.tier === tier);
  const selectedItem = filtered.find((i) => (i.metadata as Record<string, unknown>)?.durationMonths === duration);

  return (
    <div className="space-y-8">
      {/* Tier Selector */}
      <div className="flex flex-col gap-4 sm:flex-row justify-center">
        {(["ESSENTIAL", "EXTRA", "DELUXE"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 rounded-xl border p-4 text-center transition ${
              tier === t
                ? t === "DELUXE"
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                  : t === "EXTRA"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                  : "border-blue-500/50 bg-blue-500/10 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                : "border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            <div className="text-sm font-bold uppercase tracking-wider">PS Plus</div>
            <div className="text-xl font-black">{t}</div>
          </button>
        ))}
      </div>

      {/* Duration Selector */}
      <div className="flex justify-center gap-2">
        {([1, 3, 12] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDuration(d)}
            className={`rounded-lg px-6 py-2 text-sm font-medium transition ${
              duration === d ? "bg-zinc-200 text-zinc-900" : "bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {d} ay
          </button>
        ))}
      </div>

      {selectedItem ? (
        <CheckoutPanel
          item={selectedItem}
          isAuthed={isAuthed}
          balance={balance}
          requirePsn={true}
          psnAccounts={psnAccounts}
          psnAccountId={psnAccountId}
          setPsnAccountId={setPsnAccountId}
        />
      ) : (
        <div className="text-center text-sm text-zinc-500 py-8">Bu paket aktiv deyil.</div>
      )}
    </div>
  );
}

// ─── Account Creation Block ────────────────────────────────────────────────────

function AccountCreationBlock({
  item,
  isAuthed,
  balance,
  profile,
}: {
  item?: ServiceProduct;
  isAuthed: boolean;
  balance: number;
  profile: Record<string, unknown> | null;
}) {
  const [formData, setFormData] = useState({
    firstName: typeof profile?.name === "string" ? profile.name.split(" ")[0] || "" : "",
    lastName: typeof profile?.name === "string" ? profile.name.split(" ").slice(1).join(" ") || "" : "",
    birthDate: typeof profile?.birthDate === "string" ? profile.birthDate.split("T")[0] || "" : "",
    gender: typeof profile?.gender === "string" ? profile.gender : "MALE",
    email: typeof profile?.email === "string" ? profile.email : "",
    password: "",
  });

  if (!item) return <EmptyState text="Hesab açılışı xidməti hazırda aktiv deyil." />;

  return (
    <div className="mx-auto max-w-xl space-y-8 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-6 sm:p-8 backdrop-blur-md">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">Türkiyə PSN Hesabının Açılması</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Sizin məlumatlarınızla tam şəxsi hesab açılır və təhvil verilir.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-zinc-300">
          Ad
          <input
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5 text-zinc-200 focus:border-indigo-500/50 focus:outline-none"
            placeholder="Adınız"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-zinc-300">
          Soyad
          <input
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5 text-zinc-200 focus:border-indigo-500/50 focus:outline-none"
            placeholder="Soyadınız"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-zinc-300">
          Doğum tarixi
          <input
            type="date"
            value={formData.birthDate}
            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5 text-zinc-200 [color-scheme:dark] focus:border-indigo-500/50 focus:outline-none"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-zinc-300">
          Cinsiyyət
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5 text-zinc-200 focus:border-indigo-500/50 focus:outline-none"
          >
            <option value="MALE">Kişi</option>
            <option value="FEMALE">Qadın</option>
            <option value="OTHER">Digər</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium text-zinc-300 sm:col-span-2">
          E-poçt (Bu mailə hesab açılacaq)
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5 text-zinc-200 focus:border-indigo-500/50 focus:outline-none"
            placeholder="yeni.mail@gmail.com"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-zinc-300 sm:col-span-2">
          İstədiyiniz Şifrə (Min 8 simvol)
          <input
            type="text"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5 text-zinc-200 focus:border-indigo-500/50 focus:outline-none"
            placeholder="Şifrə"
          />
        </label>
      </div>

      <CheckoutPanel item={item} isAuthed={isAuthed} balance={balance} extraData={formData} />
    </div>
  );
}

// ─── Shared Checkout Panel ─────────────────────────────────────────────────────

function CheckoutPanel({
  item,
  isAuthed,
  balance,
  requirePsn = false,
  psnAccounts = [],
  psnAccountId = "",
  setPsnAccountId,
  extraData,
}: {
  item: ServiceProduct;
  isAuthed: boolean;
  balance: number;
  requirePsn?: boolean;
  psnAccounts?: PsnOption[];
  psnAccountId?: string;
  setPsnAccountId?: (id: string) => void;
  extraData?: Record<string, unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; code?: string } | null>(null);
  const router = useRouter();

  const price = item.priceAznCents / 100;
  const insufficient = balance < price;
  const missingPsn = requirePsn && psnAccounts.length === 0;

  async function handleBuy() {
    if (requirePsn && !psnAccountId) {
      setResult({ ok: false, text: "Hesab seçməlisiniz." });
      return;
    }
    setBusy(true);
    setResult(null);

    const res = await fetch("/api/services/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceProductId: item.id,
        psnAccountId: requirePsn ? psnAccountId : undefined,
        metadata: extraData,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.ok) {
      if (data.code) {
        setResult({ ok: true, text: "Uğurlu alış! Sizin e-pin kodunuz:", code: data.code });
      } else {
        setResult({ ok: true, text: "Sifarişiniz qəbul olundu. Admin icra edən kimi tamamlanacaq." });
      }
      setTimeout(() => router.refresh(), 2000);
    } else {
      setResult({ ok: false, text: data.error || "Xəta baş verdi." });
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-zinc-400">Ödəniləcək:</span>
        <span className="text-2xl font-bold text-white">{price.toFixed(2)} AZN</span>
      </div>

      {requirePsn && (
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Çatdırılma Hesabı (PSN)
          </label>
          {psnAccounts.length === 0 ? (
            <Link href="/profile/accounts" className="block rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <AlertTriangle className="mb-0.5 inline-block h-3.5 w-3.5" /> Hesab əlavə etmək lazımdır →
            </Link>
          ) : (
            <select
              value={psnAccountId}
              onChange={(e) => setPsnAccountId!(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
            >
              {psnAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.psnEmail}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {result ? (
        <div className={`rounded-xl p-4 text-center ${result.ok ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20"}`}>
          <p className={`text-sm font-medium ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {result.ok && <CheckCircle2 className="mx-auto mb-2 h-8 w-8" />}
            {result.text}
          </p>
          {result.code && (
            <div className="mt-3 select-all rounded-lg bg-emerald-950 p-3 font-mono text-xl tracking-widest text-emerald-400 shadow-inner">
              {result.code}
            </div>
          )}
        </div>
      ) : !isAuthed ? (
        <Link
          href="/login?next=/services"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
        >
          Sifariş üçün daxil ol <ArrowRight className="h-4 w-4" />
        </Link>
      ) : insufficient ? (
        <Link
          href="/profile/wallet"
          className="flex w-full items-center justify-between rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
        >
          <span>Balansı artır</span>
          <span className="rounded bg-white/20 px-2 py-0.5 text-xs">{(price - balance).toFixed(2)} AZN çatmır</span>
        </Link>
      ) : (
        <button
          disabled={busy || missingPsn}
          onClick={handleBuy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "İşlənir..." : "Cüzdanla ödə"}
        </button>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-900/20 p-12 text-center">
      <p className="text-zinc-500">{text}</p>
    </div>
  );
}
