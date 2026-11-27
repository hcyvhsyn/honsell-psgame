import { Banknote, UserRound, Sparkles, Gift } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatHonsellGiftCardCode } from "@/lib/honsellGiftCard";
import WalletDepositForm from "@/components/WalletDepositForm";
import RedeemHonsellGiftCardForm from "./RedeemHonsellGiftCardForm";
import ProfilePageHeader from "@/components/profile/ProfilePageHeader";

export const dynamic = "force-dynamic";

/**
 * Profil → Balans. 2026-11: "Hədiyyə kart" səhifəsi buraya birləşdi (kod cüzdana köçür) —
 * /profile/hediyye-kart → /profile/wallet#hediyye-kart. Hər balansın altında nə olduğu yazılır
 * (əvvəl üç rəqəm izahsız idi).
 */
export default async function ProfileWalletPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [commissionLifetimeCents, recentRedeemed] = await Promise.all([
    prisma.transaction
      .aggregate({
        where: { beneficiaryId: user.id, type: "COMMISSION" },
        _sum: { amountAznCents: true },
      })
      .then((a) => a._sum.amountAznCents ?? 0),
    prisma.honsellGiftCard
      .findMany({
        where: { redeemedById: user.id, status: "REDEEMED" },
        orderBy: { redeemedAt: "desc" },
        take: 5,
      })
      .catch(() => []),
  ]);

  const balances = [
    {
      key: "wallet",
      label: "Cüzdan",
      value: user.walletBalance / 100,
      hint: "Səbətdə \"Cüzdanla ödə\" ilə xərclənir",
      Icon: Banknote,
      tone: "violet" as const,
    },
    {
      key: "cashback",
      label: "Cashback",
      value: (user.cashbackBalanceCents ?? 0) / 100,
      hint: "Alışlardan və rəylərdən qazandığın bonus",
      Icon: Sparkles,
      tone: "amber" as const,
    },
    {
      key: "referral",
      label: "Referal",
      value: user.referralBalanceCents / 100,
      hint: `Dostlarının alışlarından · cəmi ${(commissionLifetimeCents / 100).toFixed(2)}\u00a0₼`,
      Icon: UserRound,
      tone: "violet" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <ProfilePageHeader
        title="Balans"
        description="Cüzdanı kartla artır, hədiyyə kodunu aktivləşdir, qazandığın bonusları izlə."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {balances.map(({ key, label, value, hint, Icon, tone }) => (
          <div
            key={key}
            className={`flex items-start gap-3 rounded-2xl border bg-white p-4 dark:bg-[#111116] ${
              tone === "amber" ? "border-amber-300/60 dark:border-amber-500/20" : "border-zinc-200 dark:border-white/5"
            }`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${
                tone === "amber"
                  ? "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-300"
                  : "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-200"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">{value.toFixed(2)} ₼</p>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{hint}</p>
            </div>
          </div>
        ))}
      </div>

      <WalletDepositForm authed />

      <section
        id="hediyye-kart"
        className="scroll-mt-28 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/5 dark:bg-[#111116]"
      >
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
          <Gift className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          Hədiyyə kartı kodun var?
        </h2>
        <p className="mb-3 mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          11 simvollu Honsell hədiyyə kartı kodunu daxil et. Hər kod bir dəfə istifadə olunur.
        </p>
        <RedeemHonsellGiftCardForm currentWalletAzn={user.walletBalance / 100} />

        {recentRedeemed.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-white/5 dark:border-white/5">
            {recentRedeemed.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {c.code ? formatHonsellGiftCardCode(c.code) : "—"}
                  </span>
                  {c.redeemedAt && (
                    <span className="ml-2 text-xs text-zinc-500">
                      {new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium" }).format(c.redeemedAt)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                  +{(c.amountAznCents / 100).toFixed(2)} ₼
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
