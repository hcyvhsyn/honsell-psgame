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
        take: 4,
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
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(420px,1.65fr)_minmax(260px,0.95fr)_minmax(270px,1fr)]">
        <WelcomeCard
          displayName={displayName}
          initial={initial}
          memberSince={memberSince}
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
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-violet-600 via-purple-600 to-violet-800 px-4 text-sm font-bold text-white shadow-[0_18px_44px_-22px_rgba(124,58,237,0.95)] transition hover:from-violet-500 hover:via-purple-500 hover:to-violet-700"
            >
              <Plus className="h-4 w-4" /> Balans yüklə
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

      <section className="grid gap-4 xl:grid-cols-[1.18fr_0.94fr]">
        <SavingsCard
          latestMonthSavings={latestMonthSavings}
          maxMonthlySavings={maxMonthlySavings}
          savingsByMonth={savingsByMonth}
          totalSavingsAzn={totalSavingsAzn}
        />

        <ReferralHero />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.18fr_0.94fr]">
        <div className="relative min-h-[296px] overflow-hidden rounded-[16px] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[linear-gradient(145deg,rgba(21,20,39,0.96),rgba(9,10,21,0.98))] shadow-[0_30px_80px_-50px_rgba(124,58,237,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[0_30px_80px_-50px_rgba(124,58,237,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 dark:via-violet-300/40 to-transparent" />
          <header className="flex items-center justify-between px-6 pb-3 pt-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Son fəaliyyətlər
            </h3>
          </header>
          <ul className="mx-6 divide-y divide-zinc-200 dark:divide-white/5 border-t border-zinc-200 dark:border-white/5">
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
          <Link
            href="/profile/orders"
            className="inline-flex items-center gap-1.5 px-6 py-4 text-sm font-bold text-violet-700 dark:text-violet-300 transition hover:text-violet-900 dark:hover:text-violet-200"
          >
            Bütün fəaliyyətlər <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative min-h-[296px] overflow-hidden rounded-[16px] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[linear-gradient(145deg,rgba(21,20,39,0.96),rgba(9,10,21,0.98))] p-6 shadow-[0_30px_80px_-50px_rgba(124,58,237,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[0_30px_80px_-50px_rgba(124,58,237,0.8),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 dark:via-violet-300/40 to-transparent" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Sürətli icmal
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuickStat
              icon={<ShoppingBag className="h-5 w-5 text-amber-400" />}
              label="Sifarişlər"
              value={orderCount.toString()}
              hint="Bütün vaxt ərzində"
              href="/profile/orders"
              tint="amber"
            />
            <QuickStat
              icon={<Heart className="h-5 w-5 text-rose-400" />}
              label="Favorilər"
              value={favoritesCount.toString()}
              hint="Sevdiklərin siyahısı"
              href="/profile/favorites"
              tint="rose"
            />
            <QuickStat
              icon={<Crown className="h-5 w-5 text-fuchsia-400" />}
              label="Aktiv abunəliklər"
              value={activeSubscriptionsCount.toString()}
              hint="Hazırda aktiv"
              href="/profile/subscriptions"
              tint="fuchsia"
            />
            <QuickStat
              icon={<Users className="h-5 w-5 text-sky-400" />}
              label="Dəvət etdiklərin"
              value={refereeCount.toString()}
              hint="Üzv olmayan dostların"
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
}: {
  displayName: string;
  initial: string;
  memberSince: string | null;
}) {
  return (
    <div className="relative min-h-[226px] overflow-hidden rounded-[16px] border border-violet-300/30 dark:border-violet-300/20 bg-gradient-to-br from-white via-violet-50 to-violet-100 dark:bg-[linear-gradient(135deg,rgba(30,17,59,0.98),rgba(14,13,29,0.96)_45%,rgba(8,9,20,0.98))] p-7 shadow-[0_30px_90px_-52px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_30px_90px_-52px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(124,58,237,0.34),transparent_34%),radial-gradient(circle_at_100%_95%,rgba(168,85,247,0.18),transparent_30%)]" />
      <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border border-violet-300/10 bg-[radial-gradient(circle_at_35%_35%,rgba(124,58,237,0.45),rgba(35,18,75,0.25)_42%,transparent_68%)] shadow-[inset_24px_-22px_70px_rgba(10,6,30,0.9)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[54%] sm:block">
        <Image
          src="/ps-controller.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1280px) 430px, 48vw"
          className="object-cover object-right-bottom opacity-70 saturate-125 [mask-image:linear-gradient(to_left,black_26%,rgba(0,0,0,0.85)_52%,transparent_94%)]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1b1034] via-[#1b1034]/20 to-transparent" />
      </div>

      <div className="relative flex min-h-[172px] items-center gap-6">
        <div className="grid h-[90px] w-[90px] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.12),rgba(124,58,237,0.32)_34%,rgba(32,16,62,0.94)_72%)] text-[42px] font-black text-white shadow-[0_0_0_2px_rgba(168,85,247,0.55),0_0_42px_-8px_rgba(168,85,247,0.95),inset_0_0_22px_rgba(255,255,255,0.08)]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
            Salam,
          </p>
          <h2 className="mt-3 flex items-center gap-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-[32px]">
            <span className="truncate">{displayName}</span>
            <BadgeCheck className="h-5 w-5 shrink-0 fill-violet-500 text-violet-100 dark:text-violet-300" />
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700/80 dark:text-zinc-300/80">
            Honsell icmasının dəyərli üzvüsən.
          </p>
          {memberSince && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <CalendarDays className="h-3.5 w-3.5 text-zinc-500" />
              Üzv olub: {memberSince}
            </p>
          )}
        </div>
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
    <div className="relative min-h-[248px] overflow-hidden rounded-[16px] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[linear-gradient(140deg,rgba(21,20,40,0.98),rgba(13,12,29,0.98)_52%,rgba(8,9,20,0.98))] p-7 shadow-[0_32px_90px_-54px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[0_32px_90px_-54px_rgba(124,58,237,0.88),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_20%,rgba(124,58,237,0.24),transparent_32%),radial-gradient(circle_at_84%_80%,rgba(34,197,94,0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute left-[43%] top-7 hidden h-40 w-40 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl sm:block" />

      <div className="relative grid min-h-[190px] gap-6 md:grid-cols-[minmax(190px,0.95fr)_minmax(180px,0.8fr)_auto] md:items-end">
        <div className="self-start">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-violet-700 dark:text-violet-200">
            <TrendingUp className="h-3.5 w-3.5" />
            Honsell ilə nə qədər qazanmısan
          </p>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="text-[42px] font-black leading-none tabular-nums text-emerald-600 dark:text-emerald-300">
              {totalSavingsAzn.toFixed(2)}
            </span>
            <span className="text-base font-bold text-emerald-700/80 dark:text-emerald-200/80">₼</span>
          </p>
          <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Endirimlər və cashback-lərlə ümumi qənaətin
          </p>
          <Link
            href="/profile/orders"
            className="mt-7 inline-flex h-10 items-center gap-2 rounded-[12px] border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.055] px-4 text-xs font-bold text-zinc-900 dark:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-300/40 hover:bg-zinc-100 dark:hover:border-violet-300/30 dark:hover:bg-white/[0.09]"
          >
            Daha ətraflı statistika <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <PiggyIllustration />

        <div className="flex items-end justify-between gap-4 md:block">
          <div className="mb-3 w-fit rounded-[10px] border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.055] px-3 py-2 text-[11px] font-bold tabular-nums text-zinc-700 dark:text-zinc-200 md:ml-auto">
            {latestMonthSavings.toFixed(2)} ₼
          </div>
          <div>
            <div className="flex h-[92px] items-end gap-3">
              {savingsByMonth.map((b, i) => {
                const h = Math.max(
                  10,
                  Math.round((b.valueAzn / maxMonthlySavings) * 82),
                );
                return (
                  <div
                    key={i}
                    className="flex w-5 flex-col items-center gap-1"
                  >
                    <div
                      className="w-full rounded-t-[5px] rounded-b-sm bg-gradient-to-t from-violet-800 via-violet-500 to-violet-300 shadow-[0_0_18px_-7px_rgba(168,85,247,0.95)]"
                      style={{ height: `${h}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-3">
              {savingsByMonth.map((b, i) => (
                <span
                  key={i}
                  className="w-5 text-center text-[11px] font-medium text-zinc-500 dark:text-zinc-400"
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PiggyIllustration() {
  return (
    <div className="pointer-events-none relative mx-auto hidden h-48 w-60 self-end md:block">
      <div className="absolute bottom-0 left-1/2 h-12 w-44 -translate-x-1/2 rounded-full bg-violet-600/25 blur-xl" />
      <div className="absolute bottom-2 left-1/2 h-8 w-40 -translate-x-1/2 rounded-full border border-violet-300/20 bg-violet-500/20" />
      <Image
        src="/pig.png"
        alt=""
        fill
        sizes="260px"
        className="object-cover opacity-95 drop-shadow-[0_22px_42px_rgba(168,85,247,0.32)] saturate-125 [mask-image:radial-gradient(ellipse_at_center,black_58%,rgba(0,0,0,0.82)_72%,transparent_91%)]"
        style={{ objectPosition: "center 55%" }}
      />
    </div>
  );
}

function ReferralHero() {
  return (
    <div className="relative min-h-[248px] overflow-hidden rounded-[16px] border border-violet-300/30 dark:border-violet-300/20 bg-gradient-to-br from-white via-violet-50 to-purple-50 dark:bg-[linear-gradient(140deg,rgba(23,17,46,0.98),rgba(12,12,28,0.98)_52%,rgba(8,9,20,0.98))] p-7 shadow-[0_32px_90px_-54px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_32px_90px_-54px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,rgba(168,85,247,0.32),transparent_30%),radial-gradient(circle_at_95%_8%,rgba(99,102,241,0.18),transparent_30%)]" />
      <div className="relative grid min-h-[190px] gap-5 md:grid-cols-[minmax(220px,1fr)_240px] md:items-center">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-violet-700 dark:text-violet-200">
            <Share2 className="h-3.5 w-3.5" />
            Referal proqramı
          </p>
          <h3 className="mt-6 text-[26px] font-black tracking-tight text-zinc-900 dark:text-white sm:text-[28px]">
            Hər dəvətindən qazan
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-700/80 dark:text-zinc-300/80">
            Kodun ilə qeydiyyatdan keçən dostlarının hər alışından komissiya
            qazanırsan.
          </p>
          <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Qazanc balansı ödənişdə istifadə oluna bilər.
          </p>
          <Link
            href="/profile/referrals"
            className="mt-7 inline-flex h-10 items-center gap-2 rounded-[12px] bg-gradient-to-r from-violet-600 to-purple-800 px-4 text-xs font-bold text-white shadow-[0_18px_42px_-22px_rgba(168,85,247,0.95)] transition hover:from-violet-500 hover:to-purple-700"
          >
            Necə işləyir? <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ReferralIllustration />
      </div>
    </div>
  );
}

function ReferralIllustration() {
  return (
    <div className="pointer-events-none relative hidden h-48 w-full md:block">
      <div className="absolute inset-x-2 bottom-1 h-24 rounded-[50%] border border-violet-300/10 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.22),transparent_64%)]" />
      <Image
        src="/connect.png"
        alt=""
        fill
        sizes="270px"
        className="object-cover opacity-95 drop-shadow-[0_24px_48px_rgba(168,85,247,0.34)] saturate-125 [mask-image:radial-gradient(ellipse_at_center,black_58%,rgba(0,0,0,0.8)_73%,transparent_92%)]"
        style={{ objectPosition: "center 63%" }}
      />
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
      className={`relative min-h-[226px] overflow-hidden rounded-[16px] border p-7 shadow-[0_30px_80px_-50px_rgba(124,58,237,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] dark:shadow-[0_30px_80px_-50px_rgba(124,58,237,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] ${styles.shell}`}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300 dark:via-white/30 to-transparent" />
      <div
        className={`absolute -right-10 -top-10 h-36 w-36 rounded-full ${styles.glow} blur-[58px]`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`inline-flex items-center gap-2 rounded-[10px] ${styles.chipBg} px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] ${styles.chipText} ring-1 ${styles.chipRing}`}
        >
          <span className={styles.iconGlow}>{icon}</span>
          {label}
        </div>
        <Link
          href={href}
          aria-label={label}
          className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.055] text-zinc-600 dark:text-zinc-300 transition hover:border-violet-300/40 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-violet-300/30 dark:hover:bg-white/[0.09] dark:hover:text-white"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="relative mt-8 flex items-baseline gap-2">
        <span
          className={`text-[42px] font-black leading-none tabular-nums ${styles.value} sm:text-[46px]`}
        >
          {value.toFixed(2)}
        </span>
        <span className="text-base font-bold text-zinc-600 dark:text-zinc-300">₼</span>
      </p>
      <p className="relative mt-4 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        {subtitle}
      </p>

      {cta && <div className="relative">{cta}</div>}
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
  hint,
  href,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  href: string;
  tint: "amber" | "rose" | "fuchsia" | "sky";
}) {
  const tintBg = {
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25 shadow-[0_0_28px_-12px_rgba(245,158,11,0.8)]",
    rose: "bg-rose-500/10 text-rose-300 ring-rose-500/25 shadow-[0_0_28px_-12px_rgba(244,63,94,0.8)]",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/25 shadow-[0_0_28px_-12px_rgba(217,70,239,0.8)]",
    sky: "bg-sky-500/10 text-sky-300 ring-sky-500/25 shadow-[0_0_28px_-12px_rgba(14,165,233,0.8)]",
  }[tint];
  return (
    <Link
      href={href}
      className="group relative min-h-[96px] overflow-hidden rounded-[12px] border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.045] p-4 transition hover:border-violet-300/35 hover:bg-zinc-100 dark:hover:border-violet-300/25 dark:hover:bg-white/[0.07]"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-100 dark:from-white/[0.035] to-transparent opacity-80" />
      <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-zinc-500 transition group-hover:text-zinc-900 dark:group-hover:text-white" />
      <div className="relative flex items-center gap-4 pr-5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ring-1 ${tintBg}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1 text-[26px] font-black leading-none tabular-nums text-zinc-900 dark:text-white">
            {value}
          </p>
          <p className="mt-2 text-[12px] leading-snug text-zinc-500">{hint}</p>
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

  const dateLabel = new Date(row.createdAt).toLocaleString("az-AZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const useGameImage =
    row.type === "PURCHASE" && row.game?.imageUrl;

  return (
    <li className="flex items-center gap-3 py-3.5">
      <div
        className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl ${useGameImage ? "" : iconBg}`}
      >
        {useGameImage ? (
          <Image
            src={row.game!.imageUrl!}
            alt={row.game!.title}
            fill
            sizes="40px"
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
        <p className="mt-1 text-[11px] text-zinc-500">{dateLabel}</p>
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
