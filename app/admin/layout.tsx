import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import Logo from "@/components/Logo";
import AdminSidebar from "./sidebar/AdminSidebar";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard", iconName: "LayoutDashboard" as const },
  { href: "/admin/users", label: "Users", iconName: "Users" as const },
  { href: "/admin/deposits", label: "Deposits", iconName: "Wallet" as const, badgeKey: "pendingDeposits" as const },
  { href: "/admin/transactions", label: "Transactions", iconName: "Receipt" as const },
  { href: "/admin/games", label: "Games", iconName: "Gamepad2" as const },
  { href: "/admin/orders", label: "Sifarişlər (hamısı)", iconName: "Receipt" as const, badgeKey: "pendingAllOrders" as const },
  {
    href: "/admin/game-orders",
    label: "Oyun çatdırılması",
    iconName: "ClipboardList" as const,
    badgeKey: "pendingGameOrders" as const,
  },
  { href: "/admin/banners", label: "Bannerlər", iconName: "ImageIcon" as const },
  { href: "/admin/faq", label: "FAQ", iconName: "HelpCircle" as const },
  { href: "/admin/services", label: "Gift Cardlar", iconName: "Gift" as const },
  { href: "/admin/ps-plus", label: "PS Plus", iconName: "Crown" as const },
  { href: "/admin/account-creation", label: "Hesab Açılışı", iconName: "UserPlus" as const },
  { href: "/admin/settings", label: "Settings", iconName: "SettingsIcon" as const },
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

  const pendingGameOrders = await prisma.transaction.count({
    where: { type: "PURCHASE", status: "PENDING", gameId: { not: null } },
  });

  const pendingServiceOrders = await prisma.transaction.count({
    where: { type: "SERVICE_PURCHASE", status: "PENDING" },
  });

  const badges = {
    pendingDeposits,
    pendingGameOrders,
    pendingAllOrders: pendingGameOrders + pendingServiceOrders,
  } as const;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-900 bg-zinc-950 md:block">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-900 px-5">
          <Logo href="/admin" height={26} />
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
            <ShieldCheck className="h-3 w-3" /> Admin
          </span>
        </div>
        <div className="border-b border-zinc-900 px-5 py-2 text-[11px] text-zinc-500">
          {user.email}
        </div>

        <AdminSidebar nav={NAV} badges={badges} />

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
