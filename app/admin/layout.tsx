import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "./sidebar/AdminSidebar";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard", iconName: "LayoutDashboard" as const },
  { href: "/admin/users", label: "Users", iconName: "Users" as const },
  { href: "/admin/deposits", label: "Deposits", iconName: "Wallet" as const, badgeKey: "pendingDeposits" as const },
  { href: "/admin/transactions", label: "Transactions", iconName: "Receipt" as const },
  { href: "/admin/subscriptions", label: "Abunəliklər", iconName: "Crown" as const, badgeKey: "expiringSubs" as const },
  { href: "/admin/games", label: "Games", iconName: "Gamepad2" as const },
  { href: "/admin/orders", label: "Sifarişlər (hamısı)", iconName: "Receipt" as const, badgeKey: "pendingAllOrders" as const },
  { href: "/admin/banners", label: "Bannerlər", iconName: "ImageIcon" as const },
  { href: "/admin/reviews", label: "Rəylər", iconName: "MessageSquare" as const, badgeKey: "pendingReviews" as const },
  { href: "/admin/collections", label: "Kolleksiyalar", iconName: "LayoutGrid" as const },
  { href: "/admin/faq", label: "FAQ", iconName: "HelpCircle" as const },
  { href: "/admin/referral-tiers", label: "Referal Pillələri", iconName: "Crown" as const },
  { href: "/admin/services", label: "Gift Cardlar", iconName: "Gift" as const },
  { href: "/admin/ps-plus", label: "PS Plus", iconName: "Crown" as const },
  { href: "/admin/streaming", label: "Streaming", iconName: "Tv" as const },
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

  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const expiringSubs = await prisma.subscription.count({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: in3Days },
    },
  });

  const pendingReviews = await prisma.gameReview.count({
    where: { status: "PENDING" },
  });

  const badges = {
    pendingDeposits,
    pendingGameOrders,
    pendingAllOrders: pendingGameOrders + pendingServiceOrders,
    expiringSubs,
    pendingReviews,
  } as const;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 md:flex-row">
      <AdminSidebar nav={NAV} badges={badges} userEmail={user.email} />

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
