import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar, { type NavSectionSpec } from "./sidebar/AdminSidebar";

export const dynamic = "force-dynamic";

/**
 * Sidebar — 5 bölmə, hər bölmədə tək işə xidmət edən qruplar. Bölmələr bir-birindən
 * vizual ayırıcı ilə ayrılır, qruplar açılıb-bağlanır (aktiv səhifənin qrupu həmişə
 * açıqdır). Sıra iş tezliyinə görədir: gündəlik əməliyyat → kataloq → müştəri/marketinq
 * → məzmun → sistem.
 *
 *   Əməliyyatlar          — Gündəlik iş, Analitika
 *   Kataloq               — PlayStation, Streaming, Digər məhsullar
 *   Müştəri və marketinq  — Müştərilər, Referal və bonuslar, Endirim və kampaniyalar
 *   Məzmun                — Vitrin, Məlumat səhifələri, Rəylər və moderasiya, AI köməkçi
 *   Sistem                — Tənzimləmələr
 *
 * Yeni admin səhifəsi əlavə olunduqda uyğun qrupa yazırsan — sidebar avtomatik
 * göstərir və active route məntiqi işləyir.
 */
const NAV_SECTIONS: NavSectionSpec[] = [
  {
    label: "Əməliyyatlar",
    groups: [
      {
        label: "Gündəlik iş",
        iconName: "LayoutDashboard",
        description: "Sifariş, ödəniş və balans əməliyyatları",
        items: [
          { href: "/admin", label: "Dashboard", iconName: "LayoutDashboard" },
          { href: "/admin/orders", label: "Sifarişlər", iconName: "ClipboardList", badgeKey: "pendingAllOrders" },
          { href: "/admin/deposits", label: "Balans artırma", iconName: "Wallet", badgeKey: "pendingDeposits" },
          { href: "/admin/transactions", label: "Tranzaksiyalar", iconName: "Receipt" },
          { href: "/admin/subscriptions", label: "Aktiv abunəliklər", iconName: "Crown", badgeKey: "expiringSubs" },
        ],
      },
      {
        label: "Analitika",
        iconName: "TrendingUp",
        description: "Satış göstəriciləri və huni",
        items: [
          { href: "/admin/sales", label: "Satışlar", iconName: "TrendingUp" },
          { href: "/admin/funnel", label: "Satış hunisi", iconName: "Filter" },
        ],
      },
    ],
  },
  {
    label: "Kataloq",
    groups: [
      {
        label: "PlayStation",
        iconName: "Gamepad2",
        description: "PS oyunları, abunəlik, gift card və hesab",
        items: [
          { href: "/admin/games", label: "Oyunlar", iconName: "Gamepad2" },
          { href: "/admin/collections", label: "Kolleksiyalar", iconName: "LayoutGrid" },
          { href: "/admin/ps-plus", label: "PS Plus", iconName: "Crown" },
          { href: "/admin/ea-play", label: "EA Play", iconName: "Gamepad2" },
          { href: "/admin/services", label: "PS TRY Gift Card", iconName: "Gift" },
          { href: "/admin/account-creation", label: "Hesab açılışı", iconName: "UserPlus" },
        ],
      },
      {
        label: "Streaming",
        iconName: "Tv",
        description: "Abunəliklər, dəstlər, posterlər və kataloq yığımı",
        items: [
          { href: "/admin/streaming", label: "Streaming abunəlikləri", iconName: "Tv" },
          { href: "/admin/service-bundles", label: "Xidmət dəstləri", iconName: "Package" },
          { href: "/admin/streaming/titles", label: "Posterlər", iconName: "Clapperboard" },
          { href: "/admin/streaming/scrape", label: "Kataloq yığımı", iconName: "RefreshCw" },
          { href: "/admin/streaming/hbomax", label: "HBO Max kollektor", iconName: "RefreshCw" },
        ],
      },
      {
        label: "Digər məhsullar",
        iconName: "LayoutGrid",
        description: "Musiqi, oyun-içi vahid, iş paketləri, hədiyyə kartı",
        items: [
          { href: "/admin/music", label: "Musiqi (Spotify)", iconName: "Music" },
          { href: "/admin/pubg-uc", label: "PUBG UC", iconName: "Coins" },
          { href: "/admin/point-blank", label: "Point Blank TG", iconName: "Coins" },
          { href: "/admin/work", label: "İş platformaları", iconName: "Briefcase" },
          { href: "/admin/honsell-gift-cards", label: "Honsell hədiyyə kartı", iconName: "Gift" },
        ],
      },
    ],
  },
  {
    label: "Müştəri və marketinq",
    groups: [
      {
        label: "Müştərilər",
        iconName: "Users",
        description: "İstifadəçilər və qiymət güdmə",
        items: [
          { href: "/admin/users", label: "İstifadəçilər", iconName: "Users" },
          { href: "/admin/price-watch", label: "Qiymət güdmə", iconName: "BellRing" },
        ],
      },
      {
        label: "Referal və bonuslar",
        iconName: "Network",
        description: "Affiliate komissiyaları və dəvət bonusları",
        items: [
          { href: "/admin/referrals", label: "Referal faizləri", iconName: "Percent" },
          { href: "/admin/referral-tree", label: "Referal ağacı", iconName: "Network" },
          { href: "/admin/invite-bonuses", label: "Dəvət bonusları", iconName: "Gift", badgeKey: "heldInviteBonuses" },
        ],
      },
      {
        label: "Endirim və kampaniyalar",
        iconName: "Megaphone",
        description: "Endirim kodları, fürsətlər, kampaniya və çəkilişlər",
        items: [
          { href: "/admin/promo-codes", label: "Endirim kodları", iconName: "TicketPercent" },
          { href: "/admin/flash-deals", label: "Fürsətləri qaçırma", iconName: "Zap" },
          { href: "/admin/campaigns", label: "Reklam / Kampaniya", iconName: "Megaphone" },
          { href: "/admin/discount-digest", label: "Endirim bülleteni", iconName: "Newspaper" },
          { href: "/admin/giveaways", label: "Çəkilişlər", iconName: "Gift" },
          { href: "/admin/loot-boxes", label: "Qutu açılışı", iconName: "Package" },
        ],
      },
    ],
  },
  {
    label: "Məzmun",
    groups: [
      {
        label: "Vitrin",
        iconName: "ImageIcon",
        description: "Ana səhifə, kateqoriyalar və videolar",
        items: [
          { href: "/admin/banners", label: "Bannerlər", iconName: "ImageIcon" },
          { href: "/admin/categories", label: "Kateqoriya şəkilləri", iconName: "LayoutGrid" },
          { href: "/admin/subscription-packages", label: "Abunəlik paketləri (vitrin)", iconName: "Crown" },
          { href: "/admin/search-suggestions", label: "Populyar axtarışlar", iconName: "Search" },
          { href: "/admin/reels", label: "Reels (videolar)", iconName: "Clapperboard" },
        ],
      },
      {
        label: "Məlumat səhifələri",
        iconName: "HelpCircle",
        description: "Xəbərlər, FAQ və bələdçilər",
        items: [
          { href: "/admin/news", label: "Xəbərlər", iconName: "Newspaper" },
          { href: "/admin/faq", label: "FAQ", iconName: "HelpCircle" },
          { href: "/admin/platform-guides", label: "Faydalı başlıqlar", iconName: "ClipboardList" },
          { href: "/admin/activation-steps", label: "Aktivləşdirmə addımları", iconName: "ListChecks" },
        ],
      },
      {
        label: "Rəylər və moderasiya",
        iconName: "MessageSquare",
        description: "Rəylərin və icma paylaşımlarının yoxlanışı",
        items: [
          { href: "/admin/reviews", label: "Oyun rəyləri", iconName: "MessageSquare", badgeKey: "pendingReviews" },
          { href: "/admin/testimonials", label: "Müştəri rəyləri (anasayfa)", iconName: "Star", badgeKey: "pendingTestimonials" },
          { href: "/admin/whatsapp-reviews", label: "WhatsApp rəy dəvəti", iconName: "MessageSquarePlus" },
          { href: "/admin/streaming-reviews", label: "Streaming icmalları", iconName: "MessageSquare" },
          { href: "/admin/community", label: "İcma paylaşımları", iconName: "MessageSquare", badgeKey: "pendingCommunity" },
        ],
      },
      {
        label: "AI köməkçi",
        iconName: "Brain",
        description: "Sayt AI köməkçisinin bilik bazası və söhbətləri",
        items: [
          { href: "/admin/ai-knowledge", label: "Bilik bazası", iconName: "Brain" },
          { href: "/admin/ai-chat-logs", label: "Söhbətlər", iconName: "MessageSquare" },
        ],
      },
    ],
  },
  {
    label: "Sistem",
    groups: [
      {
        label: "Tənzimləmələr",
        iconName: "SettingsIcon",
        description: "Qlobal tənzimləmələr (FX, kart, marjalar)",
        items: [{ href: "/admin/settings", label: "Tənzimləmələr", iconName: "SettingsIcon" }],
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

  const pendingCommunity = await prisma.communityPost
    .count({ where: { status: "PENDING" } })
    .catch(() => 0);

  const pendingTestimonials = await prisma.testimonial
    .count({ where: { isActive: false } })
    .catch(() => 0);

  const heldInviteBonuses = await prisma.referralInviteBonus
    .count({ where: { status: "HELD" } })
    .catch(() => 0);

  const badges = {
    pendingDeposits,
    pendingGameOrders,
    pendingAllOrders: pendingGameOrders + pendingServiceOrders,
    expiringSubs,
    pendingReviews,
    pendingTestimonials,
    pendingCommunity,
    heldInviteBonuses,
  } as const;

  return (
    <div className="admin-theme flex min-h-screen flex-col bg-admin-bg text-zinc-900 md:flex-row">
      <AdminSidebar sections={NAV_SECTIONS} badges={badges} userEmail={user.email} />

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
