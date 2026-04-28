import Link from "next/link";
import { Wallet, Gamepad2, Share2, Receipt, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfileOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already redirects to /login

  const [accountCount, orderCount, refereeCount, commissionCents] =
    await Promise.all([
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
    ]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Cüzdan balansı"
          value={`${(user.walletBalance / 100).toFixed(2)} AZN`}
          href="/wallet"
          cta="Doldur"
        />
        <Card
          icon={<Share2 className="h-3.5 w-3.5" />}
          label="Referal kodu"
          value={user.referralCode}
          mono
          subtle={`${refereeCount} referal · ${(commissionCents / 100).toFixed(2)} AZN qazanılıb`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          icon={<Gamepad2 className="h-3.5 w-3.5" />}
          label="PSN hesabları"
          value={`${accountCount}`}
          subtle={
            accountCount === 0
              ? "Sifariş üçün ən azı bir hesab əlavə et"
              : "Çatdırılma hesablarını idarə et"
          }
          href="/profile/accounts"
          cta="İdarə et"
          highlight={accountCount === 0}
        />
        <Card
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Sifarişlər"
          value={`${orderCount}`}
          subtle={orderCount === 0 ? "Hələ alış yoxdur" : "Alış tarixçəsinə bax"}
          href="/profile/orders"
          cta="Bax"
        />
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  subtle,
  href,
  cta,
  mono,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtle?: string;
  href?: string;
  cta?: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-zinc-800 bg-zinc-900/40"
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
        {icon} {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          mono ? "tracking-widest" : ""
        }`}
      >
        {value}
      </p>
      {subtle && <p className="mt-1 text-xs text-zinc-500">{subtle}</p>}
      {href && (
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
        >
          {cta ?? "Aç"} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
