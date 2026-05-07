import Link from "next/link";
import { Crown, Calendar, AlertTriangle, Wallet, Gamepad2, Tv, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fmtAzn } from "@/lib/format";
import { STREAMING_SERVICE_LABELS, addMonths } from "@/lib/streamingCart";
import AutoRenewToggle from "./AutoRenewToggle";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  ESSENTIAL: "Essential",
  EXTRA: "Extra",
  DELUXE: "Deluxe",
};

function fmtDateAz(d: Date): string {
  return new Date(d).toLocaleDateString("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(d: Date): number {
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function ProfileSubscriptionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [subscriptions, streamingPurchases] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      include: {
        serviceProduct: { select: { title: true } },
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
  ]);

  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  const past = subscriptions.filter((s) => s.status !== "ACTIVE");
  const walletAzn = user.walletBalance / 100;

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
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Aktiv abunəliklər</h1>
        <p className="mt-1 text-sm text-zinc-400">
          PlayStation və streaming abunəliklərin ayrı-ayrı bölmələrdə qruplaşdırılıb.
        </p>
      </div>

      <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-amber-400" />
            PlayStation abunəlikləri
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            PS Plus abunəliklərini buradan idarə et — bitiş tarixi və avtomatik yeniləmə.
          </p>
        </div>
        <Link
          href="/ps-plus"
          className="rounded-full bg-[#5a189a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7b2cbf]"
        >
          Yeni PS Plus al
        </Link>
      </header>

      {active.length === 0 ? (
        <div className="rounded-[24px] border border-white/5 bg-[#111116] p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30">
            <Crown className="h-7 w-7 text-amber-400" />
          </div>
          <p className="mt-4 text-base font-semibold text-white">
            Hələ aktiv abunəlik yoxdur
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            PS Plus alıb burada izlə.
          </p>
          <Link
            href="/ps-plus"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#5a189a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7b2cbf]"
          >
            PS Plus paketləri
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {active.map((s) => {
            const days = daysUntil(s.expiresAt);
            const expiringSoon = days <= 3;
            const lowBalance = user.walletBalance < s.priceAznCents;
            const showLowBalanceWarning =
              s.autoRenew && expiringSoon && lowBalance;

            return (
              <li
                key={s.id}
                className="overflow-hidden rounded-[24px] border border-white/5 bg-[#111116] shadow-xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
                        <Crown className="h-3.5 w-3.5" />
                        PS Plus {TIER_LABEL[s.tier] ?? s.tier}
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                        {s.durationMonths} ay
                      </span>
                      {expiringSoon && (
                        <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/40">
                          {days <= 0
                            ? "Bu gün bitir"
                            : days === 1
                              ? "Sabah bitir"
                              : `${days} gün qaldı`}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-white">
                      {s.serviceProduct.title}
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Calendar className="h-4 w-4 text-zinc-500" />
                        <span>
                          Bitir:{" "}
                          <span className="font-semibold text-white">
                            {fmtDateAz(s.expiresAt)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Wallet className="h-4 w-4 text-zinc-500" />
                        <span>
                          Yenilənmə qiyməti:{" "}
                          <span className="font-semibold text-white">
                            {fmtAzn(s.priceAznCents)}
                          </span>
                        </span>
                      </div>
                      {s.psnAccount && (
                        <div className="flex items-center gap-2 text-zinc-300 sm:col-span-2">
                          <Gamepad2 className="h-4 w-4 text-zinc-500" />
                          <span>
                            PSN:{" "}
                            <span className="font-semibold text-white">
                              {s.psnAccount.label}
                            </span>{" "}
                            <span className="text-xs text-zinc-500">
                              ({s.psnAccount.psnEmail})
                            </span>
                          </span>
                        </div>
                      )}
                    </dl>
                  </div>

                  <AutoRenewToggle subscriptionId={s.id} initial={s.autoRenew} />
                </div>

                {showLowBalanceWarning && (
                  <div className="flex flex-wrap items-start gap-3 border-t border-rose-500/20 bg-rose-500/5 px-5 py-3 sm:px-6">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                    <div className="flex-1 text-sm text-rose-100">
                      <p className="font-semibold">Balans kifayət etmir</p>
                      <p className="mt-1 text-xs text-rose-200/80">
                        Cari balans {fmtAzn(user.walletBalance)} — yenilənmə üçün{" "}
                        {fmtAzn(s.priceAznCents)} lazımdır. Balansı artır ki,
                        abunəlik avtomatik yenilənsin.
                      </p>
                    </div>
                    <Link
                      href="/profile/wallet"
                      className="rounded-full bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/40 transition hover:bg-rose-500/30"
                    >
                      Balansı artır
                    </Link>
                  </div>
                )}
                {s.autoRenew && !showLowBalanceWarning && (
                  <div className="border-t border-white/5 bg-emerald-500/5 px-5 py-2.5 text-xs text-emerald-200/80 sm:px-6">
                    Bitiş günü cüzdandan {fmtAzn(s.priceAznCents)} qopadılaraq
                    abunəlik {s.durationMonths} ay uzadılacaq.
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 && (
        <section className="overflow-hidden rounded-[24px] border border-white/5 bg-[#0F0F13]">
          <header className="border-b border-white/5 px-5 py-3">
            <h3 className="text-sm font-semibold text-zinc-300">
              Bitmiş PS Plus abunəlikləri
            </h3>
          </header>
          <ul className="divide-y divide-white/5">
            {past.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-zinc-200">
                    {s.serviceProduct.title}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {fmtDateAz(s.startsAt)} → {fmtDateAz(s.expiresAt)}
                  </div>
                </div>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400 ring-1 ring-zinc-700">
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      </section>

      <section className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Tv className="h-5 w-5 text-fuchsia-400" />
              Streaming abunəlikləri
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              HBO Max, Gain və YouTube Premium abunəlikləri. Bitiş tarixi sifariş tarixindən hesablanır.
            </p>
          </div>
          <Link
            href="/streaming"
            className="rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500"
          >
            Yeni streaming al
          </Link>
        </header>

        {activeStreaming.length === 0 ? (
          <div className="rounded-[24px] border border-white/5 bg-[#111116] p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30">
              <Tv className="h-7 w-7 text-fuchsia-300" />
            </div>
            <p className="mt-4 text-base font-semibold text-white">Hələ aktiv streaming abunəliyi yoxdur</p>
            <p className="mt-1 text-sm text-zinc-400">HBO Max, Gain və ya YouTube Premium alıb burada izlə.</p>
            <Link
              href="/streaming"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-500"
            >
              Streaming paketləri
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {activeStreaming.map((s) => {
              const days = daysUntil(s.expiresAt);
              const expiringSoon = days <= 3;
              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-[24px] border border-white/5 bg-[#111116] shadow-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-semibold text-fuchsia-200 ring-1 ring-fuchsia-500/40">
                          <Tv className="h-3.5 w-3.5" />
                          {s.serviceLabel}
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                          {s.durationMonths} ay
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                          <Users className="h-3 w-3" />
                          {s.seats} nəfərlik
                        </span>
                        {expiringSoon && (
                          <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/40">
                            {days <= 0
                              ? "Bu gün bitir"
                              : days === 1
                                ? "Sabah bitir"
                                : `${days} gün qaldı`}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-white">{s.title}</h3>
                      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Calendar className="h-4 w-4 text-zinc-500" />
                          <span>
                            Başlanğıc:{" "}
                            <span className="font-semibold text-white">{fmtDateAz(s.startsAt)}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Calendar className="h-4 w-4 text-zinc-500" />
                          <span>
                            Bitir:{" "}
                            <span className="font-semibold text-white">{fmtDateAz(s.expiresAt)}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Wallet className="h-4 w-4 text-zinc-500" />
                          <span>
                            Ödəniş:{" "}
                            <span className="font-semibold text-white">{fmtAzn(s.priceAznCents)}</span>
                          </span>
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div className="border-t border-white/5 bg-fuchsia-500/5 px-5 py-2.5 text-xs text-fuchsia-200/80 sm:px-6">
                    Streaming abunəlikləri avtomatik yenilənmir — bitdikdə yeni paket almaq lazımdır.
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pastStreaming.length > 0 && (
          <section className="overflow-hidden rounded-[24px] border border-white/5 bg-[#0F0F13]">
            <header className="border-b border-white/5 px-5 py-3">
              <h3 className="text-sm font-semibold text-zinc-300">Bitmiş streaming abunəlikləri</h3>
            </header>
            <ul className="divide-y divide-white/5">
              {pastStreaming.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-200">
                      {s.serviceLabel} · {s.title}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {fmtDateAz(s.startsAt)} → {fmtDateAz(s.expiresAt)}
                    </div>
                  </div>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400 ring-1 ring-zinc-700">
                    EXPIRED
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      <p className="text-xs text-zinc-500">
        Cari cüzdan balansı:{" "}
        <span className="font-semibold text-zinc-300">{fmtAzn(user.walletBalance)}</span>{" "}
        ({walletAzn.toFixed(2)} AZN).
      </p>
    </div>
  );
}
