import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Gamepad2,
  Settings as SettingsIcon,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: Wallet, badgeKey: "pendingDeposits" as const },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt },
  { href: "/admin/games", label: "Games", icon: Gamepad2 },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");

  const pendingDeposits = await prisma.transaction.count({
    where: { type: "DEPOSIT", status: "PENDING" },
  });

  const badges = { pendingDeposits } as const;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-900 bg-zinc-950 md:block">
        <div className="flex h-16 items-center gap-2 border-b border-zinc-900 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Honsell Admin</div>
            <div className="text-[11px] text-zinc-500">{user.email}</div>
          </div>
        </div>

        <nav className="px-3 py-4">
          {NAV.map(({ href, label, icon: Icon, badgeKey }) => {
            const count = badgeKey ? badges[badgeKey] : 0;
            return (
              <Link
                key={href}
                href={href}
                className="mb-1 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-zinc-500" />
                  {label}
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pt-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Back to store
          </Link>
        </div>

        <div className="px-5 pt-3">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
