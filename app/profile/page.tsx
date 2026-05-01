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
import { GAME_STAGE_LABEL_AZ, parseGameOrderMeta } from "@/lib/gameOrderFulfillment";

export const dynamic = "force-dynamic";

const NEXT_REFERRAL_MILESTONE = 10;
const NEXT_PSN_TARGET = 3;

export default async function ProfileOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let accountCount = 0;
  let orderCount = 0;
  let refereeCount = 0;
  let commissionCents = 0;
  let totalSpentCents = 0;
  let recentOrders: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    amountAznCents: number;
    metadata: string | null;
    gameId: string | null;
    game: { title: string; imageUrl: string | null } | null;
    serviceProduct?: { title: string } | null;
  }> = [];

  try {
    [
      accountCount,
      orderCount,
      refereeCount,
      commissionCents,
      totalSpentCents,
      recentOrders,
    ] = await Promise.all([
      prisma.psnAccount.count({ where: { userId: user.id } }),
      prisma.transaction.count({
        where: { userId: user.id, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
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
          where: { userId: user.id, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
          _sum: { amountAznCents: true },
        })
        .then((a) => Math.abs(a._sum.amountAznCents ?? 0)),
      prisma.transaction.findMany({
        where: { userId: user.id, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          game: { select: { title: true, imageUrl: true } },
          serviceProduct: { select: { title: true } },
        },
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Back-compat fallback when prod DB hasn't been migrated yet.
    if (msg.includes("Transaction.serviceProductId") || msg.includes("serviceProductId")) {
      [
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
    } else {
      throw err;
    }
  }

  const walletAzn = user.walletBalance / 100;
  const cashbackAzn = (user.cashbackBalanceCents ?? 0) / 100;
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
    <div className="space-y-8">
      {/* ───── Hero: wallet + welcome ───── */}
      <section className="relative overflow-hidden rounded-[24px] border border-white/5 bg-[#111116] p-8 shadow-2xl">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#5a189a]/20 blur-[80px]" />
        <div className="absolute -bottom-12 -left-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-[80px]" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[#5a189a]/20 text-3xl font-bold text-white ring-1 ring-[#5a189a]/50">
              {(user.name ?? user.email)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-[#9f5af0]">
                Salam
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                {user.name ?? user.email.split("@")[0]}
              </h2>
              {memberSince && (
                <p className="mt-1 text-sm text-zinc-400">
                  Üzv olub: {memberSince}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="rounded-[16px] border border-white/5 bg-white/5 p-5 backdrop-blur sm:min-w-[200px]">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                <Wallet className="h-4 w-4" /> Cüzdan balansı
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums text-white">
                  {walletAzn.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-zinc-400">AZN</span>
              </p>
              <Link
                href="/profile/wallet"
                className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#5a189a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7b2cbf]"
              >
                <Plus className="h-4 w-4" /> Balans yüklə
              </Link>
            </div>
            <div className="rounded-[16px] border border-amber-500/25 bg-amber-500/5 p-5 backdrop-blur sm:min-w-[200px]">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-200/80">
                <Sparkles className="h-4 w-4" /> Cashback balansı
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums text-amber-50">
                  {cashbackAzn.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-amber-200/60">AZN</span>
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-amber-100/50">
                Loyalty səviyyənə görə hər alışdan faiz burada yığılır.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Referral hero ───── */}
      <section className="relative overflow-hidden rounded-[24px] border border-white/5 bg-[#111116] p-8 shadow-2xl">
        <div className="absolute -right-10 top-0 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-[80px]" />

        <div className="relative grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-400">
              <Share2 className="h-4 w-4" /> Referal kodun
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <span className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-mono text-3xl font-bold tracking-[0.3em] text-white backdrop-blur">
                {user.referralCode}
              </span>
              <ReferralCodeCopy code={user.referralCode} />
            </div>
            <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
              Kodu paylaş — dostların qeydiyyatdan keçəndə hər ikiniz qazanır.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-col">
            <Stat
              label="Dəvət"
              value={refereeCount.toString()}
              icon={<Trophy className="h-4 w-4 text-fuchsia-400" />}
            />
            <Stat
              label="Qazanc"
              value={`${commissionAzn.toFixed(2)} AZN`}
              icon={<Sparkles className="h-4 w-4 text-fuchsia-400" />}
            />
          </div>
        </div>

        <div className="relative mt-8">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Növbəti hədəfə qədər:{" "}
              <span className="font-semibold text-white">
                {Math.max(0, NEXT_REFERRAL_MILESTONE - refereeCount)} dəvət
              </span>
            </span>
            <span className="font-semibold text-fuchsia-400">
              {refereeCount}/{NEXT_REFERRAL_MILESTONE}
            </span>
          </div>
          <ProgressBar value={refereePct} from="from-fuchsia-500" to="to-[#5a189a]" />
        </div>
      </section>

      {/* ───── Loyalty tier ───── */}
      <section className="relative overflow-hidden rounded-[24px] border border-white/5 bg-[#111116] p-8 shadow-2xl">
        <div className="absolute -left-16 -bottom-12 h-64 w-64 rounded-full bg-amber-500/10 blur-[80px]" />

        <div className="relative grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-5">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50">
              <Crown className="h-8 w-8" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                Loyalty səviyyə
              </p>
              <h3 className="text-2xl font-bold tracking-tight text-white mt-1">
                {loyalty.label}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {loyalty.cashbackPct > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
                    Hər alışdan {loyalty.cashbackPct}% cashback (balansa)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-white/10">
                    Bronze {loyalty.toNextAzn?.toFixed(0) ?? "?"} AZN sonra açılır
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-white/5 bg-white/5 p-5 backdrop-blur">
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="text-zinc-400">
                Ümumi xərc:{" "}
                <span className="font-semibold tabular-nums text-white">
                  {totalSpentAzn.toFixed(2)} AZN
                </span>
              </span>
              {loyalty.nextCashbackPct != null ? (
               <span className="font-semibold text-amber-400">
                  Növbəti: {loyalty.nextLabel} · {loyalty.nextCashbackPct}% cashback
                </span>
              ) : (
                <span className="font-semibold text-amber-400">Maksimum səviyyə!</span>
              )}
            </div>
            <ProgressBar
              value={loyalty.progressPct}
              from="from-amber-500"
              to="to-yellow-400"
            />
            {loyalty.toNextAzn != null && loyalty.toNextAzn > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                Növbəti səviyyəyə qədər{" "}
                <span className="font-bold text-white">
                  {loyalty.toNextAzn.toFixed(2)} AZN
                </span>{" "}
                qaldı —{" "}
                <span className="font-bold text-amber-400">
                  {loyalty.nextLabel} · {loyalty.nextCashbackPct}% cashback
                </span>{" "}
                səni gözləyir.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ───── Stats with bars ───── */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Gamepad2 className="h-5 w-5 text-sky-400" />}
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
          icon={<Receipt className="h-5 w-5 text-emerald-400" />}
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
          icon={<TrendingUp className="h-5 w-5 text-[#9f5af0]" />}
          label="Toplam xərc"
          value={`${totalSpentAzn.toFixed(0)} AZN`}
          hint={
            totalSpentAzn > 0
              ? "Səxavətli oyunçu — davam et!"
              : "Hələ alış yoxdur"
          }
          progress={Math.min(100, (totalSpentAzn / 200) * 100)}
          progressFrom="from-[#5a189a]"
          progressTo="to-[#9f5af0]"
        />
      </section>

      {/* ───── Recent orders preview ───── */}
      {recentOrders.length > 0 && (
        <section className="overflow-hidden rounded-[24px] border border-white/5 bg-[#111116] shadow-xl">
          <header className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-zinc-400" />
              <h3 className="text-base font-bold text-white">Son sifarişlər</h3>
            </div>
            <Link
              href="/profile/orders"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#9f5af0] hover:text-[#b784f6] transition"
            >
              Hamısı <ArrowRight className="h-4 w-4" />
            </Link>
          </header>
          <ul className="divide-y divide-white/5">
            {recentOrders.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-4 px-6 py-4 transition hover:bg-white/5"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                  {o.game?.imageUrl ? (
                    <Image
                      src={o.game.imageUrl}
                      alt={o.game.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-zinc-600 bg-white/5">
                      <Gamepad2 className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-white">
                    {o.type === "SERVICE_PURCHASE" ? o.serviceProduct?.title : (o.game?.title ?? "Silinmiş məhsul")}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {new Date(o.createdAt).toLocaleDateString("az-AZ")}
                    {o.type === "PURCHASE" && o.gameId && o.status === "PENDING"
                      ? ` · ${GAME_STAGE_LABEL_AZ[parseGameOrderMeta(o.metadata).fulfillmentStage ?? "NEW"]}`
                      : null}
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums text-white">
                  {(Math.abs(o.amountAznCents) / 100).toFixed(2)} ₼
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
    <div className="rounded-xl border border-white/5 bg-white/5 px-4 py-3 backdrop-blur">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-white">{value}</p>
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
      className={`flex flex-col overflow-hidden rounded-[24px] border p-6 shadow-xl transition-all duration-300 ${
        ctaHighlight
          ? "border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-[#111116]"
          : "border-white/5 bg-[#111116] hover:border-white/10"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <span className="rounded-lg bg-white/5 p-1.5">{icon}</span> {label}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-white">{value}</p>
      {hint && <p className="mt-1 text-sm font-medium text-zinc-400">{hint}</p>}

      <div className="mt-5">
        <ProgressBar value={progress} from={progressFrom} to={progressTo} />
      </div>

      {href && (
        <Link
          href={href}
          className={`mt-6 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition ${
            ctaHighlight
              ? "bg-amber-500 text-black hover:bg-amber-400"
              : "bg-white/5 text-white hover:bg-white/10"
          }`}
        >
          {ctaLabel ?? "Aç"} <ArrowRight className="h-4 w-4" />
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
