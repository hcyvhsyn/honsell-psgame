import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar, { type NavGroupSpec } from "./sidebar/AdminSidebar";

export const dynamic = "force-dynamic";

/**
 * Sidebar — məqsədyönlü qruplar (hər qrup tək iş üçündür). Qrup başlığının
 * altındakı `description` qrupun nə üçün olduğunu izah edir.
 *
 *   1. Gündəlik İş          — sifariş/ödəniş/balans əməliyyatları
 *   2. Müştərilər & Referal — istifadəçilər + affiliate faizləri
 *   3. Moderasiya           — rəy və icma paylaşımlarının yoxlanışı
 *   4. Məzmun & Marketinq   — vitrin, banner, xəbər, marketinq
 *   5. AI Köməkçi           — sayt AI köməkçisinin bilik bazası/loqları
 *   6. PlayStation kataloqu — PS oyunları, abunəlik, gift card, hesab
 *   7. Yayım                — streaming abunəlik/poster/kataloq
 *   8. Digər platformalar   — Epic, oyun-içi vahid, musiqi, AI/iş paketləri
 *   9. Website Xidməti      — sifarişlə website biznesi
 *  10. Sistem               — qlobal tənzimləmələr
 *
 * Diqqət: `/admin/ai` (Süni İntellekt) məhsul KATALOQUDUR (ChatGPT/Claude
 * satışı) — sayt AI köməkçisi (`ai-knowledge`/`ai-chat-logs`) ilə qarışdırma.
 *
 * Yeni admin səhifəsi əlavə olunduqda uyğun qrupa yazırsan — sidebar avtomatik
 * göstərir və active route məntiqi işləyir.
 */
const NAV_GROUPS: NavGroupSpec[] = [
  {
    label: "Gündəlik İş",
    iconName: "LayoutDashboard",
    description: "Sifariş, ödəniş və balans əməliyyatları",
    items: [
      { href: "/admin", label: "Dashboard", iconName: "LayoutDashboard" },
      { href: "/admin/orders", label: "Sifarişlər", iconName: "ClipboardList", badgeKey: "pendingAllOrders" },
      { href: "/admin/transactions", label: "Tranzaksiyalar", iconName: "Receipt" },
      { href: "/admin/subscriptions", label: "Aktiv Abunəliklər", iconName: "Crown", badgeKey: "expiringSubs" },
    ],
  },
  {
    label: "Müştərilər & Referal",
    iconName: "Users",
    description: "İstifadəçilər və affiliate komissiya faizləri",
    items: [
      { href: "/admin/users", label: "İstifadəçilər", iconName: "Users" },
      { href: "/admin/referral-tree", label: "Referral ağacı", iconName: "Network" },
      { href: "/admin/campaigns", label: "Reklam / Kampaniya", iconName: "Megaphone" },
      { href: "/admin/referrals", label: "Referal faizləri", iconName: "Percent" },
    ],
  },
  {
    label: "Moderasiya",
    iconName: "MessageSquare",
    description: "İstifadəçi rəyləri və icma paylaşımlarının yoxlanışı",
    items: [
      { href: "/admin/reviews", label: "Oyun Rəyləri", iconName: "MessageSquare", badgeKey: "pendingReviews" },
      { href: "/admin/testimonials", label: "Müştəri Rəyləri (Anasayfa)", iconName: "Star", badgeKey: "pendingTestimonials" },
      { href: "/admin/community", label: "İcma Paylaşımları", iconName: "MessageSquare", badgeKey: "pendingCommunity" },
      { href: "/admin/streaming-reviews", label: "Streaming İcmalları", iconName: "MessageSquare" },
    ],
  },
  {
    label: "Məzmun & Marketinq",
    iconName: "ImageIcon",
    description: "Vitrin, banner, xəbər və marketinq materialları",
    items: [
      { href: "/admin/banners", label: "Bannerlər", iconName: "ImageIcon" },
      { href: "/admin/subscription-packages", label: "Abunəlik Paketləri (Vitrin)", iconName: "Crown" },
      { href: "/admin/categories", label: "Kateqoriya şəkilləri", iconName: "LayoutGrid" },
      { href: "/admin/news", label: "Xəbərlər", iconName: "Newspaper" },
      { href: "/admin/faq", label: "FAQ", iconName: "HelpCircle" },
      { href: "/admin/platform-guides", label: "Faydalı Başlıqlar", iconName: "ClipboardList" },
      { href: "/admin/search-suggestions", label: "Populyar axtarışlar", iconName: "Search" },
      { href: "/admin/discount-digest", label: "Endirim Bülleteni", iconName: "Megaphone" },
    ],
  },
  {
    label: "AI Köməkçi",
    iconName: "Brain",
    description: "Sayt AI köməkçisinin bilik bazası və loqları",
    items: [
      { href: "/admin/ai-knowledge", label: "AI Bilik Bazası", iconName: "Brain" },
      { href: "/admin/ai-chat-logs", label: "AI Söhbətləri", iconName: "MessageSquare" },
    ],
  },
  {
    label: "PlayStation kataloqu",
    iconName: "Gamepad2",
    description: "PS oyunları, abunəlik, gift card və hesab xidmətləri",
    items: [
      { href: "/admin/games", label: "Oyunlar", iconName: "Gamepad2" },
      { href: "/admin/sales", label: "Satışlar", iconName: "TrendingUp" },
      { href: "/admin/collections", label: "Kolleksiyalar", iconName: "LayoutGrid" },
      { href: "/admin/ps-plus", label: "PS Plus", iconName: "Crown" },
      { href: "/admin/ea-play", label: "EA Play", iconName: "Gamepad2" },
      { href: "/admin/services", label: "PS TRY Gift Card", iconName: "Gift" },
      { href: "/admin/honsell-gift-cards", label: "Honsell Hədiyyə Kartı", iconName: "Gift" },
      { href: "/admin/account-creation", label: "Hesab Açılışı", iconName: "UserPlus" },
    ],
  },
  {
    label: "Yayım (Streaming)",
    iconName: "Tv",
    description: "Streaming abunəlikləri, posterlər və kataloq",
    items: [
      { href: "/admin/streaming", label: "Streaming Abunəlikləri", iconName: "Tv" },
      { href: "/admin/streaming/titles", label: "Posterlər", iconName: "Tv" },
      { href: "/admin/streaming/featured", label: "Streaming Banner", iconName: "ImageIcon" },
      { href: "/admin/streaming/scrape", label: "Kataloq Yığımı", iconName: "RefreshCw" },
    ],
  },
  {
    label: "Digər platformalar",
    iconName: "LayoutGrid",
    description: "Epic, oyun-içi vahid, musiqi, AI və iş paketləri",
    items: [
      { href: "/admin/epic-games", label: "Epic kataloqu", iconName: "Monitor" },
      { href: "/admin/pubg-uc", label: "PUBG UC", iconName: "Coins" },
      { href: "/admin/point-blank", label: "Point Blank TG", iconName: "Coins" },
      { href: "/admin/music", label: "Musiqi", iconName: "Music" },
      { href: "/admin/ai", label: "Süni İntellekt", iconName: "Brain" },
      { href: "/admin/work", label: "İş Platformaları", iconName: "Briefcase" },
    ],
  },
  {
    label: "Website Xidməti",
    iconName: "Briefcase",
    description: "Sifarişlə website — paketlər, müraciətlər, qiymət",
    items: [
      { href: "/admin/website-services", label: "Website Paketləri", iconName: "Briefcase" },
      {
        href: "/admin/website-applications",
        label: "Website Müraciətləri",
        iconName: "ClipboardList",
        badgeKey: "newWebsiteApplications",
      },
      { href: "/admin/website-add-ons", label: "Website Add-on-lar", iconName: "LayoutGrid" },
      {
        href: "/admin/website-pricing-config",
        label: "Website Qiymət Konfiqurasiyası",
        iconName: "SettingsIcon",
      },
    ],
  },
  {
    label: "Sistem",
    iconName: "SettingsIcon",
    description: "Qlobal tənzimləmələr (FX, kart, marjalar)",
    items: [
      { href: "/admin/settings", label: "Tənzimləmələr", iconName: "SettingsIcon" },
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

  const pendingCommunity = await prisma.communityPost
    .count({ where: { status: "PENDING" } })
    .catch(() => 0);

  const pendingTestimonials = await prisma.testimonial
    .count({ where: { isActive: false } })
    .catch(() => 0);

  const newWebsiteApplications = await prisma.websiteServiceApplication
    .count({ where: { status: "NEW" } })
    .catch(() => 0);

  const badges = {
    pendingDeposits,
    pendingGameOrders,
    pendingAllOrders: pendingGameOrders + pendingServiceOrders,
    expiringSubs,
    pendingReviews,
    pendingTestimonials,
    pendingCommunity,
    newWebsiteApplications,
  } as const;

  return (
    <div className="admin-theme flex min-h-screen flex-col bg-admin-bg text-zinc-900 md:flex-row">
      <AdminSidebar groups={NAV_GROUPS} badges={badges} userEmail={user.email} />

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
