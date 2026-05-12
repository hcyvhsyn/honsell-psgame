import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar, { type NavGroupSpec } from "./sidebar/AdminSidebar";

export const dynamic = "force-dynamic";

/**
 * Sidebar yenidən-strukturu — sıralı qruplar:
 *   • Ümumi — kross-bölmə menecment (istifadəçilər, sifarişlər, settings...)
 *   • Məzmun — homepage və scope-lu məzmun (banner, FAQ, guide-lar, rəylər)
 *   • PlayStation — yalnız PS məhsulları
 *   • Yayım Platformaları — streaming xidmətləri və icmallar
 *   • Musiqi / Süni İntellekt / İş Platformaları — admin məhsul paketləri
 *
 * Yeni admin səhifəsi əlavə olunduqda burada uyğun qrupa yazırsan — sidebar
 * avtomatik göstərir və active route məntiqi işləyir.
 */
const NAV_GROUPS: NavGroupSpec[] = [
  {
    label: "Ümumi",
    iconName: "LayoutDashboard",
    items: [
      { href: "/admin", label: "Dashboard", iconName: "LayoutDashboard" },
      { href: "/admin/users", label: "İstifadəçilər", iconName: "Users" },
      { href: "/admin/deposits", label: "Ödəniş Tələbləri", iconName: "Wallet", badgeKey: "pendingDeposits" },
      { href: "/admin/transactions", label: "Tranzaksiyalar", iconName: "Receipt" },
      { href: "/admin/orders", label: "Sifarişlər", iconName: "Receipt", badgeKey: "pendingAllOrders" },
      { href: "/admin/referrals", label: "Referal faizləri", iconName: "Percent" },
      { href: "/admin/settings", label: "Tənzimləmələr", iconName: "SettingsIcon" },
    ],
  },
  {
    label: "Məzmun",
    iconName: "ImageIcon",
    items: [
      { href: "/admin/banners", label: "Bannerlər", iconName: "ImageIcon" },
      { href: "/admin/news", label: "Xəbərlər", iconName: "Newspaper" },
      { href: "/admin/faq", label: "FAQ", iconName: "HelpCircle" },
      { href: "/admin/platform-guides", label: "Faydalı Başlıqlar", iconName: "ClipboardList" },
      { href: "/admin/reviews", label: "Oyun Rəyləri", iconName: "MessageSquare", badgeKey: "pendingReviews" },
    ],
  },
  {
    label: "PlayStation",
    iconName: "Gamepad2",
    items: [
      { href: "/admin/games", label: "Oyunlar", iconName: "Gamepad2" },
      { href: "/admin/collections", label: "Kolleksiyalar", iconName: "LayoutGrid" },
      { href: "/admin/ps-plus", label: "PS Plus", iconName: "Crown" },
      { href: "/admin/services", label: "Hədiyyə Kartları", iconName: "Gift" },
      { href: "/admin/account-creation", label: "Hesab Açılışı", iconName: "UserPlus" },
      { href: "/admin/subscriptions", label: "Abunəliklər", iconName: "Crown", badgeKey: "expiringSubs" },
    ],
  },
  {
    label: "Yayım Platformaları",
    iconName: "Tv",
    items: [
      { href: "/admin/streaming", label: "Abunəliklər", iconName: "Tv" },
      { href: "/admin/streaming/titles", label: "Posterlər", iconName: "Tv" },
      { href: "/admin/streaming-reviews", label: "İcmallar", iconName: "MessageSquare" },
    ],
  },
  {
    label: "Musiqi Platformaları",
    iconName: "Music",
    items: [
      { href: "/admin/music", label: "Abunəliklər", iconName: "Music" },
    ],
  },
  {
    label: "Süni İntellekt",
    iconName: "Brain",
    items: [
      { href: "/admin/ai", label: "Abunəliklər", iconName: "Brain" },
    ],
  },
  {
    label: "İş Platformaları",
    iconName: "Briefcase",
    items: [
      { href: "/admin/work", label: "Abunəliklər", iconName: "Briefcase" },
    ],
  },
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
    where: { type: "DEPOSIT", status: "PENDING", receiptUrl: { not: null } },
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
      <AdminSidebar groups={NAV_GROUPS} badges={badges} userEmail={user.email} />

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
