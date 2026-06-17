"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Check,
  Coins,
  IdCard,
  KeyRound,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useCart, type InGameCreditCartDetails } from "@/lib/cart";

export type InGameCreditPlan = {
  id: string;
  title: string;
  priceAznCents: number;
  description: string | null;
  imageUrl: string | null;
  metadata: {
    amount?: number;
    currency?: string;
    deliveryMethod?: "EPIN" | "ID_TOPUP";
  } | null;
};

type Props = {
  plans: InGameCreditPlan[];
  productType: string;
  brand: string;
  currencyLabel: string;
  brandSubtitle: string;
  imageShape?: "wide" | "square";
};

type Tab = "EPIN" | "ID_TOPUP";

export default function InGameCreditClient({
  plans,
  productType,
  brand,
  currencyLabel,
  brandSubtitle,
  imageShape = "wide",
}: Props) {
  const [addedId, setAddedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("EPIN");
  const [idModalPlan, setIdModalPlan] = useState<InGameCreditPlan | null>(null);
  const cart = useCart();

  const heroImage = useMemo(() => plans.find((p) => p.imageUrl)?.imageUrl ?? null, [plans]);
  const heroDescription = useMemo(
    () => plans.find((p) => p.description)?.description ?? null,
    [plans],
  );

  // Split by delivery method
  const epinPlans = useMemo(
    () => plans.filter((p) => (p.metadata?.deliveryMethod ?? "EPIN") === "EPIN"),
    [plans],
  );
  const idTopupPlans = useMemo(
    () => plans.filter((p) => p.metadata?.deliveryMethod === "ID_TOPUP"),
    [plans],
  );

  // If only one delivery method has products, force that tab.
  useEffect(() => {
    if (epinPlans.length === 0 && idTopupPlans.length > 0) setActiveTab("ID_TOPUP");
    else if (idTopupPlans.length === 0 && epinPlans.length > 0) setActiveTab("EPIN");
  }, [epinPlans.length, idTopupPlans.length]);

  const visiblePlans = activeTab === "EPIN" ? epinPlans : idTopupPlans;

  const sorted = useMemo(
    () =>
      [...visiblePlans].sort((a, b) => {
        const aa = Number(a.metadata?.amount ?? 0);
        const bb = Number(b.metadata?.amount ?? 0);
        return aa - bb;
      }),
    [visiblePlans],
  );

  const bestValueId = useMemo(() => {
    let bestId: string | null = null;
    let bestRatio = Number.POSITIVE_INFINITY;
    for (const p of sorted) {
      const amt = Number(p.metadata?.amount ?? 0);
      if (amt <= 0) continue;
      const ratio = p.priceAznCents / amt;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestId = p.id;
      }
    }
    return bestId;
  }, [sorted]);

  function commitAdd(plan: InGameCreditPlan, details: InGameCreditCartDetails) {
    cart.add({
      id: plan.id,
      title: plan.title,
      imageUrl: plan.imageUrl ?? null,
      finalAzn: plan.priceAznCents / 100,
      productType,
    });
    cart.updateInGameCredit(plan.id, details);
    setAddedId(plan.id);
    setTimeout(() => setAddedId((cur) => (cur === plan.id ? null : cur)), 1500);
  }

  function handleAddClick(plan: InGameCreditPlan) {
    const method = plan.metadata?.deliveryMethod ?? "EPIN";
    if (method === "ID_TOPUP") {
      setIdModalPlan(plan);
      return;
    }
    commitAdd(plan, { deliveryMethod: "EPIN" });
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 p-10 text-center">
        <Coins className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">
          Hələ aktiv {brand} {currencyLabel} paketi yoxdur. Tezliklə əlavə olunacaq.
        </p>
      </div>
    );
  }

  const showBothTabs = epinPlans.length > 0 && idTopupPlans.length > 0;
  const squareArtwork = imageShape === "square";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section
        className={
          squareArtwork
            ? "overflow-hidden rounded-[2rem] border border-violet-300/20 bg-[linear-gradient(135deg,rgba(24,24,27,0.98),rgba(50,18,88,0.78),rgba(9,9,11,0.98))] shadow-[0_24px_80px_-48px_rgba(168,85,247,0.7)]"
            : "overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950/40 via-zinc-950 to-zinc-950"
        }
      >
        <div
          className={
            squareArtwork
              ? "grid gap-0 lg:grid-cols-[1.08fr_0.92fr]"
              : "grid gap-0 md:grid-cols-[1fr_1.1fr]"
          }
        >
          {squareArtwork ? (
            <>
              <div className="flex flex-col justify-center gap-5 p-6 sm:p-8 lg:p-10">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Rəsmi e-pin kod
                </div>
                <div>
                  <h2 className="max-w-2xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                    {brand} {currencyLabel} paketləri
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
                    {heroDescription || brandSubtitle}
                  </p>
                </div>

                <div className="grid max-w-xl grid-cols-3 gap-2">
                  <HeroMetric icon={<Zap className="h-4 w-4" />} label="Çatdırılma" value="Sürətli" />
                  <HeroMetric icon={<Coins className="h-4 w-4" />} label="Variant" value={`${plans.length}`} />
                  <HeroMetric icon={<KeyRound className="h-4 w-4" />} label="Kod" value="E-PIN" />
                </div>
              </div>

              <div className="flex items-center justify-center p-5 sm:p-8 lg:p-10">
                <div className="relative aspect-square w-full max-w-[390px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-900 shadow-2xl shadow-black/35">
                  {heroImage ? (
                    <Image
                      src={heroImage}
                      alt={`${brand} ${currencyLabel}`}
                      fill
                      priority
                      sizes="(max-width: 1024px) 80vw, 390px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-[linear-gradient(135deg,rgba(124,58,237,0.24),rgba(39,39,42,0.95))]">
                      <Coins className="h-16 w-16 text-violet-200/50" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/90 to-transparent p-5">
                    <div className="inline-flex rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-black text-white backdrop-blur">
                      {currencyLabel} kodları
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative aspect-[16/9] w-full md:aspect-auto md:min-h-[280px]">
                {heroImage ? (
                  <Image
                    src={heroImage}
                    alt={`${brand} ${currencyLabel}`}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-violet-900/40 to-zinc-900">
                    <Coins className="h-16 w-16 text-violet-300/40" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent md:bg-gradient-to-r" />
              </div>

              <div className="flex flex-col justify-center gap-4 p-6 md:p-8">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Anlıq çatdırılma
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {brand} {currencyLabel} paketləri
                </h2>
                <p className="max-w-prose text-sm text-zinc-300">{heroDescription || brandSubtitle}</p>

                <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Rəsmi kodlar
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-300" />
                    Sürətli təsdiq
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-violet-300" />
                    {plans.length} variant
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Tabs */}
      {showBothTabs && (
        <div className="inline-flex rounded-2xl border border-white/10 bg-zinc-950 p-1">
          <TabButton
            active={activeTab === "EPIN"}
            onClick={() => setActiveTab("EPIN")}
            icon={<KeyRound className="h-4 w-4" />}
            label="E-PIN kod"
            count={epinPlans.length}
          />
          <TabButton
            active={activeTab === "ID_TOPUP"}
            onClick={() => setActiveTab("ID_TOPUP")}
            icon={<IdCard className="h-4 w-4" />}
            label="ID yükləmə"
            count={idTopupPlans.length}
          />
        </div>
      )}

      {/* Tab description */}
      <div
        className={
          squareArtwork
            ? "rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.07] px-4 py-3 text-sm leading-6 text-zinc-300"
            : "-mt-2 text-sm text-zinc-400"
        }
      >
        {activeTab === "EPIN" ? (
          <>
            <span className="font-semibold text-zinc-200">E-PIN kod:</span> Ödənişdən sonra
            12 rəqəmli e-pin kodunu emaillə və sifariş səhifəsində alırsan, özün
            oyunda istifadə edirsən.
          </>
        ) : (
          <>
            <span className="font-semibold text-zinc-200">ID yükləmə:</span> Səbətə əlavə
            edərkən oyun ID-ni daxil edirsən, biz birbaşa hesabına yükləyirik.
            Kod almaq lazım deyil.
          </>
        )}
      </div>

      {/* Denomination grid */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
              Paketlər
            </p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
              Paketi seç
            </h3>
          </div>
        </div>
        <div
          className={
            squareArtwork
              ? "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
              : "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
          }
        >
          {sorted.map((plan) => {
            const inCart = cart.has(plan.id);
            const amount = Number(plan.metadata?.amount ?? 0);
            const isBest = plan.id === bestValueId && sorted.length > 1;
            return (
              <article
                key={plan.id}
                className={`group relative flex min-w-0 flex-col overflow-hidden border bg-zinc-950 transition ${
                  squareArtwork ? "rounded-[1.35rem] p-2.5" : "rounded-2xl"
                } ${
                  isBest
                    ? "border-violet-400/60 shadow-[0_18px_44px_-22px_rgba(124,58,237,0.65)]"
                    : "border-white/10 hover:border-violet-400/35"
                }`}
              >
                <div
                  className={
                    squareArtwork
                      ? "relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-900"
                      : "relative aspect-[2/1] w-full overflow-hidden bg-zinc-900"
                  }
                >
                  {plan.imageUrl ? (
                    <Image
                      src={plan.imageUrl}
                      alt={plan.title}
                      fill
                      sizes={
                        squareArtwork
                          ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                          : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      }
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-violet-900/30 to-zinc-900">
                      <Coins className="h-10 w-10 text-violet-300/40" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/20 to-transparent" />
                  {isBest && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-500/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
                      <Sparkles className="h-3 w-3" /> Sərfəli
                    </span>
                  )}
                </div>

                <div className={squareArtwork ? "flex flex-1 flex-col gap-3 p-1.5 pt-3" : "flex flex-col gap-3 p-4"}>
                  <div>
                    <p className="line-clamp-1 text-xs font-semibold text-zinc-500">
                      {plan.title}
                    </p>
                    <div
                      className={
                        squareArtwork
                          ? "mt-1 text-xl font-black tabular-nums text-white sm:text-2xl"
                          : "text-2xl font-black tabular-nums text-white"
                      }
                    >
                      {amount.toLocaleString("en-US")}{" "}
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {plan.metadata?.currency ?? currencyLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto text-lg font-bold tabular-nums text-zinc-100">
                    {(plan.priceAznCents / 100).toFixed(2)}₼
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddClick(plan)}
                    className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 ${
                      inCart || addedId === plan.id
                        ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                        : "bg-violet-600 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500"
                    }`}
                  >
                    {inCart || addedId === plan.id ? (
                      <>
                        <Check className="h-4 w-4" /> Səbətdə
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Səbətə əlavə et
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section
        className={
          squareArtwork
            ? "grid gap-3 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-5 sm:grid-cols-3 sm:p-6"
            : "grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-3 sm:p-6"
        }
      >
        <Step n={1} title="Paketi seç" body="Yuxarıdakı variantlardan ehtiyacın olan miqdarı seç." />
        <Step
          n={2}
          title={activeTab === "ID_TOPUP" ? "ID-ni daxil et" : "Ödə"}
          body={
            activeTab === "ID_TOPUP"
              ? "Səbətə əlavə edərkən oyun ID-ni və nickname-ini daxil et."
              : "Cüzdandan, kartla və ya transferla ödənişi tamamla."
          }
        />
        <Step
          n={3}
          title={activeTab === "ID_TOPUP" ? "Hesabına yüklənsin" : "Kodu al"}
          body={
            activeTab === "ID_TOPUP"
              ? "Ödəniş təsdiqləndikdən sonra biz birbaşa hesabına yükləyirik."
              : "Ödəniş təsdiqindən sonra e-pin kod emailə və sifariş səhifəsinə gəlir."
          }
        />
      </section>

      {/* ID modal */}
      {idModalPlan && (
        <IdTopupModal
          plan={idModalPlan}
          brand={brand}
          currencyLabel={currencyLabel}
          onCancel={() => setIdModalPlan(null)}
          onConfirm={(details) => {
            commitAdd(idModalPlan, details);
            setIdModalPlan(null);
          }}
        />
      )}
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center gap-2 text-violet-100">
        {icon}
        <span className="truncate text-sm font-black">{value}</span>
      </div>
      <p className="mt-1 truncate text-[11px] font-semibold text-zinc-500">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
          : "text-zinc-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      {label}
      <span
        className={`ml-1 rounded-full px-1.5 text-[10px] font-black tabular-nums ${
          active ? "bg-white/20 text-white" : "bg-white/[0.08] text-zinc-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500/15 text-sm font-black text-violet-200">
        {n}
      </span>
      <div>
        <div className="text-sm font-bold text-white">{title}</div>
        <p className="mt-0.5 text-xs text-zinc-400">{body}</p>
      </div>
    </div>
  );
}

function IdTopupModal({
  plan,
  brand,
  currencyLabel,
  onCancel,
  onConfirm,
}: {
  plan: InGameCreditPlan;
  brand: string;
  currencyLabel: string;
  onCancel: () => void;
  onConfirm: (details: InGameCreditCartDetails) => void;
}) {
  const [playerId, setPlayerId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = playerId.trim();
    if (!id) {
      setErr("Oyun ID-ni daxil edin");
      return;
    }
    if (!/^[0-9]{5,15}$/.test(id)) {
      setErr("ID yalnız rəqəmlərdən ibarət olmalıdır (5-15 simvol)");
      return;
    }
    onConfirm({
      deliveryMethod: "ID_TOPUP",
      playerId: id,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Bağla"
        onClick={onCancel}
        className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Bağla"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
            <IdCard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">{brand} ID yükləmə</h3>
            <p className="text-xs text-zinc-400">
              {plan.metadata?.amount?.toLocaleString("en-US") ?? "—"} {currencyLabel} · {(plan.priceAznCents / 100).toFixed(2)} ₼
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Oyun ID *
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={playerId}
              onChange={(e) => {
                setPlayerId(e.target.value);
                setErr(null);
              }}
              placeholder="məs. 5123456789"
              className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-zinc-100 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
            />
          </label>

          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p className="font-semibold">Vacib:</p>
            <p className="mt-1 text-amber-200/90">
              ID-ni səhvsiz daxil edin — yanlış ID-yə yüklənmiş vahid geri qaytarıla bilməz.
            </p>
          </div>

          {err && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {err}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/5"
          >
            Ləğv et
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500"
          >
            Səbətə əlavə et
          </button>
        </div>
      </form>
    </div>
  );
}
