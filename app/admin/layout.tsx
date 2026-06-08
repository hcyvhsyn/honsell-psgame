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
      { href: "/admin/orders", label: "Sifarişlər", iconName: "ClipboardList", badgeKey: "pendingAllOrders" },
      { href: "/admin/transactions", label: "Tranzaksiyalar", iconName: "Receipt" },
      { href: "/admin/deposits", label: "Ödəniş Tələbləri", iconName: "Wallet", badgeKey: "pendingDeposits" },
      { href: "/admin/referrals", label: "Referal faizləri", iconName: "Percent" },
      { href: "/admin/discount-digest", label: "Endirim Bülleteni", iconName: "Megaphone" },
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
      { href: "/admin/ai-knowledge", label: "AI Bilik Bazası", iconName: "Brain" },
      { href: "/admin/ai-chat-logs", label: "AI Söhbətləri", iconName: "MessageSquare" },
      { href: "/admin/platform-guides", label: "Faydalı Başlıqlar", iconName: "ClipboardList" },
      { href: "/admin/reviews", label: "Oyun Rəyləri", iconName: "MessageSquare", badgeKey: "pendingReviews" },
      { href: "/admin/search-suggestions", label: "Populyar axtarışlar", iconName: "Search" },
    ],
  },
  {
    label: "PlayStation",
    iconName: "Gamepad2",
    items: [
      { href: "/admin/games", label: "Oyunlar", iconName: "Gamepad2" },
      { href: "/admin/sales", label: "Satışlar", iconName: "TrendingUp" },
      { href: "/admin/collections", label: "Kolleksiyalar", iconName: "LayoutGrid" },
      { href: "/admin/ps-plus", label: "PS Plus", iconName: "Crown" },
      { href: "/admin/ea-play", label: "EA Play", iconName: "Gamepad2" },
      { href: "/admin/services", label: "Hədiyyə Kartları", iconName: "Gift" },
      { href: "/admin/honsell-gift-cards", label: "Honsell Hədiyyə Kartı", iconName: "Gift" },
      { href: "/admin/account-creation", label: "Hesab Açılışı", iconName: "UserPlus" },
      { href: "/admin/subscriptions", label: "Abunəliklər", iconName: "Crown", badgeKey: "expiringSubs" },
    ],
  },
  {
    label: "Epic Games (PC)",
    iconName: "Monitor",
    items: [
      { href: "/admin/epic-games", label: "Epic kataloqu", iconName: "Monitor" },
    ],
  },
  {
    label: "Yayım",
    iconName: "Tv",
    items: [
      { href: "/admin/streaming", label: "Abunəliklər", iconName: "Tv" },
      { href: "/admin/streaming/titles", label: "Posterlər", iconName: "Tv" },
      { href: "/admin/streaming/scrape", label: "Kataloq Yığımı", iconName: "RefreshCw" },
      { href: "/admin/streaming-reviews", label: "İcmallar", iconName: "MessageSquare" },
    ],
  },
  {
    label: "Oyun-içi Vahid",
    iconName: "Coins",
    items: [
      { href: "/admin/pubg-uc", label: "PUBG UC", iconName: "Coins" },
      { href: "/admin/point-blank", label: "Point Blank TG", iconName: "Coins" },
    ],
  },
  {
    label: "Digər Platformalar",
    iconName: "LayoutGrid",
    items: [
      { href: "/admin/music", label: "Musiqi", iconName: "Music" },
      { href: "/admin/ai", label: "Süni İntellekt", iconName: "Brain" },
      { href: "/admin/work", label: "İş Platformaları", iconName: "Briefcase" },
    ],
  },
  {
    label: "Xidmətlər",
    iconName: "Briefcase",
    items: [
      {
        href: "/admin/website-applications",
        label: "Website Müraciətləri",
        iconName: "ClipboardList",
        badgeKey: "newWebsiteApplications",
      },
      {
        href: "/admin/website-add-ons",
        label: "Website Add-on-lar",
        iconName: "LayoutGrid",
      },
      {
        href: "/admin/website-pricing-config",
        label: "Website Qiymət Konfiqurasiyası",
        iconName: "SettingsIcon",
      },
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

  const newWebsiteApplications = await prisma.websiteServiceApplication
    .count({ where: { status: "NEW" } })
    .catch(() => 0);

  const badges = {
    pendingDeposits,
    pendingGameOrders,
    pendingAllOrders: pendingGameOrders + pendingServiceOrders,
    expiringSubs,
    pendingReviews,
    newWebsiteApplications,
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
