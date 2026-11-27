import { Share2, Users, Coins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import ReferralShareButtons from "@/components/ReferralShareButtons";
import ProfilePageHeader from "@/components/profile/ProfilePageHeader";

/**
 * Dəvət olunanın şəxsi məlumatı referal sahibinə AÇIQ göstərilmir (2026-11): əvvəl tam e-poçt və
 * nə qədər xərclədiyi görünürdü. İndi yalnız ad (və ya maskalı e-poçt) + alış sayı.
 */
function maskReferee(name: string | null, email: string): string {
  const first = name?.trim().split(/\s+/)[0];
  if (first) return first;
  const [local, domain] = email.split("@");
  if (!domain) return "İstifadəçi";
  return `${local.slice(0, 2)}***@${domain}`;
}

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [referees, commissionAgg] = await Promise.all([
    prisma.user.findMany({
      where: { referredById: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        transactions: {
          where: { type: "PURCHASE" },
          select: { id: true },
        },
      },
    }),
    prisma.transaction.aggregate({
      where: { beneficiaryId: user.id, type: "COMMISSION" },
      _sum: { amountAznCents: true },
    }),
  ]);

  const totalEarnedAzn = (commissionAgg._sum.amountAznCents ?? 0) / 100;
  const totalReferralPurchases = referees.reduce(
    (s, r) => s + r.transactions.length,
    0
  );

  return (
    <section className="space-y-5">
      <ProfilePageHeader
        title="Referallar"
        description={
          <>
            Linkinlə qeydiyyatdan keçən dostlarının hər alışından komissiya qazanırsan.{" "}
            <Link href="/qazan" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
              Faizlər və qaydalar
            </Link>
          </>
        }
      />

      {/* Əvvəl yalnız kod var idi — dost onu qeydiyyatda əl ilə yazmalı idi. İndi link + WhatsApp/Telegram. */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300/80">Dəvət linkin və kodun</p>
        <code className="mt-2 inline-block rounded-md bg-white px-3 py-1.5 text-lg font-bold tracking-widest text-zinc-900 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-white dark:ring-white/10">
          {user.referralCode}
        </code>
        <div className="mt-3">
          <ReferralShareButtons code={user.referralCode} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Users className="h-3.5 w-3.5" />}
          label="Referallar"
          value={referees.length.toString()}
        />
        <Stat
          icon={<Share2 className="h-3.5 w-3.5" />}
          label="Onların alışları"
          value={totalReferralPurchases.toString()}
        />
        <Stat
          icon={<Coins className="h-3.5 w-3.5" />}
          label="Qazanılıb"
          value={`${totalEarnedAzn.toFixed(2)} ₼`}
        />
      </div>

      {referees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
          Hələ dəvət etdiyin yoxdur. Linki dostlarına göndər — qeydiyyatdan keçən kimi burada görünəcək.
        </div>
      ) : (
        <ul className="space-y-2">
          {referees.map((r) => {
            const purchaseCount = r.transactions.length;
            const shownName = maskReferee(r.name, r.email);
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-700 dark:text-indigo-200">
                  {shownName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                    {shownName}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {new Date(r.createdAt).toLocaleDateString("az-AZ")} tarixində qoşuldu
                  </p>
                </div>
                <p className="shrink-0 text-sm text-zinc-700 dark:text-zinc-300">{purchaseCount} alış</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon} {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}
