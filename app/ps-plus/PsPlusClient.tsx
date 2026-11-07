"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, CheckCircle2, Crown, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import ReferralBadge from "@/components/ReferralBadge";
import InstallmentHint from "@/components/InstallmentHint";

type Plan = {
  id: string;
  title: string;
  imageUrl?: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
};

type TierKey = "ESSENTIAL" | "EXTRA" | "DELUXE";

const TIERS: TierKey[] = ["ESSENTIAL", "EXTRA", "DELUXE"];

/** Hər paket əvvəlkinin hamısını daxil edir — kartda yalnız ƏLAVƏ olunan göstərilir. */
const TIER_INFO: Record<TierKey, { name: string; badge?: string; includes: string[] }> = {
  ESSENTIAL: {
    name: "Essential",
    includes: ["Onlayn multiplayer", "Hər ay pulsuz oyunlar", "Bulud yaddaşı"],
  },
  EXTRA: {
    name: "Extra",
    badge: "Ən çox seçilən",
    includes: ["Essential-in hamısı", "400+ PS4/PS5 oyun kataloqu", "Ubisoft+ Classics"],
  },
  DELUXE: {
    name: "Deluxe",
    includes: ["Extra-nın hamısı", "PS1, PS2, PSP klassikləri", "Oyun sınaqları (Game Trials)"],
  },
};

const TIER_DOT: Record<TierKey, string> = {
  ESSENTIAL: "text-sky-600 dark:text-sky-300",
  EXTRA: "text-emerald-600 dark:text-emerald-300",
  DELUXE: "text-amber-600 dark:text-amber-300",
};

const meta = (plan: Plan) => (plan.metadata ?? {}) as Record<string, unknown>;
const planTier = (plan: Plan) => String(meta(plan).tier ?? "") as TierKey;
const planMonths = (plan: Plan) => Number(meta(plan).durationMonths ?? 0) || 0;
const planOriginalCents = (plan: Plan) => {
  const v = Number(meta(plan).originalPriceAznCents ?? 0);
  return Number.isFinite(v) && v > plan.priceAznCents ? v : null;
};
const azn = (cents: number) => `${(cents / 100).toFixed(2)} ₼`;

export default function PsPlusClient({
  plans,
  flatMode = false,
}: {
  plans: Plan[];
  /** Köhnə prop — yalnız `flatMode` ilə birlikdə işlədilirdi. */
  hideTierSelector?: boolean;
  /** `/playstation` ana bölməsi: hər paketin 1 aylıq kartı yan-yana. */
  flatMode?: boolean;
}) {
  return flatMode ? <PlanCardGrid plans={plans} /> : <PsPlusPicker plans={plans} />;
}

/** `/ps-plus`: paket → müddət → qiymət → səbət, hamısı bir axında. */
function PsPlusPicker({ plans }: { plans: Plan[] }) {
  const { add, has } = useCart();
  const valid = useMemo(() => plans.filter((p) => TIERS.includes(planTier(p)) && planMonths(p) > 0), [plans]);
  const available = TIERS.filter((t) => valid.some((p) => planTier(p) === t));

  const [tierWanted, setTierWanted] = useState<TierKey>("EXTRA");
  const [monthsWanted, setMonthsWanted] = useState(1);
  const [added, setAdded] = useState<string | null>(null);

  const tier = available.includes(tierWanted) ? tierWanted : available[0];
  const tierPlans = valid.filter((p) => planTier(p) === tier).sort((a, b) => planMonths(a) - planMonths(b));
  const selected = tierPlans.find((p) => planMonths(p) === monthsWanted) ?? tierPlans[0] ?? null;
  const oneMonth = tierPlans.find((p) => planMonths(p) === 1) ?? null;

  if (!tier || !selected) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
        Hazırda aktiv PS Plus paketi yoxdur.
      </div>
    );
  }

  const months = planMonths(selected);
  const original = planOriginalCents(selected);
  const inCart = has(selected.id) || added === selected.id;
  // 1 aylıqla müqayisədə qənaət (aylıq qiymətə görə).
  const savingPct = (p: Plan) =>
    oneMonth && planMonths(p) > 1
      ? Math.round((1 - p.priceAznCents / planMonths(p) / oneMonth.priceAznCents) * 100)
      : 0;

  function addToCart() {
    if (!selected) return;
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? null,
      finalAzn: selected.priceAznCents / 100,
      productType: "PS_PLUS",
    });
    setAdded(selected.id);
  }

  const label = "mb-3 text-sm font-bold text-zinc-700 dark:text-zinc-300";

  return (
    <div className="space-y-8">
      <section aria-label="Paket">
        <p className={label}>Paket</p>
        <div className="grid gap-3 md:grid-cols-3">
          {available.map((t) => {
            const info = TIER_INFO[t];
            const active = t === tier;
            const fromPpm = Math.min(
              ...valid.filter((p) => planTier(p) === t).map((p) => p.priceAznCents / planMonths(p)),
            );
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setTierWanted(t)}
                className={`relative flex flex-col rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-500/10 dark:ring-violet-400"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl font-black text-zinc-950 dark:text-white">{info.name}</span>
                  {info.badge ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {info.badge}
                    </span>
                  ) : null}
                </div>
                <span className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Ayda {azn(fromPpm)}-dan
                </span>
                <ul className="mt-3 space-y-1.5">
                  {info.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${TIER_DOT[t]}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Müddət">
        <p className={label}>Müddət</p>
        <div className="flex flex-wrap gap-2">
          {tierPlans.map((p) => {
            const active = p.id === selected.id;
            const saving = savingPct(p);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setMonthsWanted(planMonths(p))}
                className={`min-w-[7.5rem] rounded-2xl border px-4 py-2.5 text-left transition ${
                  active
                    ? "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 dark:border-white/15 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:border-white/30"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-black">
                  {planMonths(p)} ay
                  {saving > 0 ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? "bg-white/20" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      −{saving}%
                    </span>
                  ) : null}
                </span>
                <span className={`mt-0.5 block text-xs ${active ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"}`}>
                  ayda {azn(p.priceAznCents / planMonths(p))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            {selected.imageUrl ? (
              <Image src={selected.imageUrl} alt="" fill sizes="64px" className="object-cover" />
            ) : (
              <Crown className="absolute inset-0 m-auto h-7 w-7 text-zinc-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              PS Plus {TIER_INFO[tier].name} · {months} ay
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-3xl font-black tabular-nums text-zinc-950 dark:text-white">
                {azn(selected.priceAznCents)}
              </span>
              {original ? (
                <span className="text-sm text-zinc-400 line-through tabular-nums">{azn(original)}</span>
              ) : null}
            </div>
            <InstallmentHint priceAzn={selected.priceAznCents / 100} variant="card" className="mt-1" />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={addToCart}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black transition ${
              inCart
                ? "border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
            }`}
          >
            {inCart ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {inCart ? "Səbətdədir" : "Səbətə əlavə et"}
          </button>
          <ReferralBadge category="psPlus" productName={selected.title} />
        </div>
      </section>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        PS Plus Türkiyə (TR) PSN hesabına aktivləşir.{" "}
        <Link href="/hesab-acma" className="font-semibold text-violet-600 underline-offset-2 hover:underline dark:text-violet-300">
          TR hesabın yoxdur? Açaq
        </Link>
      </p>
    </div>
  );
}

/** `/playstation` ana bölməsi üçün kart şəbəkəsi (dəyişməyib). */
function PlanCardGrid({ plans }: { plans: Plan[] }) {
  const [addedId, setAddedId] = useState<string | null>(null);
  const { add, has } = useCart();
  const flatMode = true;
  const tierPlans = plans;

  function addToCart(selected: Plan) {
    add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? null,
      finalAzn: selected.priceAznCents / 100,
      productType: "PS_PLUS",
    });
    setAddedId(selected.id);
    setTimeout(() => setAddedId((current) => (current === selected.id ? null : current)), 1500);
  }

  return (
    <div className="w-full">
      {tierPlans.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tierPlans
            .slice()
            .sort((a, b) => {
              if (flatMode) {
                const order: Record<string, number> = { ESSENTIAL: 0, EXTRA: 1, DELUXE: 2 };
                return (
                  (order[String((a.metadata ?? {}).tier ?? "")] ?? 99) -
                  (order[String((b.metadata ?? {}).tier ?? "")] ?? 99)
                );
              }

              return (
                Number((a.metadata ?? {}).durationMonths ?? 0) -
                Number((b.metadata ?? {}).durationMonths ?? 0)
              );
            })
            .map((selected) => {
              const inCart = has(selected.id);
              const originalPriceCents = Number(
                (selected.metadata as Record<string, unknown> | null)?.originalPriceAznCents ?? 0
              );
              const hasDiscount =
                Number.isFinite(originalPriceCents) &&
                originalPriceCents > selected.priceAznCents;
              const durationMonths = Number(
                (selected.metadata as Record<string, unknown> | null)?.durationMonths ?? 0
              );

              let discountPercent = 0;
              if (hasDiscount && originalPriceCents > 0) {
                discountPercent = Math.round(
                  ((originalPriceCents - selected.priceAznCents) / originalPriceCents) * 100
                );
              }

              const cardTier = planTier(selected);
              const isEssential = cardTier === "ESSENTIAL";
              const isExtra = cardTier === "EXTRA";

              const cardHover = isEssential
                ? "hover:border-sky-500/50 hover:shadow-[0_8px_30px_-10px_rgba(14,165,233,0.15)]"
                : isExtra
                  ? "hover:border-emerald-500/50 hover:shadow-[0_8px_30px_-10px_rgba(16,185,129,0.15)]"
                  : "hover:border-amber-500/50 hover:shadow-[0_8px_30px_-10px_rgba(245,158,11,0.15)]";

              const topGlow = isEssential
                ? "bg-gradient-to-r from-transparent via-sky-500 to-transparent"
                : isExtra
                  ? "bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
                  : "bg-gradient-to-r from-transparent via-amber-500 to-transparent";

              const discountTagBg = isEssential
                ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-0"
                : isExtra
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-0"
                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-0";

              const btnSuccess =
                "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-[#0B2A1C] dark:text-emerald-400";

              return (
                <article
                  key={selected.id}
                  className={`group relative flex flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-[#0A0A0A] dark:shadow-none ${cardHover}`}
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-[2px] w-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${topGlow}`}
                  />

                  <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                    {selected.imageUrl ? (
                      <Image
                        src={selected.imageUrl}
                        alt={selected.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400 dark:from-zinc-900 dark:to-zinc-800 dark:text-zinc-500">
                        <Crown className="h-10 w-10 opacity-30" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-80" />

                    <div className="absolute left-4 top-4 flex items-center gap-2">
                      <div className="rounded-full bg-black/50 px-3 py-1.5 text-[12px] font-semibold tracking-wide text-zinc-200 backdrop-blur-md">
                        PS Plus • {durationMonths} ay
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-2 text-lg font-bold leading-tight text-zinc-950 dark:text-white">
                      {selected.title}
                    </h3>

                    <div className="mt-4 flex items-end gap-3">
                      <p className="text-[2rem] font-bold leading-none tracking-tighter text-zinc-950 dark:text-white">
                        {(selected.priceAznCents / 100).toFixed(2)} AZN
                      </p>
                    </div>

                    {hasDiscount ? (
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-base font-medium text-zinc-500 line-through decoration-zinc-400 decoration-1 dark:decoration-zinc-600">
                          {(originalPriceCents / 100).toFixed(2)} AZN
                        </p>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${discountTagBg}`}>
                          -{discountPercent}%
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 h-[24px]" />
                    )}

                    <InstallmentHint priceAzn={selected.priceAznCents / 100} className="mt-2" />

                    <div className="mt-2">
                      <ReferralBadge category="psPlus" productName={selected.title} />
                    </div>

                    <div className="mt-6 flex flex-1 flex-col justify-end">
                      <button
                        type="button"
                        onClick={() => addToCart(selected)}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                          inCart || addedId === selected.id
                            ? btnSuccess
                            : "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white/10 dark:hover:bg-white/20"
                        }`}
                      >
                        {inCart || addedId === selected.id ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Səbətə əlavə edildi
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Səbətə əlavə et
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white/70 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/20">
          Bu tier üçün aktiv paket yoxdur.
        </div>
      )}
    </div>
  );
}
