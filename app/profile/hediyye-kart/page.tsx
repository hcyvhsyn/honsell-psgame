import type { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatHonsellGiftCardCode } from "@/lib/honsellGiftCard";
import RedeemHonsellGiftCardForm from "./RedeemHonsellGiftCardForm";

export const metadata: Metadata = {
  title: "Hədiyyə kart aktivləşdir — Honsell PS Store",
};

export const dynamic = "force-dynamic";

export default async function HonsellGiftCardRedeemPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Son aktivləşdirmələr — istifadəçinin sicilini göstərmək üçün.
  const recentRedeemed = await prisma.honsellGiftCard.findMany({
    where: { redeemedById: user.id, status: "REDEEMED" },
    orderBy: { redeemedAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-700/15 via-fuchsia-700/10 to-zinc-900/40 p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
          <Gift className="h-3.5 w-3.5" />
          Honsell Hədiyyə Kartı
        </div>
        <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Hədiyyə kart kodunu aktivləşdir</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-300">
          11 simvollu kodu daxil et — kartın nominalı dərhal cüzdan balansına köçürüləcək.
          Hər kod yalnız bir dəfə istifadə oluna bilər. Hələ kartın yoxdursa, {" "}
          <Link href="/hediyye-kartlari/honsell" className="text-violet-300 hover:underline">
            Honsell hədiyyə kartı al
          </Link>
          .
        </p>
      </header>

      <RedeemHonsellGiftCardForm currentWalletAzn={user.walletBalance / 100} />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-semibold text-white">Son aktivləşdirmələr</h2>
        {recentRedeemed.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">Hələ heç bir kart aktivləşdirməmisən.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-800/60">
            {recentRedeemed.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-zinc-300">{formatHonsellGiftCardCode(c.code)}</span>
                  <span className="text-xs text-zinc-500">
                    {c.redeemedAt
                      ? new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium" }).format(c.redeemedAt)
                      : ""}
                  </span>
                </div>
                <div className="font-semibold text-emerald-300">
                  +{(c.amountAznCents / 100).toFixed(2)} AZN
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
