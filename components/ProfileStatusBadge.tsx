"use client";

import { useState } from "react";
import { Crown, Lock, Check, Sparkles, ChevronRight, Info } from "lucide-react";
import Modal from "./Modal";

/** Modaldakı bütün tier-lərin sadə görünüş formatı (DB CustomerTier-dən). */
export type StatusTierInfo = {
  name: string;
  displayName: string;
  icon: string | null;
  color: string | null;
  cashbackPct: number;
  kind: "AUTO" | "MANUAL";
  minSpendCents: number;
};

/** Cari effektiv tier + xərc nərdivanı üzrə irəliləyiş. */
export type StatusTierView = {
  name: string;
  displayName: string;
  icon: string | null;
  color: string | null;
  cashbackPct: number;
  isManual: boolean;
  spentAzn: number;
  toNextAzn: number | null;
  nextName: string | null;
  nextCashbackPct: number | null;
  progressPct: number;
};

function TierIcon({ icon, color }: { icon: string | null; color: string | null }) {
  const [ok, setOk] = useState(true);
  if (icon && ok) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={`/tiers/${icon}.svg`}
        alt=""
        width={18}
        height={18}
        className="h-[18px] w-[18px]"
        onError={() => setOk(false)}
      />
    );
  }
  return <Crown className="h-4 w-4" style={color ? { color } : undefined} />;
}

export default function ProfileStatusBadge({
  tier,
  allTiers,
}: {
  tier: StatusTierView;
  allTiers: StatusTierInfo[];
}) {
  const [open, setOpen] = useState(false);
  const color = tier.color ?? "#a855f7";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Status səviyyələrinə bax"
        className="group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition active:scale-95"
        style={{
          borderColor: `${color}55`,
          color,
          backgroundColor: `${color}14`,
        }}
      >
        <span className="grid h-4 w-4 place-items-center">
          <TierIcon icon={tier.icon} color={color} />
        </span>
        <span className="tracking-wide">{tier.name}</span>
        {tier.cashbackPct > 0 && (
          <span className="rounded-md bg-black/10 px-1.5 py-px text-[10px] font-bold tracking-wide dark:bg-white/10">
            {tier.cashbackPct}% cashback
          </span>
        )}
        <ChevronRight className="h-3 w-3 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="lg">
        <StatusInfo tier={tier} allTiers={allTiers} />
      </Modal>
    </>
  );
}

function StatusInfo({
  tier,
  allTiers,
}: {
  tier: StatusTierView;
  allTiers: StatusTierInfo[];
}) {
  const color = tier.color ?? "#a855f7";
  const autoLadder = allTiers
    .filter((t) => t.kind === "AUTO")
    .sort((a, b) => a.minSpendCents - b.minSpendCents);
  const spentCents = Math.max(0, Math.round(tier.spentAzn * 100));

  return (
    <div className="p-6 sm:p-7 text-zinc-900 dark:text-zinc-100">
      <header className="mb-5 flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1"
          style={{ backgroundColor: `${color}1f`, color, borderColor: `${color}44` }}
        >
          <TierIcon icon={tier.icon} color={color} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-tight">Status səviyyələri</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Alış-verişlərinlə status qazanırsan. Səviyyən yüksəldikcə hər alışdan
            daha çox cashback əldə edirsən. Cari statusun:{" "}
            <span className="font-semibold text-zinc-900 dark:text-white">
              {tier.displayName || tier.name}
            </span>
            {tier.cashbackPct > 0 && (
              <span className="text-zinc-500">
                {" "}
                · {tier.cashbackPct}% cashback
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Növbəti səviyyəyə irəliləyiş — yalnız avtomatik statuslarda. */}
      {!tier.isManual && tier.nextName && tier.toNextAzn !== null && (
        <div className="mb-5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              Növbəti səviyyə: {tier.nextName}
              {tier.nextCashbackPct !== null && (
                <span className="text-zinc-400"> ({tier.nextCashbackPct}% cashback)</span>
              )}
            </span>
            <span className="tabular-nums font-bold text-zinc-500 dark:text-zinc-400">
              {tier.toNextAzn.toLocaleString("en-US")} ₼ qaldı
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${tier.progressPct}%`,
                background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              }}
            />
          </div>
        </div>
      )}

      <ol className="space-y-2.5">
        {autoLadder.map((def) => {
          const unlocked = spentCents >= def.minSpendCents;
          const current =
            !tier.isManual && def.name === tier.name;
          const remaining = unlocked
            ? 0
            : Math.max(0, def.minSpendCents - spentCents) / 100;
          return (
            <TierRow
              key={def.name}
              def={def}
              current={current}
              unlocked={unlocked}
              remaining={remaining}
            />
          );
        })}
      </ol>

      <p className="mt-5 flex items-start justify-center gap-1.5 text-center text-[11px] text-zinc-500">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        Statuslar ümumi xərcinə görə avtomatik yenilənir. Cashback alış tamamlandıqdan
        sonra cashback balansına köçürülür.
      </p>
    </div>
  );
}

function TierRow({
  def,
  current,
  unlocked,
  remaining,
}: {
  def: StatusTierInfo;
  current: boolean;
  unlocked: boolean;
  remaining: number;
}) {
  const color = def.color ?? "#a855f7";
  return (
    <li
      className={`relative overflow-hidden rounded-2xl border p-4 transition ${
        current
          ? "ring-1 ring-inset ring-white/10"
          : unlocked
            ? "border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03]"
            : "border-zinc-200/70 bg-zinc-50/40 dark:border-white/5 dark:bg-white/[0.015]"
      }`}
      style={
        current
          ? { borderColor: `${color}66`, backgroundColor: `${color}12` }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1"
          style={
            unlocked
              ? { backgroundColor: `${color}1f`, color, borderColor: `${color}44` }
              : undefined
          }
        >
          {unlocked ? (
            <TierIcon icon={def.icon} color={color} />
          ) : (
            <Lock className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-base font-bold ${
                unlocked ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {def.displayName || def.name}
            </h3>
            {current && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: color }}
              >
                <Sparkles className="h-3 w-3" /> Cari
              </span>
            )}
            <span className="text-xs text-zinc-500">
              {def.minSpendCents === 0
                ? "Başlanğıc səviyyə"
                : `${(def.minSpendCents / 100).toLocaleString("en-US")} ₼ xərcdən sonra`}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {def.cashbackPct > 0 ? (
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1"
                style={{ backgroundColor: `${color}1f`, color, borderColor: `${color}44` }}
              >
                <Check className="h-3 w-3" />
                {def.cashbackPct}% cashback
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:ring-white/10">
                Cashback yoxdur
              </span>
            )}
            {!unlocked && remaining > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
                <Lock className="h-3 w-3" />
                {remaining.toLocaleString("en-US")} ₼ qaldı
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
