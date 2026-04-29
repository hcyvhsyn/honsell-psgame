import Image from "next/image";
import Link from "next/link";
import {
  Wallet,
  Gamepad2,
  Share2,
  Receipt,
  ArrowRight,
  Plus,
  Trophy,
  Sparkles,
  TrendingUp,
  Crown,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getLoyaltyTier } from "@/lib/loyalty";
import ReferralCodeCopy from "@/components/ReferralCodeCopy";

export const dynamic = "force-dynamic";

const NEXT_REFERRAL_MILESTONE = 10;
const NEXT_PSN_TARGET = 3;

export default async function ProfileOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [
    accountCount,
    orderCount,
    refereeCount,
    commissionCents,
    totalSpentCents,
    recentOrders,
  ] = await Promise.all([
    prisma.psnAccount.count({ where: { userId: user.id } }),
    prisma.transaction.count({
      where: { userId: user.id, type: "PURCHASE" },
    }),
    prisma.user.count({ where: { referredById: user.id } }),
    prisma.transaction
      .aggregate({
        where: { beneficiaryId: user.id, type: "COMMISSION" },
        _sum: { amountAznCents: true },
      })
      .then((a) => a._sum.amountAznCents ?? 0),
    prisma.transaction
      .aggregate({
        where: { userId: user.id, type: "PURCHASE" },
        _sum: { amountAznCents: true },
      })
      .then((a) => Math.abs(a._sum.amountAznCents ?? 0)),
    prisma.transaction.findMany({
      where: { userId: user.id, type: "PURCHASE" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        game: { select: { title: true, imageUrl: true } },
      },
    }),
  ]);

  const walletAzn = user.walletBalance / 100;
  const commissionAzn = commissionCents / 100;
  const totalSpentAzn = totalSpentCents / 100;
  const loyalty = getLoyaltyTier(totalSpentAzn);
  const refereePct = Math.min(
    100,
    Math.round((refereeCount / NEXT_REFERRAL_MILESTONE) * 100)
  );
  const psnPct = Math.min(
    100,
    Math.round((accountCount / NEXT_PSN_TARGET) * 100)
  );
  const orderPct = Math.min(100, Math.round((orderCount / 10) * 100));

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("az-AZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-5">
      {/* ───── Hero: wallet + welcome ───── */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/70 via-zinc-900/60 to-zinc-950 p-6">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-10 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500/20 text-2xl font-bold text-indigo-200 ring-1 ring-indigo-400/40">
              {(user.name ?? user.email)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-indigo-300/80">
                Salam
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-white">
                {user.name ?? user.email.split("@")[0]}
              </h2>
              {memberSince && (
                <p className="mt-0.5 text-xs text-zinc-400">
                  Üzv olub: {memberSince}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <Wallet className="h-3 w-3" /> Cüzdan balansı
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-white">
                {walletAzn.toFixed(2)}
              </span>
              <span className="text-sm font-medium text-zinc-400">AZN</span>
            </p>
            <Link
              href="/profile/wallet"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
            >
              <Plus className="h-3.5 w-3.5" /> Balans yüklə
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Referral hero ───── */}
      <section className="relative overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 via-zinc-900/40 to-zinc-950 p-6">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300/80">
              <Share2 className="h-3 w-3" /> Referal kodun
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg border border-fuchsia-500/30 bg-zinc-950/60 px-4 py-2.5 font-mono text-2xl font-bold tracking-[0.35em] text-white">
                {user.referralCode}
              </span>
              <ReferralCodeCopy code={user.referralCode} />
            </div>
            <p className="text-xs text-zinc-400">
              Kodu paylaş — dostların qeydiyyatdan keçəndə hər ikiniz qazanır.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-col">
            <Stat
              label="Dəvət"
              value={refereeCount.toString()}
              icon={<Trophy className="h-3.5 w-3.5 text-fuchsia-300" />}
            />
            <Stat
              label="Qazanc"
              value={`${commissionAzn.toFixed(2)} AZN`}
              icon={<Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />}
            />
          </div>
        </div>

        <div className="relative mt-5">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Növbəti hədəfə qədər:{" "}
              <span className="font-semibold text-zinc-200">
                {Math.max(0, NEXT_REFERRAL_MILESTONE - refereeCount)} dəvət
              </span>
            </span>
            <span className="tabular-nums text-fuchsia-300">
              {refereeCount}/{NEXT_REFERRAL_MILESTONE}
            </span>
          </div>
          <ProgressBar value={refereePct} from="from-fuchsia-500" to="to-pink-400" />
        </div>
      </section>

      {/* ───── Loyalty tier ───── */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-zinc-900/40 to-zinc-950 p-6">
        <div className="absolute -right-16 -top-12 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/40">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
                Loyalty səviyyə
              </p>
              <h3 className="text-xl font-semibold tracking-tight text-white">
                {loyalty.label}
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {loyalty.cashbackPct > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/30">
                    Hər alışdan {loyalty.cashbackPct}% cashback
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400 ring-1 ring-zinc-700/60">
                    Bronze {loyalty.toNextAzn?.toFixed(0) ?? "?"} AZN sonra açılır
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4">
            <div className="mb-2 flex items-baseline justify-between text-xs">
              <span className="text-zinc-400">
                Ümumi xərc:{" "}
                <span className="font-semibold tabular-nums text-zinc-200">
                  {totalSpentAzn.toFixed(2)} AZN
                </span>
              </span>
              {loyalty.nextCashbackPct != null ? (
                <span className="text-amber-300">
                  Növbəti: {loyalty.nextLabel} · {loyalty.nextCashbackPct}% cashback
                </span>
              ) : (
                <span className="text-amber-300">Maksimum səviyyə!</span>
              )}
            </div>
            <ProgressBar
              value={loyalty.progressPct}
              from="from-amber-500"
              to="to-orange-400"
            />
            {loyalty.toNextAzn != null && loyalty.toNextAzn > 0 && (
              <p className="mt-2 text-[11px] text-zinc-500">
                Növbəti səviyyəyə qədər{" "}
                <span className="font-semibold text-zinc-300">
                  {loyalty.toNextAzn.toFixed(2)} AZN
                </span>{" "}
                qaldı —{" "}
                <span className="font-semibold text-amber-300">
                  {loyalty.nextLabel} · {loyalty.nextCashbackPct}% cashback
                </span>{" "}
                səni gözləyir.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ───── Stats with bars ───── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Gamepad2 className="h-4 w-4 text-sky-300" />}
          label="PSN hesabları"
          value={accountCount.toString()}
          hint={
            accountCount === 0
              ? "Sifariş üçün ən azı bir hesab əlavə et"
              : `${NEXT_PSN_TARGET} hesab limiti`
          }
          progress={psnPct}
          progressFrom="from-sky-500"
          progressTo="to-cyan-400"
          href="/profile/accounts"
          ctaHighlight={accountCount === 0}
          ctaLabel={accountCount === 0 ? "Hesab əlavə et" : "İdarə et"}
        />
        <StatCard
          icon={<Receipt className="h-4 w-4 text-emerald-300" />}
          label="Sifarişlər"
          value={orderCount.toString()}
          hint={
            orderCount === 0
              ? "İlk alışını gözləyirik"
              : `${totalSpentAzn.toFixed(2)} AZN dəyərində`
          }
          progress={orderPct}
          progressFrom="from-emerald-500"
          progressTo="to-teal-400"
          href="/profile/orders"
          ctaLabel="Tarixçəyə bax"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-amber-300" />}
          label="Toplam xərc"
          value={`${totalSpentAzn.toFixed(0)} AZN`}
          hint={
            totalSpentAzn > 0
              ? "Səxavətli oyunçu — davam et!"
              : "Hələ alış yoxdur"
          }
          progress={Math.min(100, (totalSpentAzn / 200) * 100)}
          progressFrom="from-amber-500"
          progressTo="to-orange-400"
        />
      </section>

      {/* ───── Recent orders preview ───── */}
      {recentOrders.length > 0 && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold">Son sifarişlər</h3>
            </div>
            <Link
              href="/profile/orders"
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              Hamısı <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <ul className="divide-y divide-zinc-800">
            {recentOrders.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                  {o.game?.imageUrl ? (
                    <Image
                      src={o.game.imageUrl}
                      alt={o.game.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-zinc-600">
                      <Gamepad2 className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {o.game?.title ?? "Silinmiş məhsul"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(o.createdAt).toLocaleDateString("az-AZ")}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {(Math.abs(o.amountAznCents) / 100).toFixed(2)} AZN
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-base font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  progress,
  progressFrom,
  progressTo,
  href,
  ctaLabel,
  ctaHighlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  progress: number;
  progressFrom: string;
  progressTo: string;
  href?: string;
  ctaLabel?: string;
  ctaHighlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 transition ${
        ctaHighlight
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {icon} {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}

      <div className="mt-3">
        <ProgressBar value={progress} from={progressFrom} to={progressTo} />
      </div>

      {href && (
        <Link
          href={href}
          className={`mt-4 inline-flex items-center gap-1 text-xs font-medium transition ${
            ctaHighlight
              ? "text-amber-300 hover:text-amber-200"
              : "text-indigo-400 hover:text-indigo-300"
          }`}
        >
          {ctaLabel ?? "Aç"} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function ProgressBar({
  value,
  from,
  to,
}: {
  value: number;
  from: string;
  to: string;
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${from} ${to} transition-[width] duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
