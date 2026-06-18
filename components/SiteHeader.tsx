"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Coins,
  Crosshair,
  Flame,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  Grid2X2,
  Heart,
  CircleHelp,
  LogIn,
  Mail,
  MessageCircle,
  MessagesSquare,
  Monitor,
  Music2,
  Home,
  Search,
  ShoppingBag,
  Sparkles,
  Target,
  type LucideIcon,
  User,
  UserPlus,
  Video,
  Wallet,
  X,
} from "lucide-react";
import CartIndicator from "./CartIndicator";
import Logo from "./Logo";
import NavSearch from "./NavSearch";
import { useModals } from "@/lib/modals";
import {
  PRODUCT_CATEGORY_DEFINITIONS,
  type ProductCategoryNavAsset,
} from "@/lib/categoryAssets";

type NavLinkItem = {
  key?: string;
  href: string;
  label: string;
  description?: string;
  imageUrl?: string | null;
  Icon?: LucideIcon;
  iconClassName?: string;
  section?: "products" | "helpful";
  featured?: boolean;
  comingSoon?: boolean;
};

const CATEGORY_ICON_BY_KEY: Record<string, LucideIcon> = {
  PLAYSTATION_GAMES: Gamepad2,
  PS_PLUS: Gem,
  PS_TRY_GIFT_CARD: Gift,
  PSN_TURKEY_ACCOUNT: UserPlus,
  EPIC_GAMES: Monitor,
  NETFLIX: Video,
  YOUTUBE_PREMIUM: Music2,
  HBO_MAX: Video,
  GAIN: Video,
  EA_PLAY: Flame,
  PUBG_UC: Target,
  POINT_BLANK_TG: Crosshair,
  CHATGPT: Sparkles,
  CLAUDE: Sparkles,
  LINKEDIN_PREMIUM: BriefcaseBusiness,
  HONSELL_GIFT_CARD: Gift,
  MOVIE_SERIAL_CATALOG: Clapperboard,
  WEBSITE_SERVICE: Globe,
};

const FEATURED_CATEGORY_KEYS = new Set(["WEBSITE_SERVICE"]);

function buildProductCategoryItems(
  categoryAssets?: ProductCategoryNavAsset[] | null,
): NavLinkItem[] {
  const source =
    categoryAssets == null
      ? PRODUCT_CATEGORY_DEFINITIONS.map((item) => ({
          ...item,
          imageUrl: null,
          isActive: true,
        }))
      : categoryAssets;

  return source
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "az"))
    .map((item) => ({
      key: item.key,
      href: item.href,
      label: item.label,
      description: item.description ?? undefined,
      imageUrl: item.imageUrl,
      Icon: CATEGORY_ICON_BY_KEY[item.key] ?? Grid2X2,
      featured: FEATURED_CATEGORY_KEYS.has(item.key),
    }));
}

const utilityLinks: NavLinkItem[] = [
  {
    href: "/icma",
    label: "İcma",
    description: "Fikirlər, serial icmalları və referal",
    Icon: MessagesSquare,
    iconClassName: "text-sky-500 dark:text-sky-300",
  },
  {
    href: "/qazan",
    label: "Qazan",
    description: "Referal qazancı və hesablayıcı",
    Icon: Coins,
    iconClassName: "text-amber-500 dark:text-amber-300",
  },
  {
    href: "/bilmeli-olduglarin",
    label: "Bələdçilər",
    description: "Faydalı məqalələr və izahlar",
    Icon: MessageCircle,
    iconClassName: "text-indigo-500 dark:text-indigo-300",
  },
  {
    href: "/faq",
    label: "Yardım",
    description: "Sual-cavab mərkəzi",
    Icon: CircleHelp,
    iconClassName: "text-cyan-500 dark:text-cyan-300",
  },
  {
    href: "/haqqimizda",
    label: "Haqqımızda",
    description: "Honsell haqqında",
    Icon: User,
    iconClassName: "text-rose-500 dark:text-rose-300",
  },
];

const honsellGiftCardLink: NavLinkItem = {
  href: "/hediyye-kartlari/honsell",
  label: "Honsell Hədiyyə kartları",
  description: "Honsell hədiyyə kartları",
  Icon: Gift,
  iconClassName: "text-fuchsia-100",
  featured: true,
};

export default function SiteHeader({
  user,
  categoryAssets,
}: {
  user?: {
    name?: string | null;
    walletBalance?: number;
    cashbackBalanceCents?: number;
  } | null;
  categoryAssets?: ProductCategoryNavAsset[] | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopCategoriesOpen, setDesktopCategoriesOpen] = useState(false);
  const pathname = usePathname();
  const { open } = useModals();
  const productCategoryItems = buildProductCategoryItems(categoryAssets);

  // Prevent background scroll only for the mobile sheet; desktop categories stay in page flow.
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    if (!desktopCategoriesOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const panel = document.getElementById("desktop-categories-panel");
      const trigger = document.querySelector("[data-desktop-categories-trigger]");
      if (panel?.contains(target) || trigger?.contains(target)) return;

      setDesktopCategoriesOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [desktopCategoriesOpen]);

  useEffect(() => {
    setDesktopCategoriesOpen(false);
  }, [pathname]);

  function closeMobileCategories() {
    setMenuOpen(false);
  }

  function openAiAssistant() {
    window.dispatchEvent(new CustomEvent("honsell:open-ai"));
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/85 dark:bg-[#03030A]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="honsell-navbar-shell mx-auto flex w-full max-w-7xl flex-col rounded-[24px]">
          <div
            className="grid min-h-[66px] grid-cols-[auto_1fr] items-center gap-3 px-4 py-3 md:grid-cols-[150px_minmax(220px,1fr)_auto] md:px-5 xl:grid-cols-[170px_minmax(260px,1fr)_auto] xl:gap-4 xl:px-6"
            style={{ zIndex: 30 }}
          >
            <div className="flex min-w-0 items-center">
              <Logo href="/" height={28} priority className="h-6 w-auto xl:h-7" />
            </div>

            <div className="hidden min-w-0 md:block">
              <NavSearch />
            </div>

            <div className="flex min-w-0 items-center justify-end gap-2 xl:gap-3">
              <CartIndicator />

              {user ? (
                <UserAccountDropdown user={user} />
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
	                  <button
	                    type="button"
	                    onClick={() => open("login")}
	                    className="group honsell-nav-action inline-flex h-10 items-center gap-2 rounded-[18px] border border-zinc-200 bg-white/75 px-3 text-sm font-semibold text-zinc-900 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-zinc-100 dark:hover:bg-white/[0.075]"
	                  >
		                    <LogIn className="honsell-nav-icon-motion h-4 w-4 text-cyan-500 dark:text-cyan-300" /> Daxil ol
	                  </button>
	                  <button
	                    type="button"
	                    onClick={() => open("register")}
	                    className="group honsell-nav-action inline-flex h-10 items-center gap-2 rounded-[18px] bg-gradient-to-r from-violet-700 to-fuchsia-700 px-3 text-sm font-bold text-white shadow-[0_0_30px_-14px_rgba(124,58,237,0.9)] transition hover:from-violet-600 hover:to-fuchsia-600"
	                  >
		                    <UserPlus className="honsell-nav-icon-motion honsell-nav-icon-idle h-4 w-4 text-white" />
	                    Qeydiyyat
	                  </button>
                </div>
              )}

            </div>

            <div className="col-span-2 md:hidden">
              <NavSearch />
            </div>
          </div>

          <div
            className="hidden min-h-[64px] items-center justify-between gap-4 border-t border-zinc-200 px-6 dark:border-violet-300/15 xl:flex"
            style={{ zIndex: 20 }}
          >
            <nav className="flex min-w-0 flex-1 items-center gap-3" aria-label="Əsas naviqasiya">
              <CategoriesDropdown
                active={isAnyCategoryActive(productCategoryItems, pathname)}
                open={desktopCategoriesOpen}
                onToggle={() => setDesktopCategoriesOpen((value) => !value)}
                onClose={() => setDesktopCategoriesOpen(false)}
              />
              {utilityLinks.map((item) => (
                <DesktopNavLink key={item.href} item={item} pathname={pathname} />
              ))}
              <DesktopContactButton onClick={openAiAssistant} />
            </nav>

            <div className="ml-auto flex shrink-0 items-center">
              <DesktopNavLink item={honsellGiftCardLink} pathname={pathname} />
            </div>
          </div>

          {desktopCategoriesOpen && (
            <DesktopCategoryPanel
              items={productCategoryItems}
              pathname={pathname}
              onClose={() => setDesktopCategoriesOpen(false)}
            />
          )}
        </div>
      </header>

      <MobileBottomNav
        pathname={pathname}
        categoriesOpen={menuOpen}
        onOpenCategories={() => setMenuOpen(true)}
        onOpenAi={openAiAssistant}
      />

      {menuOpen && (
        <MobileCategorySheet
          items={productCategoryItems}
          pathname={pathname}
          onClose={closeMobileCategories}
        />
      )}
    </>
  );
}

function hrefMatches(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAnyCategoryActive(items: NavLinkItem[], pathname: string) {
  return items.some((item) => hrefMatches(pathname, item.href));
}

function DesktopNavLink({
  item,
  pathname,
}: {
  item: NavLinkItem;
  pathname: string;
}) {
  const active = hrefMatches(pathname, item.href);
  const Icon = item.Icon;
  const featured = item.featured;
  const iconColorClass = item.iconClassName ?? "text-violet-500 dark:text-violet-300";

  return (
    <Link
      href={item.href}
      className={`group honsell-nav-action relative inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[18px] border px-2.5 text-sm font-semibold transition ${
        featured
          ? "honsell-nav-featured-link border-violet-300/45 pl-3 pr-3.5 text-white"
          : active
            ? "honsell-nav-soft-link border-violet-300/25 bg-white/55 text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:bg-white/[0.055] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            : "honsell-nav-soft-link border-transparent text-zinc-700 hover:border-violet-300/25 hover:bg-white/45 hover:text-zinc-950 dark:text-zinc-200/90 dark:hover:border-violet-300/20 dark:hover:bg-white/[0.045] dark:hover:text-white"
      }`}
    >
      {Icon && (
        <Icon
          className={`honsell-nav-icon-motion h-4 w-4 shrink-0 ${
            featured ? "honsell-nav-gift-icon" : active ? "honsell-nav-icon-idle" : ""
          } ${iconColorClass}`}
          aria-hidden="true"
        />
      )}
      <span>{item.label}</span>
      {active && (
        <span className="honsell-nav-active-glow pointer-events-none absolute inset-x-2 -bottom-2 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
      )}
    </Link>
  );
}

function DesktopContactButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group honsell-nav-action honsell-nav-soft-link relative inline-flex h-10 items-center gap-2 rounded-[18px] border border-transparent px-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300/25 hover:bg-white/45 hover:text-zinc-950 dark:text-zinc-200/90 dark:hover:border-emerald-300/20 dark:hover:bg-white/[0.045] dark:hover:text-white"
    >
      <Mail
        className="honsell-nav-icon-motion h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-300"
        aria-hidden="true"
      />
      <span>Əlaqə</span>
    </button>
  );
}

function CategoriesDropdown({
  active,
  open,
  onToggle,
  onClose,
}: {
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        className={`group honsell-nav-action honsell-nav-soft-link relative inline-flex h-12 items-center gap-3 rounded-[18px] border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ${
          open
            ? "border-violet-400 bg-violet-500/10 text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            : active
              ? "border-transparent text-zinc-950 dark:text-white"
              : "border-transparent text-zinc-700 hover:text-zinc-950 dark:text-zinc-200/90 dark:hover:text-white"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="desktop-categories-panel"
        data-desktop-categories-trigger
      >
        {open ? (
          <X className="honsell-nav-icon-motion h-5 w-5 shrink-0 text-fuchsia-300" />
        ) : (
          <Grid2X2 className="honsell-nav-icon-motion honsell-nav-icon-idle h-5 w-5 shrink-0 text-violet-500 dark:text-violet-300" />
        )}
        <span className="relative z-10">Kateqoriyalar</span>
        {!open && (
          <ChevronDown className="honsell-nav-chevron relative z-10 h-4 w-4 text-violet-400" />
        )}
        {(active || open) && (
          <span className="honsell-nav-active-glow pointer-events-none absolute inset-x-2 -bottom-2 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
        )}
      </button>
    </div>
  );
}

function DesktopCategoryPanel({
  items,
  pathname,
  onClose,
}: {
  items: NavLinkItem[];
  pathname: string;
  onClose: () => void;
}) {
  return (
    <div
      id="desktop-categories-panel"
      className="relative mx-4 mb-4 hidden overflow-hidden rounded-[22px] border border-violet-300/20 bg-[radial-gradient(circle_at_18%_0%,rgba(124,58,237,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] text-white shadow-[0_22px_70px_-50px_rgba(124,58,237,0.9)] backdrop-blur-xl xl:block"
      role="menu"
      aria-label="Kateqoriyalar"
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/45 to-transparent" />
      <div
        className="max-h-[min(54dvh,34rem)] overflow-y-auto px-5 py-5"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-violet-300">
              <Grid2X2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-black tracking-tight text-white">Kateqoriyalar</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-400">
                {items.length} kateqoriya
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kateqoriyaları bağla"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-300 transition hover:bg-violet-500/25 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-4">
          {items.map((item) => (
            <CategoryMenuItem
              key={item.href}
              item={item}
              active={hrefMatches(pathname, item.href)}
              onNavigate={onClose}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryMenuItem({
  item,
  active,
  onNavigate,
}: {
  item: NavLinkItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.Icon ?? Grid2X2;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      role="menuitem"
      className={`group/card flex min-h-[78px] min-w-0 items-center gap-4 rounded-2xl border px-4 py-3 transition ${
        active
          ? "border-violet-400/65 bg-violet-500/12 text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "border-white/10 bg-white/[0.035] text-slate-100 hover:border-violet-300/45 hover:bg-white/[0.055]"
      }`}
    >
      <span
        className={`relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border ${
          active
            ? "border-violet-300/55 bg-violet-400/15 text-violet-100"
            : "border-white/10 bg-black/20 text-slate-200"
        }`}
      >
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : item.key === "PLAYSTATION_GAMES" ? (
          <PlayStationMark compact />
        ) : (
          <Icon className="h-6 w-6" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`truncate text-base font-black tracking-tight ${
              active ? "text-violet-300" : "text-white"
            }`}
          >
            {item.label}
          </span>
        </span>
        {item.description && (
          <span className="mt-0.5 line-clamp-1 text-sm font-semibold text-slate-400">
            {item.description}
          </span>
        )}
      </span>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
          active
            ? "bg-violet-500/20 text-violet-300"
            : "text-slate-600 group-hover/card:bg-white/[0.05] group-hover/card:text-slate-200"
        }`}
      >
        <ChevronRight className="h-5 w-5" />
      </span>
    </Link>
  );
}

function MobileBottomNav({
  pathname,
  categoriesOpen,
  onOpenCategories,
  onOpenAi,
}: {
  pathname: string;
  categoriesOpen: boolean;
  onOpenCategories: () => void;
  onOpenAi: () => void;
}) {
  const productsActive = hrefMatches(pathname, "/oyunlar");
  const profileActive = hrefMatches(pathname, "/profile");

  return (
    <nav
      className="honsell-mobile-bottom-nav fixed inset-x-0 bottom-0 z-[70] px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] xl:hidden"
      aria-label="Mobil naviqasiya"
    >
      <div className="relative mx-auto grid h-[78px] max-w-[30rem] grid-cols-[1fr_1fr_1.12fr_1fr_1fr] items-end rounded-t-[28px] border border-b-0 border-white/10 bg-[#10172a]/95 px-2 pt-3 shadow-[0_-22px_70px_-36px_rgba(79,70,229,0.75),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl">
        <MobileBottomNavItem
          href="/"
          label="Ana səhifə"
          Icon={Home}
          active={pathname === "/"}
          iconClassName="text-sky-300"
        />
        <MobileBottomNavItem
          label="Kateqoriyalar"
          Icon={Grid2X2}
          active={categoriesOpen}
          onClick={onOpenCategories}
          iconClassName="text-violet-300"
        />

	        <Link
	          href="/profile"
	          aria-current={profileActive ? "page" : undefined}
	          className="group honsell-nav-action -mt-8 flex min-w-0 flex-col items-center justify-end gap-1 text-center"
	        >
	          <span className="grid h-[58px] w-[58px] place-items-center rounded-full border-[6px] border-[#10172a] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_18px_42px_-18px_rgba(124,58,237,1)] transition group-active:scale-95">
	            <User className="honsell-nav-icon-motion h-6 w-6" />
	          </span>
          <span className="max-w-full truncate text-[11px] font-black leading-3 text-violet-100">
            Profilim
          </span>
        </Link>

        <MobileBottomNavItem
          href="/oyunlar"
          label="Məhsullar"
          Icon={ShoppingBag}
          active={productsActive}
          iconClassName="text-amber-300"
        />
        <MobileBottomNavItem
          label="AI bot"
          Icon={Bot}
          onClick={onOpenAi}
          accent
          iconClassName="text-emerald-300"
        />
      </div>
    </nav>
  );
}

function MobileBottomNavItem({
  href,
  label,
  Icon,
  active = false,
  accent = false,
  iconClassName,
  onClick,
}: {
  href?: string;
  label: string;
  Icon: LucideIcon;
  active?: boolean;
  accent?: boolean;
  iconClassName?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`relative grid h-9 w-11 place-items-center rounded-2xl transition ${
        active
          ? "bg-violet-500/20 text-violet-100"
          : accent
            ? "text-emerald-300"
            : "text-slate-400"
      }`}>
	        <Icon className={`honsell-nav-icon-motion h-5 w-5 ${active || accent ? "honsell-nav-icon-idle" : ""} ${iconClassName ?? ""}`} />
        {accent && (
          <span className="absolute right-1 top-0 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
        )}
      </span>
      <span className={`max-w-[76px] truncate text-[11px] font-black leading-3 ${
        active ? "text-violet-100" : "text-slate-400"
      }`}>
        {label}
      </span>
    </>
  );

  const className = "group honsell-nav-action flex min-w-0 flex-col items-center justify-end gap-1 pb-2 text-center transition active:scale-95";

  if (href) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-pressed={active}>
      {content}
    </button>
  );
}

function MobileCategorySheet({
  items,
  pathname,
  onClose,
}: {
  items: NavLinkItem[];
  pathname: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const cleanQuery = query.trim().toLocaleLowerCase("az");
  const filteredItems = cleanQuery
    ? items.filter((item) =>
        `${item.label} ${item.description ?? ""}`.toLocaleLowerCase("az").includes(cleanQuery)
      )
    : items;

  return (
    <div className="fixed inset-0 z-[120] xl:hidden" role="dialog" aria-modal="true" aria-label="Kateqoriyalar">
      <button
        type="button"
        aria-label="Kateqoriyaları bağla"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/65 backdrop-blur-sm"
      />

      <div
        className="absolute inset-x-0 bottom-0 mx-auto flex h-[min(86dvh,46rem)] max-w-[34rem] flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-white/10 bg-[#10172a] text-white shadow-[0_-28px_80px_-40px_rgba(99,102,241,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/10 px-5 pb-4 pt-3">
          <div className="mx-auto mb-5 h-1.5 w-20 rounded-full bg-white/[0.12]" />
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-violet-400/45 bg-violet-500/15 text-violet-200">
              <Grid2X2 className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-2xl font-black tracking-tight">Kateqoriyalar</p>
              <p className="mt-0.5 text-sm font-bold text-slate-400">
                {filteredItems.length} kateqoriya
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Bağla"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-white/10 px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kateqoriya axtar..."
              className="h-14 w-full rounded-[22px] border border-white/10 bg-white/[0.055] pl-12 pr-4 text-base font-bold text-white outline-none placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.075]"
            />
          </label>
        </div>

        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {filteredItems.map((item) => (
                <MobileCategorySheetCard
                  key={item.href}
                  item={item}
                  active={hrefMatches(pathname, item.href)}
                  onNavigate={onClose}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-[12rem] place-items-center rounded-2xl border border-white/10 bg-white/[0.035] px-6 text-center">
              <p className="text-sm font-semibold text-slate-400">Bu adda kateqoriya tapılmadı.</p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#10172a]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          <Link
            href="/oyunlar"
            onClick={onClose}
            className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-violet-500 to-fuchsia-500 text-base font-black text-white shadow-[0_18px_48px_-24px_rgba(168,85,247,1)] transition active:scale-[0.99]"
          >
            <Gamepad2 className="h-5 w-5" />
            Bütün məhsullar
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MobileCategorySheetCard({
  item,
  active,
  onNavigate,
}: {
  item: NavLinkItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.Icon ?? Grid2X2;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`group flex min-h-[76px] min-w-0 items-center gap-3 rounded-[20px] border px-3 py-3 transition active:scale-[0.99] ${
        active
          ? "border-violet-300/55 bg-violet-500/20"
          : "border-white/10 bg-white/[0.045] hover:border-violet-300/40 hover:bg-white/[0.065]"
      }`}
    >
      <span className={`relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border ${
        active
          ? "border-violet-300/50 bg-violet-400/20 text-violet-100"
          : "border-white/10 bg-black/20 text-slate-200"
      }`}>
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        ) : item.key === "PLAYSTATION_GAMES" ? (
          <PlayStationMark compact />
        ) : (
          <Icon className="h-5 w-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-white">
          {item.label}
        </span>
        {item.description && (
          <span className="mt-0.5 block truncate text-xs font-semibold text-slate-400">
            {item.description}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-200" />
    </Link>
  );
}

function UserAccountDropdown({
  user,
}: {
  user: {
    name?: string | null;
    walletBalance?: number;
    cashbackBalanceCents?: number;
  };
}) {
  const wallet =
    typeof user.walletBalance === "number" ? user.walletBalance / 100 : null;
  const cashback =
    typeof user.cashbackBalanceCents === "number"
      ? user.cashbackBalanceCents / 100
      : null;

  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }

  function scheduleHide() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      className="relative hidden sm:inline-flex"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
    >
      <Link
        href="/profile"
        className="group honsell-nav-action flex h-10 max-w-[180px] items-center gap-2 rounded-[18px] border border-zinc-200 bg-white/75 px-3 text-sm font-bold text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:border-violet-400/35 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:bg-white/[0.075]"
        aria-label="Hesab menyusu"
      >
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-violet-50 text-rose-600 dark:bg-white/5 dark:text-rose-300">
          <User className="honsell-nav-icon-motion honsell-nav-icon-idle h-4 w-4" />
        </span>
        <span className="truncate">{user.name?.split(" ")[0] ?? "Hesab"}</span>
        <ChevronDown className="honsell-nav-chevron h-4 w-4 shrink-0 text-violet-400" />
      </Link>

      <div
        className={`absolute right-0 top-full z-[80] w-[330px] max-w-[calc(100vw-2rem)] pt-3 transition-opacity duration-150 ${
          open ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
        }`}
      >
        <div className="relative overflow-hidden rounded-[20px] border border-violet-300/45 bg-[radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.97))] p-3 shadow-[0_22px_70px_-34px_rgba(124,58,237,0.45)] backdrop-blur-2xl dark:border-violet-400/[0.45] dark:bg-[radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.22),transparent_34%),linear-gradient(135deg,rgba(17,19,32,0.98),rgba(5,7,15,0.97))] dark:shadow-[0_22px_70px_-34px_rgba(168,85,247,0.78)]">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-8 bottom-0 h-14 bg-violet-700/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3 px-1 pb-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-violet-300/45 bg-violet-100 text-violet-700 shadow-[0_0_28px_-18px_rgba(168,85,247,0.65)] dark:border-violet-400/[0.45] dark:bg-violet-950/30 dark:text-white">
                <User className="honsell-nav-icon-motion h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-zinc-950 dark:text-white">
                  {user.name?.split(" ")[0] ?? "Hesab"}
                </p>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Hesab paneli
                </p>
              </div>
            </div>

            {(wallet !== null || (cashback !== null && cashback > 0)) && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {wallet !== null && (
                  <Link
                    href="/profile/wallet"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 transition hover:border-violet-300/40 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.065]"
                  >
                    <span className="flex items-center gap-2 text-[11px] font-black uppercase text-violet-600 dark:text-violet-300">
                      <Wallet className="honsell-nav-icon-motion h-3.5 w-3.5" />
                      Cüzdan
                    </span>
                    <span className="mt-1 block text-base font-black tabular-nums text-zinc-950 dark:text-white">
                      {wallet.toFixed(2)} ₼
                    </span>
                  </Link>
                )}

                {cashback !== null && cashback > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.035]">
                    <span className="flex items-center gap-2 text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-300">
                      <Gem className="honsell-nav-icon-motion h-3.5 w-3.5" />
                      Cashback
                    </span>
                    <span className="mt-1 block text-base font-black tabular-nums text-zinc-950 dark:text-white">
                      {cashback.toFixed(2)} ₼
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <AccountMenuItem href="/profile" icon={User} label="Hesabım" onClick={() => setOpen(false)} />
              <AccountMenuItem href="/profile/favorites" icon={Heart} label="Favoritlərim" featured onClick={() => setOpen(false)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountMenuItem({
  href,
  icon: Icon,
  label,
  featured = false,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group/item flex min-h-[48px] items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${
        featured
          ? "border-rose-400/55 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-100 dark:hover:bg-rose-500/[0.15]"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300/40 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-100 dark:hover:bg-white/[0.065]"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
          featured
            ? "border-rose-300/30 bg-rose-100 text-rose-600 dark:bg-rose-300/[0.15] dark:text-rose-200"
            : "border-zinc-200 bg-violet-50 text-violet-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-violet-100"
        }`}
      >
        <Icon className="honsell-nav-icon-motion h-4 w-4" />
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm font-black ${featured ? "text-rose-600 dark:text-rose-200" : "text-zinc-950 dark:text-white"}`}>
        {label}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover/item:translate-x-1 group-hover/item:text-zinc-950 dark:text-zinc-300 dark:group-hover/item:text-white" />
    </Link>
  );
}

function PlayStationMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`font-black ${compact ? "text-[13px]" : "text-base"}`}
      aria-hidden="true"
    >
      PS
    </span>
  );
}
