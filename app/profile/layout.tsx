import { redirect } from "next/navigation";
import { Mail, CalendarDays } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLoyaltyTier } from "@/lib/loyalty";
import SiteHeader from "@/components/SiteHeader";
import ProfileSidebar from "@/components/ProfileSidebar";
import LogoutButton from "@/components/LogoutButton";
import LoyaltyTierBadge from "@/components/LoyaltyTierBadge";

export const dynamic = "force-dynamic";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");
  if (user.role === "ADMIN") redirect("/admin");

  const spentAgg = await prisma.transaction.aggregate({
    where: { userId: user.id, type: "PURCHASE" },
    _sum: { amountAznCents: true },
  });
  const spentAzn = Math.abs(spentAgg._sum.amountAznCents ?? 0) / 100;
  const loyalty = getLoyaltyTier(spentAzn);

  const initial = (user.name ?? user.email)[0]?.toUpperCase() ?? "?";
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("az-AZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="relative mb-6 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/40 to-zinc-950 p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

          <div className="relative flex flex-wrap items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-indigo-500/20 text-2xl font-bold text-indigo-100 ring-1 ring-indigo-400/40">
              {initial}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {user.name ?? user.email}
                </h1>
                <LoyaltyTierBadge tier={loyalty} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3 w-3 text-zinc-500" />
                  {user.email}
                </span>
                {memberSince && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3 text-zinc-500" />
                    {memberSince}-dən üzv
                  </span>
                )}
              </div>
            </div>

            {/* Logout lives in the desktop sidebar; mobile uses this header. */}
            <div className="lg:hidden">
              <LogoutButton />
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <ProfileSidebar walletBalance={user.walletBalance} />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
