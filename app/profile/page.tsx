import Image from "next/image";
import Link from "next/link";
import {
  Wallet,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Plus,
  ShoppingBag,
  Heart,
  Crown,
  Users,
  BadgeCheck,
  Share2,
  TrendingUp,
  CreditCard,
  Tv,
  CalendarDays,
  CircleDollarSign,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type ActivityKind = "PURCHASE" | "SERVICE_PURCHASE" | "DEPOSIT" | "COMMISSION";

type ActivityRow = {
  id: string;
  type: ActivityKind | string;
  status: string;
  createdAt: Date;
  amountAznCents: number;
  game: { title: string; imageUrl: string | null } | null;
  serviceProduct: { title: string } | null;
};

const STATUS_LABEL_AZ: Record<string, string> = {
  SUCCESS: "Tamamlandı",
  PENDING: "Gözləyir",
  FAILED: "Uğursuz",
};

const MONTH_LABELS_AZ = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "İyn",
  "İyl",
  "Avq",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
];

export default async function ProfileOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let orderCount = 0;
  let favoritesCount = 0;
  let activeSubscriptionsCount = 0;
  let refereeCount = 0;
  let totalSavingsCents = 0;
  let recentActivity: ActivityRow[] = [];
  let savingsByMonth: { label: string; valueAzn: number }[] = [];

  try {
    const now = new Date();
    const sixMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 5,
      1,
    );

    const [
      _orderCount,
      _favoritesCount,
      _activeSubsCount,
      _refereeCount,
      _savingsAgg,
      _recent,
      _savingsRows,
    ] = await Promise.all([
      prisma.transaction.count({
        where: {
          userId: user.id,
          type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        },
      }),
      prisma.favorite.count({ where: { userId: user.id } }).catch(() => 0),
      prisma.subscription
        .count({
          where: {
            userId: user.id,
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
          },
        })
        .catch(() => 0),
      prisma.user.count({ where: { referredById: user.id } }),
      prisma.transaction
        .aggregate({
          where: {
            userId: user.id,
            type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
            status: { in: ["SUCCESS", "PENDING"] },
          },
          _sum: { savingsAznCents: true },
        })
        .then((a) => a._sum.savingsAznCents ?? 0)
        .catch(() => 0),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          game: { select: { title: true, imageUrl: true } },
          serviceProduct: { select: { title: true } },
        },
      }),
      prisma.transaction
        .findMany({
          where: {
            userId: user.id,
            type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
            status: { in: ["SUCCESS", "PENDING"] },
            createdAt: { gte: sixMonthsAgo },
          },
          select: { createdAt: true, savingsAznCents: true },
        })
        .catch(() => []),
    ]);

    orderCount = _orderCount;
    favoritesCount = _favoritesCount;
    activeSubscriptionsCount = _activeSubsCount;
    refereeCount = _refereeCount;
    totalSavingsCents = _savingsAgg;
    recentActivity = _recent;

    const buckets: { label: string; valueAzn: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ label: MONTH_LABELS_AZ[d.getMonth()], valueAzn: 0 });
    }
    for (const row of _savingsRows) {
      const d = new Date(row.createdAt);
      const idx =
        (d.getFullYear() - now.getFullYear()) * 12 +
        (d.getMonth() - now.getMonth()) +
        5;
      if (idx >= 0 && idx < 6) {
        buckets[idx].valueAzn += (row.savingsAznCents ?? 0) / 100;
      }
    }
    savingsByMonth = buckets;
  } catch {
    savingsByMonth = MONTH_LABELS_AZ.slice(0, 6).map((label) => ({
      label,
      valueAzn: 0,
    }));
  }

  const walletAzn = user.walletBalance / 100;
  const cashbackAzn = (user.cashbackBalanceCents ?? 0) / 100;
  const totalSavingsAzn = totalSavingsCents / 100;
  const maxMonthlySavings = Math.max(1, ...savingsByMonth.map((b) => b.valueAzn));
  const latestMonthSavings = savingsByMonth[savingsByMonth.length - 1]?.valueAzn ?? 0;

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("az-AZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const initial = (user.name ?? user.email)[0]?.toUpperCase() ?? "?";
  const displayName = user.name ?? user.email.split("@")[0];

  return (
    <div className="space-y-3">
      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <WelcomeCard
          displayName={displayName}
          initial={initial}
          memberSince={memberSince}
          orderCount={orderCount}
        />

        <BalanceCard
          icon={<Wallet className="h-4 w-4" />}
          label="Cüzdan balansı"
          value={walletAzn}
          subtitle="Hesabındakı cari vəsait"
          accent="purple"
          href="/profile/wallet"
          cta={
            <Link
              href="/profile/wallet"
              className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-violet-600 via-purple-600 to-violet-800 px-4 text-xs font-bold text-white shadow-[0_14px_34px_-20px_rgba(124,58,237,0.95)] transition hover:from-violet-500 hover:via-purple-500 hover:to-violet-700"
            >
              <Plus className="h-3.5 w-3.5" /> Balans yüklə
            </Link>
          }
        />

        <BalanceCard
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="Cashback balansı"
          value={cashbackAzn}
          subtitle="Alış-verişlərdən qazandığın cashback"
          accent="amber"
          href="/profile/wallet"
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_0.9fr]">
        <SavingsCard
          latestMonthSavings={latestMonthSavings}
          maxMonthlySavings={maxMonthlySavings}
          savingsByMonth={savingsByMonth}
          totalSavingsAzn={totalSavingsAzn}
        />

        <ReferralHero refereeCount={refereeCount} />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[14px] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[linear-gradient(145deg,rgba(21,20,39,0.96),rgba(9,10,21,0.98))] shadow-[0_24px_64px_-50px_rgba(124,58,237,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[0_24px_64px_-50px_rgba(124,58,237,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <header className="flex items-center justify-between px-5 pb-2 pt-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Son fəaliyyətlər
            </h3>
            <Link
              href="/profile/orders"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 dark:text-violet-300 transition hover:text-violet-900 dark:hover:text-violet-200"
            >
              Hamısı <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </header>
          <ul className="mx-5 divide-y divide-zinc-200 dark:divide-white/5 border-t border-zinc-200 dark:border-white/5 pb-2">
            {recentActivity.length === 0 ? (
              <li className="py-8 text-center text-sm text-zinc-500">
                Hələ fəaliyyət yoxdur
              </li>
            ) : (
              recentActivity.map((row) => (
                <ActivityItem key={row.id} row={row} />
              ))
            )}
          </ul>
        </div>

        <div className="relative overflow-hidden rounded-[14px] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[linear-gradient(145deg,rgba(21,20,39,0.96),rgba(9,10,21,0.98))] p-5 shadow-[0_24px_64px_-50px_rgba(124,58,237,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[0_24px_64px_-50px_rgba(124,58,237,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Sürətli icmal
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <QuickStat
              icon={<ShoppingBag className="h-4 w-4 text-amber-400" />}
              label="Sifarişlər"
              value={orderCount.toString()}
              href="/profile/orders"
              tint="amber"
            />
            <QuickStat
              icon={<Heart className="h-4 w-4 text-rose-400" />}
              label="Favorilər"
              value={favoritesCount.toString()}
              href="/profile/favorites"
              tint="rose"
            />
            <QuickStat
              icon={<Crown className="h-4 w-4 text-fuchsia-400" />}
              label="Abunəliklər"
              value={activeSubscriptionsCount.toString()}
              href="/profile/subscriptions"
              tint="fuchsia"
            />
            <QuickStat
              icon={<Users className="h-4 w-4 text-sky-400" />}
              label="Dəvətlər"
              value={refereeCount.toString()}
              href="/profile/referrals"
              tint="sky"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function WelcomeCard({
  displayName,
  initial,
  memberSince,
  orderCount,
}: {
  displayName: string;
  initial: string;
  memberSince: string | null;
  orderCount: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-violet-300/30 dark:border-violet-300/20 bg-gradient-to-br from-white via-violet-50 to-violet-100 dark:bg-[linear-gradient(135deg,rgba(30,17,59,0.98),rgba(14,13,29,0.96)_48%,rgba(8,9,20,0.98))] p-5 shadow-[0_24px_70px_-52px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_24px_70px_-52px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_8%,rgba(124,58,237,0.3),transparent_38%),radial-gradient(circle_at_100%_95%,rgba(168,85,247,0.16),transparent_32%)]" />
      <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(124,58,237,0.4),rgba(35,18,75,0.18)_46%,transparent_70%)] blur-[2px]" />

      <div className="relative flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.12),rgba(124,58,237,0.34)_36%,rgba(32,16,62,0.94)_74%)] text-[30px] font-black text-white shadow-[0_0_0_2px_rgba(168,85,247,0.55),0_0_34px_-10px_rgba(168,85,247,0.95),inset_0_0_18px_rgba(255,255,255,0.08)]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
            Salam,
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            <span className="truncate">{displayName}</span>
            <BadgeCheck className="h-4 w-4 shrink-0 fill-violet-500 text-violet-100 dark:text-violet-300" />
          </h2>
          <p className="mt-1 truncate text-xs text-zinc-700/80 dark:text-zinc-300/80">
            Honsell icmasının dəyərli üzvüsən.
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        {memberSince && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3 py-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
            Üzv: {memberSince}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3 py-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          <ShoppingBag className="h-3.5 w-3.5 text-zinc-500" />
          {orderCount} sifariş
        </span>
      </div>
    </div>
  );
}

function SavingsCard({
  latestMonthSavings,
  maxMonthlySavings,
  savingsByMonth,
  totalSavingsAzn,
}: {
  latestMonthSavings: number;
  maxMonthlySavings: number;
  savingsByMonth: { label: string; valueAzn: number }[];
  totalSavingsAzn: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[linear-gradient(140deg,rgba(21,20,40,0.98),rgba(13,12,29,0.98)_52%,rgba(8,9,20,0.98))] p-5 shadow-[0_26px_72px_-54px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[0_26px_72px_-54px_rgba(124,58,237,0.88),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(124,58,237,0.2),transparent_36%),radial-gradient(circle_at_92%_88%,rgba(34,197,94,0.08),transparent_30%)]" />

      <div className="relative grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet-700 dark:text-violet-200">
            <TrendingUp className="h-3.5 w-3.5" />
            Nə qədər qazanmısan
          </p>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-[38px] font-black leading-none tabular-nums text-emerald-600 dark:text-emerald-300">
              {totalSavingsAzn.toFixed(2)}
            </span>
            <span className="text-base font-bold text-emerald-700/80 dark:text-emerald-200/80">₼</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Endirimlər və cashback-lərlə ümumi qənaətin
          </p>
          <Link
            href="/profile/orders"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.055] px-3 text-xs font-bold text-zinc-900 dark:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-300/40 hover:bg-zinc-100 dark:hover:border-violet-300/30 dark:hover:bg-white/[0.09]"
          >
            Ətraflı statistika <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-[12px] border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Son 6 ay
            </span>
            <span className="rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
              {latestMonthSavings.toFixed(2)} ₼
            </span>
          </div>
          <div className="mt-3 flex h-[88px] items-end gap-2.5">
            {savingsByMonth.map((b, i) => {
              const h = Math.max(
                8,
                Math.round((b.valueAzn / maxMonthlySavings) * 80),
              );
              const isLast = i === savingsByMonth.length - 1;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={`w-full rounded-t-[4px] rounded-b-sm bg-gradient-to-t shadow-[0_0_14px_-7px_rgba(168,85,247,0.95)] ${
                      isLast
                        ? "from-emerald-700 via-emerald-500 to-emerald-300"
                        : "from-violet-800 via-violet-500 to-violet-300"
                    }`}
                    style={{ height: `${h}px` }}
                  />
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferralHero({ refereeCount }: { refereeCount: number }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-violet-300/30 dark:border-violet-300/20 bg-gradient-to-br from-white via-violet-50 to-purple-50 dark:bg-[linear-gradient(140deg,rgba(23,17,46,0.98),rgba(12,12,28,0.98)_52%,rgba(8,9,20,0.98))] p-5 shadow-[0_26px_72px_-54px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_26px_72px_-54px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.26),transparent_34%)]" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/15 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet-700 dark:text-violet-200">
            <Share2 className="h-3.5 w-3.5" />
            Referal proqramı
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 dark:border-white/10 bg-white/60 dark:bg-black/20 px-2.5 py-1 text-[11px] font-bold tabular-nums text-violet-700 dark:text-violet-200">
            <Users className="h-3.5 w-3.5" />
            {refereeCount} dəvət
          </span>
        </div>

        <h3 className="mt-4 text-xl font-black tracking-tight text-zinc-900 dark:text-white">
          Hər dəvətindən qazan
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-700/80 dark:text-zinc-300/80">
          Kodun ilə qeydiyyatdan keçən dostlarının hər alışından komissiya
          qazanırsan. Qazanc balansı ödənişdə istifadə oluna bilər.
        </p>

        <Link
          href="/profile/referrals"
          className="mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-violet-600 to-purple-800 px-4 text-xs font-bold text-white shadow-[0_14px_34px_-20px_rgba(168,85,247,0.95)] transition hover:from-violet-500 hover:to-purple-700"
        >
          Necə işləyir? <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function BalanceCard({
  icon,
  label,
  value,
  subtitle,
  accent,
  href,
  cta,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle: string;
  accent: "purple" | "amber";
  href: string;
  cta?: React.ReactNode;
}) {
  const styles =
    accent === "amber"
      ? {
          shell:
            "border-amber-400/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:bg-[linear-gradient(145deg,rgba(28,24,28,0.98),rgba(14,13,22,0.99))]",
          glow: "bg-amber-400/10",
          chipBg: "bg-amber-400/15 dark:bg-amber-400/10",
          chipText: "text-amber-700 dark:text-amber-300",
          chipRing: "ring-amber-400/25",
          value: "text-amber-900 dark:text-amber-100",
          iconGlow: "text-amber-600 dark:text-amber-300",
        }
      : {
          shell:
            "border-zinc-200 dark:border-white/10 bg-gradient-to-br from-white to-violet-50 dark:bg-[linear-gradient(145deg,rgba(21,20,39,0.98),rgba(10,10,22,0.99))]",
          glow: "bg-violet-500/20",
          chipBg: "bg-violet-500/15 dark:bg-violet-500/10",
          chipText: "text-violet-700 dark:text-violet-200",
          chipRing: "ring-violet-300/25",
          value: "text-zinc-900 dark:text-white",
          iconGlow: "text-violet-700 dark:text-violet-200",
        };

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-[14px] border p-5 shadow-[0_24px_64px_-50px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[0_24px_64px_-50px_rgba(124,58,237,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] ${styles.shell}`}
    >
      <div
        className={`absolute -right-8 -top-8 h-28 w-28 rounded-full ${styles.glow} blur-[48px]`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`inline-flex items-center gap-2 rounded-[9px] ${styles.chipBg} px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${styles.chipText} ring-1 ${styles.chipRing}`}
        >
          <span className={styles.iconGlow}>{icon}</span>
          {label}
        </div>
        <Link
          href={href}
          aria-label={label}
          className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.055] text-zinc-600 dark:text-zinc-300 transition hover:border-violet-300/40 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-violet-300/30 dark:hover:bg-white/[0.09] dark:hover:text-white"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="relative mt-5 flex items-baseline gap-2">
        <span
          className={`text-[34px] font-black leading-none tabular-nums ${styles.value}`}
        >
          {value.toFixed(2)}
        </span>
        <span className="text-base font-bold text-zinc-600 dark:text-zinc-300">₼</span>
      </p>
      <p className="relative mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {subtitle}
      </p>

      {cta && <div className="relative mt-auto">{cta}</div>}
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
  href,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  tint: "amber" | "rose" | "fuchsia" | "sky";
}) {
  const tintBg = {
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
    rose: "bg-rose-500/10 text-rose-300 ring-rose-500/25",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/25",
    sky: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  }[tint];
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[11px] border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.045] p-3 transition hover:border-violet-300/35 hover:bg-zinc-100 dark:hover:border-violet-300/25 dark:hover:bg-white/[0.07]"
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ring-1 ${tintBg}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[22px] font-black leading-none tabular-nums text-zinc-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const isCredit = row.amountAznCents >= 0;
  const amountAzn = Math.abs(row.amountAznCents) / 100;

  let title = "Əməliyyat";
  let icon: React.ReactNode = <CreditCard className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />;
  let iconBg = "bg-zinc-100 dark:bg-white/5";

  if (row.type === "PURCHASE") {
    title = row.game?.title ?? "Silinmiş oyun";
    icon = (
      <span className="text-[10px] font-bold tracking-tight text-white">PS</span>
    );
    iconBg = "bg-sky-500/10 ring-1 ring-sky-500/30";
  } else if (row.type === "SERVICE_PURCHASE") {
    title = row.serviceProduct?.title ?? "Xidmət alışı";
    icon = <Tv className="h-5 w-5 text-rose-400" />;
    iconBg = "bg-rose-500/10 ring-1 ring-rose-500/30";
  } else if (row.type === "DEPOSIT") {
    title = "Balans yükləmə";
    icon = <Wallet className="h-5 w-5 text-emerald-400" />;
    iconBg = "bg-emerald-500/10 ring-1 ring-emerald-500/30";
  } else if (row.type === "COMMISSION") {
    title = "Cashback qazancı";
    icon = <Sparkles className="h-5 w-5 text-amber-400" />;
    iconBg = "bg-amber-500/10 ring-1 ring-amber-500/30";
  }

  const statusLabel =
    row.type === "DEPOSIT" && row.status === "SUCCESS"
      ? "Yükləndi"
      : STATUS_LABEL_AZ[row.status] ?? row.status;

  const dateLabel = fmtDateTime(row.createdAt);

  const useGameImage =
    row.type === "PURCHASE" && row.game?.imageUrl;

  return (
    <li className="flex items-center gap-3 py-2.5">
      <div
        className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg ${useGameImage ? "" : iconBg}`}
      >
        {useGameImage ? (
          <Image
            src={row.game!.imageUrl!}
            alt={row.game!.title}
            fill
            sizes="36px"
            className="object-cover"
          />
        ) : (
          icon
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{title}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              row.status === "PENDING"
                ? "bg-amber-500/10 text-amber-300"
                : row.status === "FAILED"
                  ? "bg-rose-500/10 text-rose-300"
                  : "bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-500">{dateLabel}</p>
      </div>
      <p
        className={`shrink-0 text-sm font-bold tabular-nums ${
          isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-200"
        }`}
      >
        {isCredit ? "+" : "-"}
        {amountAzn.toFixed(2)} ₼
      </p>
    </li>
  );
}
