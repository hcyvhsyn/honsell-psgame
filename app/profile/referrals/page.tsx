import { Share2, Users, Coins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import ReferralCodeCopy from "@/components/ReferralCodeCopy";

export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [settings, referees, commissionAgg] = await Promise.all([
    prisma.settings.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global" },
    }),
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
          select: { amountAznCents: true },
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
      <header>
        <h2 className="text-lg font-semibold">Referallar</h2>
        <p className="text-sm text-zinc-400">
          Kodunla qeydiyyatdan keçən hər istifadəçinin alışından
          {" "}{settings.affiliateRatePct}% qazan.
        </p>
      </header>

      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
        <p className="text-xs uppercase tracking-wide text-indigo-300/80">
          Sənin referal kodun
        </p>
        <div className="mt-2 flex items-center gap-3">
          <code className="rounded-md bg-zinc-950 px-3 py-1.5 text-xl font-bold tracking-widest text-white">
            {user.referralCode}
          </code>
          <ReferralCodeCopy code={user.referralCode} />
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
          value={`${totalEarnedAzn.toFixed(2)} AZN`}
        />
      </div>

      {referees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-400">
          Qeydiyyat zamanı kodunu paylaş. Sənin referallarının hər alışından
          komissiya qazanırsan.
        </div>
      ) : (
        <ul className="space-y-2">
          {referees.map((r) => {
            const purchaseCount = r.transactions.length;
            const purchaseTotalAzn =
              r.transactions.reduce(
                (s, t) => s + Math.abs(t.amountAznCents),
                0
              ) / 100;
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-200">
                  {(r.name ?? r.email).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.name ?? r.email}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {new Date(r.createdAt).toLocaleDateString("az-AZ")} tarixində qoşuldu
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    {purchaseCount} alış
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    cəmi {purchaseTotalAzn.toFixed(2)} AZN
                  </p>
                </div>
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
        {icon} {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold">{value}</p>
    </div>
  );
}
