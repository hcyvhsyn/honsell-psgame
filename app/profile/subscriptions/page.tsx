import Link from "next/link";
import { Crown, Calendar, AlertTriangle, Wallet, Gamepad2, Tv, Users, Brain } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fmtAzn } from "@/lib/format";
import { STREAMING_SERVICE_LABELS, addMonths } from "@/lib/streamingCart";
import { backfillPlatformSubscriptionsForUser } from "@/lib/subscriptions";
import { readPlatformMeta } from "@/lib/platformSubscriptions";
import AutoRenewToggle from "./AutoRenewToggle";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  ESSENTIAL: "Essential",
  EXTRA: "Extra",
  DELUXE: "Deluxe",
};

function fmtDateAz(d: Date): string {
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
}

function daysUntil(d: Date): number {
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function ProfileSubscriptionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Backfill missing Subscription rows for legacy AI/PLATFORM purchases so that
  // auto-renew toggle is available on still-active old subscriptions.
  await backfillPlatformSubscriptionsForUser(user.id);

  const [subscriptions, streamingPurchases, aiPurchases] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      include: {
        serviceProduct: { select: { title: true, type: true, metadata: true } },
        psnAccount: { select: { label: true, psnEmail: true, psModel: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: "SERVICE_PURCHASE",
        status: "SUCCESS",
        serviceProduct: { type: "STREAMING" },
      },
      orderBy: { createdAt: "desc" },
      include: {
        serviceProduct: { select: { id: true, title: true, metadata: true, type: true } },
      },
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: "SERVICE_PURCHASE",
        status: "SUCCESS",
        serviceProduct: { type: "PLATFORM" },
      },
      orderBy: { createdAt: "desc" },
      include: {
        serviceProduct: { select: { id: true, title: true, metadata: true, type: true } },
      },
    }),
  ]);

  const psPlusSubs = subscriptions.filter(
    (s) => s.serviceProduct.type === "PS_PLUS" || s.serviceProduct.type === "EA_PLAY"
  );
  const aiSubs = subscriptions.filter(
    (s) => s.serviceProduct.type === "PLATFORM" && s.tier === "AI"
  );
  const active = psPlusSubs.filter((s) => s.status === "ACTIVE");
  const past = psPlusSubs.filter((s) => s.status !== "ACTIVE");
  const activeAi = aiSubs.filter((s) => s.status === "ACTIVE");
  const pastAi = aiSubs.filter((s) => s.status !== "ACTIVE");
  const aiSubTxIds = new Set(aiSubs.map((s) => s.lastRenewalTxId).filter((v): v is string => !!v));

  // Legacy AI Transactions that never made it into a Subscription row (already
  // expired purchases — backfill only creates rows for still-active ones).
  type LegacyAi = {
    id: string;
    title: string;
    durationMonths: number;
    startsAt: Date;
    expiresAt: Date;
    priceAznCents: number;
  };
  const legacyAi: LegacyAi[] = aiPurchases
    .filter((p) => {
      const m = (p.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
      return String(m.category ?? "") === "AI" && !aiSubTxIds.has(p.id);
    })
    .map((p) => {
      const meta = readPlatformMeta(p.serviceProduct?.metadata as Record<string, unknown> | null);
      const months = meta.durationMonths ?? 0;
      const startsAt = p.createdAt;
      const expiresAt = months > 0 ? addMonths(startsAt, months) : startsAt;
      return {
        id: p.id,
        title: p.serviceProduct?.title ?? "AI abunəlik",
        durationMonths: months,
        startsAt,
        expiresAt,
        priceAznCents: Math.abs(p.amountAznCents),
      };
    });

  type StreamingSub = {
    id: string;
    title: string;
    serviceKey: string;
    serviceLabel: string;
    durationMonths: number;
    seats: number;
    startsAt: Date;
    expiresAt: Date;
    priceAznCents: number;
    isActive: boolean;
  };
  const now = new Date();
  const streamingSubs: StreamingSub[] = streamingPurchases.map((p) => {
    const m = (p.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
    const serviceKey = String(m.service ?? "");
    const months = Number(m.durationMonths ?? 0);
    const startsAt = p.createdAt;
    const expiresAt = months > 0 ? addMonths(startsAt, months) : startsAt;
    return {
      id: p.id,
      title: p.serviceProduct?.title ?? "Streaming",
      serviceKey,
      serviceLabel: STREAMING_SERVICE_LABELS[serviceKey] ?? serviceKey,
      durationMonths: months,
      seats: Number(m.seats ?? 1),
      startsAt,
      expiresAt,
      priceAznCents: Math.abs(p.amountAznCents),
      isActive: expiresAt.getTime() > now.getTime(),
    };
  });
  const activeStreaming = streamingSubs.filter((s) => s.isActive);
  const pastStreaming = streamingSubs.filter((s) => !s.isActive);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-white">Aktiv abunəliklər</h1>
        <span className="text-xs text-zinc-500">
          Cüzdan: <span className="font-semibold text-zinc-300">{fmtAzn(user.walletBalance)}</span>
        </span>
      </div>

      <section className="space-y-3">
        <SubHeader
          icon={<Gamepad2 className="h-4 w-4 text-amber-400" />}
          title="PlayStation"
          ctaHref="/ps-plus"
          ctaLabel="Yeni PS Plus"
          ctaClass="bg-[#5a189a] hover:bg-[#7b2cbf]"
        />

        {active.length === 0 ? (
          <EmptyRow
            icon={<Crown className="h-4 w-4 text-amber-400" />}
            iconClass="bg-amber-500/10 ring-amber-500/30"
            text="Hələ aktiv PS Plus abunəliyin yoxdur."
            ctaHref="/ps-plus"
            ctaLabel="Paketlər"
            ctaClass="bg-[#5a189a] hover:bg-[#7b2cbf]"
          />
        ) : (
          <ul className="space-y-3">
            {active.map((s) => {
              const days = daysUntil(s.expiresAt);
              const expiringSoon = days <= 3;
              const lowBalance = user.walletBalance < s.priceAznCents;
              const showLowBalanceWarning =
                s.autoRenew && expiringSoon && lowBalance;

              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-2xl border border-white/5 bg-[#111116]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
                          <Crown className="h-3.5 w-3.5" />
                          {s.serviceProduct.type === "EA_PLAY"
                            ? "EA Play"
                            : `PS Plus ${TIER_LABEL[s.tier] ?? s.tier}`}
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                          {s.durationMonths} ay
                        </span>
                        {expiringSoon && (
                          <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/40">
                            {days <= 0
                              ? "Bu gün bitir"
                              : days === 1
                                ? "Sabah bitir"
                                : `${days} gün qaldı`}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 truncate text-base font-bold text-white">
                        {s.serviceProduct.title}
                      </h3>
                      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-400">
                        <Meta icon={<Calendar className="h-3.5 w-3.5" />} label="Bitir" value={fmtDateAz(s.expiresAt)} />
                        <Meta icon={<Wallet className="h-3.5 w-3.5" />} label="Yenilənmə" value={fmtAzn(s.priceAznCents)} />
                        {s.psnAccount && (
                          <Meta icon={<Gamepad2 className="h-3.5 w-3.5" />} label="PSN" value={`${s.psnAccount.label} (${s.psnAccount.psnEmail})`} />
                        )}
                      </dl>
                    </div>

                    <AutoRenewToggle subscriptionId={s.id} initial={s.autoRenew} />
                  </div>

                  {showLowBalanceWarning && (
                    <LowBalanceNote
                      walletCents={user.walletBalance}
                      priceCents={s.priceAznCents}
                    />
                  )}
                  {s.autoRenew && !showLowBalanceWarning && (
                    <RenewNote priceCents={s.priceAznCents} months={s.durationMonths} />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {past.length > 0 && (
          <PastList title="Bitmiş PS Plus abunəlikləri">
            {past.map((s) => (
              <PastRow
                key={s.id}
                title={s.serviceProduct.title}
                range={`${fmtDateAz(s.startsAt)} → ${fmtDateAz(s.expiresAt)}`}
                status={s.status}
              />
            ))}
          </PastList>
        )}
      </section>

      <section className="space-y-3">
        <SubHeader
          icon={<Tv className="h-4 w-4 text-fuchsia-400" />}
          title="Streaming"
          ctaHref="/streaming"
          ctaLabel="Yeni streaming"
          ctaClass="bg-fuchsia-600 hover:bg-fuchsia-500"
        />

        {activeStreaming.length === 0 ? (
          <EmptyRow
            icon={<Tv className="h-4 w-4 text-fuchsia-300" />}
            iconClass="bg-fuchsia-500/10 ring-fuchsia-500/30"
            text="Hələ aktiv streaming abunəliyin yoxdur."
            ctaHref="/streaming"
            ctaLabel="Paketlər"
            ctaClass="bg-fuchsia-600 hover:bg-fuchsia-500"
          />
        ) : (
          <ul className="space-y-3">
            {activeStreaming.map((s) => {
              const days = daysUntil(s.expiresAt);
              const expiringSoon = days <= 3;
              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-2xl border border-white/5 bg-[#111116]"
                >
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/15 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-500/40">
                        <Tv className="h-3.5 w-3.5" />
                        {s.serviceLabel}
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                        {s.durationMonths} ay
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                        <Users className="h-3 w-3" />
                        {s.seats} nəfərlik
                      </span>
                      {expiringSoon && (
                        <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/40">
                          {days <= 0
                            ? "Bu gün bitir"
                            : days === 1
                              ? "Sabah bitir"
                              : `${days} gün qaldı`}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 truncate text-base font-bold text-white">{s.title}</h3>
                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-400">
                      <Meta icon={<Calendar className="h-3.5 w-3.5" />} label="Başlanğıc" value={fmtDateAz(s.startsAt)} />
                      <Meta icon={<Calendar className="h-3.5 w-3.5" />} label="Bitir" value={fmtDateAz(s.expiresAt)} />
                      <Meta icon={<Wallet className="h-3.5 w-3.5" />} label="Ödəniş" value={fmtAzn(s.priceAznCents)} />
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pastStreaming.length > 0 && (
          <PastList title="Bitmiş streaming abunəlikləri">
            {pastStreaming.map((s) => (
              <PastRow
                key={s.id}
                title={`${s.serviceLabel} · ${s.title}`}
                range={`${fmtDateAz(s.startsAt)} → ${fmtDateAz(s.expiresAt)}`}
                status="EXPIRED"
              />
            ))}
          </PastList>
        )}
      </section>

      <section className="space-y-3">
        <SubHeader
          icon={<Brain className="h-4 w-4 text-fuchsia-300" />}
          title="Süni intellekt"
          ctaHref="/ai"
          ctaLabel="Yeni AI"
          ctaClass="bg-fuchsia-600 hover:bg-fuchsia-500"
        />

        {activeAi.length === 0 && legacyAi.length === 0 ? (
          <EmptyRow
            icon={<Brain className="h-4 w-4 text-fuchsia-300" />}
            iconClass="bg-fuchsia-500/10 ring-fuchsia-500/30"
            text="Hələ aktiv AI abunəliyin yoxdur."
            ctaHref="/ai"
            ctaLabel="Paketlər"
            ctaClass="bg-fuchsia-600 hover:bg-fuchsia-500"
          />
        ) : (
          <ul className="space-y-3">
            {activeAi.map((s) => {
              const days = daysUntil(s.expiresAt);
              const expiringSoon = days <= 3;
              const lowBalance = user.walletBalance < s.priceAznCents;
              const showLowBalanceWarning = s.autoRenew && expiringSoon && lowBalance;

              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-2xl border border-white/5 bg-[#111116]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/15 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-500/40">
                          <Brain className="h-3.5 w-3.5" />
                          AI abunəlik
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                          {s.durationMonths} ay
                        </span>
                        {expiringSoon && (
                          <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/40">
                            {days <= 0
                              ? "Bu gün bitir"
                              : days === 1
                                ? "Sabah bitir"
                                : `${days} gün qaldı`}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 truncate text-base font-bold text-white">
                        {s.serviceProduct.title}
                      </h3>
                      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-400">
                        <Meta icon={<Calendar className="h-3.5 w-3.5" />} label="Bitir" value={fmtDateAz(s.expiresAt)} />
                        <Meta icon={<Wallet className="h-3.5 w-3.5" />} label="Yenilənmə" value={fmtAzn(s.priceAznCents)} />
                      </dl>
                    </div>

                    <AutoRenewToggle subscriptionId={s.id} initial={s.autoRenew} />
                  </div>

                  {showLowBalanceWarning && (
                    <LowBalanceNote
                      walletCents={user.walletBalance}
                      priceCents={s.priceAznCents}
                    />
                  )}
                  {s.autoRenew && !showLowBalanceWarning && (
                    <RenewNote priceCents={s.priceAznCents} months={s.durationMonths} />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {(pastAi.length > 0 || legacyAi.length > 0) && (
          <PastList title="Bitmiş AI abunəlikləri">
            {pastAi.map((s) => (
              <PastRow
                key={s.id}
                title={s.serviceProduct.title}
                range={`${fmtDateAz(s.startsAt)} → ${fmtDateAz(s.expiresAt)}`}
                status={s.status}
              />
            ))}
            {legacyAi.map((l) => (
              <PastRow
                key={l.id}
                title={l.title}
                range={`${fmtDateAz(l.startsAt)} → ${fmtDateAz(l.expiresAt)}`}
                status="EXPIRED"
              />
            ))}
          </PastList>
        )}
      </section>
    </div>
  );
}

function SubHeader({
  icon,
  title,
  ctaHref,
  ctaLabel,
  ctaClass,
}: {
  icon: React.ReactNode;
  title: string;
  ctaHref: string;
  ctaLabel: string;
  ctaClass: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
        {icon}
        {title}
      </h2>
      <Link
        href={ctaHref}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white transition ${ctaClass}`}
      >
        {ctaLabel}
      </Link>
    </header>
  );
}

function EmptyRow({
  icon,
  iconClass,
  text,
  ctaHref,
  ctaLabel,
  ctaClass,
}: {
  icon: React.ReactNode;
  iconClass: string;
  text: string;
  ctaHref: string;
  ctaLabel: string;
  ctaClass: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#111116] px-4 py-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ${iconClass}`}>
        {icon}
      </span>
      <p className="flex-1 text-sm text-zinc-400">{text}</p>
      <Link
        href={ctaHref}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition ${ctaClass}`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-500">{icon}</span>
      <span>
        {label}: <span className="font-semibold text-white">{value}</span>
      </span>
    </div>
  );
}

function LowBalanceNote({
  walletCents,
  priceCents,
}: {
  walletCents: number;
  priceCents: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-xs text-rose-100">
      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
      <span className="flex-1">
        Balans kifayət etmir — yenilənmə üçün {fmtAzn(priceCents)} lazımdır (cari{" "}
        {fmtAzn(walletCents)}).
      </span>
      <Link
        href="/profile/wallet"
        className="shrink-0 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/40 transition hover:bg-rose-500/30"
      >
        Balansı artır
      </Link>
    </div>
  );
}

function RenewNote({ priceCents, months }: { priceCents: number; months: number }) {
  return (
    <div className="border-t border-white/5 bg-emerald-500/5 px-4 py-2 text-xs text-emerald-200/80">
      Bitiş günü cüzdandan {fmtAzn(priceCents)} tutularaq {months} ay uzadılacaq.
    </div>
  );
}

function PastList({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-[#0F0F13]">
      <header className="border-b border-white/5 px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
      </header>
      <ul className="max-h-[220px] divide-y divide-white/5 overflow-y-auto">{children}</ul>
    </section>
  );
}

function PastRow({
  title,
  range,
  status,
}: {
  title: string;
  range: string;
  status: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium text-zinc-300">{title}</div>
        <div className="text-[11px] text-zinc-500">{range}</div>
      </div>
      <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400 ring-1 ring-zinc-700">
        {status}
      </span>
    </li>
  );
}
