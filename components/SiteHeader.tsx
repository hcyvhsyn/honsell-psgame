"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Coins,
  Crosshair,
  Flame,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  Grid2X2,
  Heart,
  LogIn,
  Menu,
  MessageCircle,
  Monitor,
  Music2,
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

const BRAND_PURPLE = "#6301F3";
const BRAND_PURPLE_DARK = "#2D006F";

type NavLinkItem = {
  href: string;
  label: string;
  description?: string;
  Icon?: LucideIcon;
  section?: "products" | "helpful";
  featured?: boolean;
  comingSoon?: boolean;
};

type NavGroup = {
  label: string;
  Icon: LucideIcon;
  href?: string; // Group başlığını klikləməklə dropdown-un əsas səhifəsinə keçid.
  description?: string;
  items: NavLinkItem[];
};

// Yeni 6-kateqoriyalı naviqasiya. Hər kateqoriya dropdown-dur və aktiv public
// səhifəyə aparır.
const playstationGroup: NavGroup = {
  label: "PlayStation",
  Icon: Gamepad2,
  href: "/playstation",
  description: "Oyunlar, abunəliklər və faydalı keçidlər",
  items: [
    {
      href: "/oyunlar",
      label: "Oyunlar",
      description: "PS4 və PS5 rəqəmsal oyunları",
      Icon: Gamepad2,
      section: "products",
    },
    {
      href: "/ps-plus",
      label: "PS Plus",
      description: "Essential, Extra və Deluxe paketləri",
      Icon: Gem,
      section: "products",
    },
    {
      href: "/ea-play",
      label: "EA Play",
      description: "EA oyun kolleksiyası və sınaq",
      Icon: Flame,
      section: "products",
    },
    {
      href: "/hediyye-kartlari",
      label: "Hədiyyə Kartları",
      description: "PSN və Honsell gift card-ları",
      Icon: Gift,
      section: "products",
    },
    {
      href: "/hesab-acma",
      label: "Hesab Açma",
      description: "Türkiyə PSN hesabı yarat",
      Icon: UserPlus,
      section: "products",
    },
    {
      href: "/kolleksiyalar",
      label: "Kolleksiyalar",
      description: "Seçilmiş oyun siyahıları",
      Icon: Grid2X2,
      section: "products",
    },
    {
      href: "/reyler",
      label: "Rəylər",
      description: "Müştəri təcrübələri",
      Icon: MessageCircle,
      section: "helpful",
    },
    {
      href: "/profile/favorites",
      label: "Favoritlərim",
      description: "Sevdiyin məhsullara bax",
      Icon: Heart,
      section: "helpful",
    },
  ],
};

const pcGamesGroup: NavGroup = {
  label: "PC Oyunları",
  Icon: Monitor,
  href: "/epic-games",
  description: "Epic Games Store rəqəmsal PC oyunları",
  items: [
    {
      href: "/epic-games",
      label: "Epic Games",
      description: "Epic Games Store oyun kataloqu",
      Icon: Monitor,
      section: "products",
    },
  ],
};

const inGameCreditGroup: NavGroup = {
  label: "Oyun-içi Vahid",
  Icon: Coins,
  description: "Mobil oyunlar üçün UC, TG və digər vahid paketləri",
  items: [
    {
      href: "/pubg-uc",
      label: "PUBG UC",
      description: "PUBG Mobile üçün UC paketləri",
      Icon: Target,
      section: "products",
    },
    {
      href: "/point-blank",
      label: "Point Blank TG",
      description: "Point Blank üçün TG paketləri",
      Icon: Crosshair,
      section: "products",
    },
  ],
};

const streamingGroup: NavGroup = {
  label: "Yayım",
  Icon: Video,
  href: "/streaming",
  description: "Streaming xidmətləri, icmallar və izləmə listi",
  items: [
    {
      href: "/streaming",
      label: "Bütün xidmətlər",
      description: "Aktiv streaming paketləri",
      Icon: Video,
      section: "products",
    },
    {
      href: "/streaming/netflix",
      label: "Netflix",
      description: "Film və serial platforması",
      Icon: Video,
      section: "products",
    },
    {
      href: "/streaming/hbo-max",
      label: "HBO Max",
      description: "Premium film və serial arxivi",
      Icon: Video,
      section: "products",
    },
    {
      href: "/streaming/gain",
      label: "Gain",
      description: "Yerli və xarici kontent",
      Icon: Video,
      section: "products",
    },
    {
      href: "/streaming/icmallar",
      label: "İcmallar",
      description: "Baxışlar və tövsiyələr",
      Icon: MessageCircle,
      section: "helpful",
    },
    {
      href: "/streaming/izleme-listim",
      label: "İzləmə Listim",
      description: "Seçdiklərini saxla",
      Icon: Heart,
      section: "helpful",
    },
  ],
};

const musicGroup: NavGroup = {
  label: "Musiqi",
  Icon: Music2,
  href: "/music",
  description: "Premium musiqi və video paketləri",
  items: [
    {
      href: "/music",
      label: "Bütün musiqi paketləri",
      description: "Musiqi xidmətlərinə bax",
      Icon: Music2,
    },
    {
      href: "/music/youtube",
      label: "YouTube Premium",
      description: "Reklamsız video və musiqi",
      Icon: Video,
    },
  ],
};

const workGroup: NavGroup = {
  label: "İş",
  Icon: BriefcaseBusiness,
  href: "/work",
  description: "Peşəkar platformalar və karyera alətləri",
  items: [
    {
      href: "/work",
      label: "İş platformaları",
      description: "Peşəkar hesab xidmətləri",
      Icon: BriefcaseBusiness,
    },
    {
      href: "/work/linkedin-premium",
      label: "LinkedIn Premium",
      description: "LinkedIn paketləri",
      Icon: BriefcaseBusiness,
    },
  ],
};

const aiGroup: NavGroup = {
  label: "AI",
  Icon: Sparkles,
  href: "/ai",
  description: "Süni intellekt paketləri və brendlər",
  items: [
    {
      href: "/ai",
      label: "Süni intellekt paketləri",
      description: "AI alətlərinə giriş",
      Icon: Sparkles,
    },
    {
      href: "/ai/claude",
      label: "Claude",
      description: "Claude AI paketləri",
      Icon: Sparkles,
    },
    {
      href: "/ai/chatgpt",
      label: "ChatGPT",
      description: "ChatGPT paketləri",
      Icon: Sparkles,
    },
  ],
};

const servicesGroup: NavGroup = {
  label: "Xidmətlər",
  Icon: Globe,
  href: "/xidmetler",
  description: "Biznes üçün rəqəmsal xidmətlər",
  items: [
    {
      href: "/xidmetler/website",
      label: "Website Hazırlanması",
      description: "Bizneslər üçün satış yönümlü saytlar",
      Icon: Globe,
      section: "products",
      featured: true,
    },
  ],
};

const otherGroup: NavGroup = {
  label: "Digər",
  Icon: Grid2X2,
  description: "Bələdçilər və sayt məlumatları",
  items: [
    {
      href: "/bilmeli-olduglarin",
      label: "Bələdçilər",
      description: "Faydalı məqalələr",
      Icon: MessageCircle,
    },
    {
      href: "/haqqimizda",
      label: "Haqqımızda",
      description: "Honsell haqqında",
      Icon: User,
    },
    {
      href: "/mexfilik-siyaseti",
      label: "Məxfilik siyasəti",
      description: "Məlumat təhlükəsizliyi",
      Icon: Globe,
    },
  ],
};

const navGroups: NavGroup[] = [
  playstationGroup,
  pcGamesGroup,
  inGameCreditGroup,
  streamingGroup,
  musicGroup,
  workGroup,
  aiGroup,
  servicesGroup,
  otherGroup,
];

// Mobile drawer flattens the groups but keeps section headings.
const mobileSections: { heading?: string; items: NavLinkItem[] }[] = navGroups.map((g) => ({
  heading: g.label,
  items: g.items,
}));

export default function SiteHeader({
  user,
}: {
  user?: {
    name?: string | null;
    walletBalance?: number;
    cashbackBalanceCents?: number;
  } | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { open } = useModals();
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Mobil header bar-ın hündürlüyü dəyişkəndir (axtarış sətri ayrı sətirə düşür,
  // simulyatorda safe-area da əlavə olunur). Drawer-i həmin hündürlüyə kilidlə­yi­
  // rik ki, üst tərəfi header-in altında kəsilməsin.
  useLayoutEffect(() => {
    const node = headerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const update = () => setHeaderHeight(node.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-50 bg-white/85 dark:bg-[#03030A]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
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

              <Link
                href="/hediyye-kartlari/honsell"
                className="hidden h-10 items-center gap-2 rounded-[18px] border border-violet-300/40 bg-violet-50 px-3 text-sm font-bold text-violet-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:bg-violet-100 dark:border-violet-400/30 dark:bg-violet-950/30 dark:text-white dark:hover:bg-violet-900/40 sm:inline-flex"
              >
                <Gift className="h-4 w-4" />
                <span>Hədiyyə kartları</span>
              </Link>

              {user ? (
                <UserAccountDropdown user={user} />
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => open("login")}
                    className="inline-flex h-10 items-center gap-2 rounded-[18px] border border-zinc-200 bg-white/75 px-3 text-sm font-semibold text-zinc-900 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-zinc-100 dark:hover:bg-white/[0.075]"
                  >
                    <LogIn className="h-4 w-4" /> Daxil ol
                  </button>
                  <button
                    type="button"
                    onClick={() => open("register")}
                    className="inline-flex h-10 items-center gap-2 rounded-[18px] bg-gradient-to-r from-violet-700 to-fuchsia-700 px-3 text-sm font-bold text-white shadow-[0_0_30px_-14px_rgba(124,58,237,0.9)] transition hover:from-violet-600 hover:to-fuchsia-600"
                  >
                    <UserPlus className="h-4 w-4" />
                    Qeydiyyat
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-zinc-200 bg-white/75 text-zinc-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-zinc-200 dark:hover:bg-white/[0.075] xl:hidden"
                aria-label="Menyu"
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            <div className="col-span-2 md:hidden">
              <NavSearch />
            </div>
          </div>

          <div
            className="hidden min-h-[64px] items-center justify-between gap-4 border-t border-zinc-200 px-6 dark:border-violet-300/15 xl:flex"
            style={{ zIndex: 20 }}
          >
            <nav className="flex min-w-0 items-center gap-5" aria-label="Əsas naviqasiya">
              {navGroups.map((g) => (
                <NavDropdown key={g.label} group={g} active={isGroupActive(g, pathname)} pathname={pathname} />
              ))}
            </nav>

          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true" aria-label="Menyu">
          <button
            type="button"
            aria-label="Menyunu bağla"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
          />
          <div
            className="absolute inset-x-0 flex flex-col overflow-hidden rounded-b-3xl border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#09090C] shadow-2xl"
            style={{
              top: headerHeight || undefined,
              maxHeight: headerHeight
                ? `calc(100dvh - ${headerHeight}px)`
                : "calc(100dvh - 7.5rem)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="grid gap-5">
                {/* Account block — always at the top so primary action is reachable */}
                {user ? (
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-r from-violet-50 to-white p-3 dark:border-white/10 dark:from-white/[0.06] dark:to-white/[0.02]"
                  >
                    <span
                      className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br text-white"
                      style={{ backgroundImage: `linear-gradient(135deg, ${BRAND_PURPLE}, ${BRAND_PURPLE_DARK})` }}
                    >
                      <User className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                        {user.name ?? "Hesab"}
                      </p>
                      {user.walletBalance !== undefined && (
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          Cüzdan {(user.walletBalance / 100).toFixed(2)} ₼
                          {typeof user.cashbackBalanceCents === "number" && user.cashbackBalanceCents > 0
                            ? ` · CB ${(user.cashbackBalanceCents / 100).toFixed(2)} ₼`
                            : ""}
                        </p>
                      )}
                    </div>
                    <span className="text-zinc-500">→</span>
                  </Link>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); open("login"); }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10"
                    >
                      <LogIn className="h-4 w-4" /> Daxil ol
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); open("register"); }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-16px_rgba(99,1,243,0.95)]"
                      style={{ backgroundImage: `linear-gradient(90deg, ${BRAND_PURPLE}, ${BRAND_PURPLE_DARK})` }}
                    >
                      <UserPlus className="h-4 w-4" /> Qeydiyyat
                    </button>
                  </div>
                )}

                {/* Nav sections */}
                {mobileSections.map((section, idx) => (
                  <div key={section.heading ?? `section-${idx}`} className="grid gap-2">
                    {section.heading && (
                      <p className="px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        {section.heading}
                      </p>
                    )}
                    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.02]">
                      {section.items.map((item, i) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition hover:bg-violet-50 active:bg-zinc-100 dark:hover:bg-white/[0.05] dark:active:bg-white/10 ${
                            i > 0 ? "border-t border-zinc-200 dark:border-white/5" : ""
                          } ${item.featured ? "text-rose-600 dark:text-rose-200" : "text-zinc-700 dark:text-zinc-200"}`}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="flex items-center gap-2">
                            {item.comingSoon && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-300/40 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-300/30">
                                Tezliklə
                              </span>
                            )}
                            <span className="text-zinc-400 dark:text-zinc-600">→</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function hrefMatches(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(group: NavGroup, pathname: string) {
  if (group.href && hrefMatches(pathname, group.href)) return true;
  return group.items.some((item) => hrefMatches(pathname, item.href));
}

function NavDropdown({
  group,
  active,
  pathname,
}: {
  group: NavGroup;
  active: boolean;
  pathname: string;
}) {
  // Dropdown title-i qrupun əsas səhifəsinə (varsa) link-ə çevrilir; əks halda
  // sadəcə görsəl trigger düymədir. ChevronDown panelin açıldığını göstərir.
  const hasSectionedItems = group.items.some((item) => item.section);
  const productItems = group.items.filter((item) => item.section !== "helpful");
  const helpfulItems = group.items.filter((item) => item.section === "helpful");
  const sections = hasSectionedItems
    ? [
        { title: "SATIŞ MƏHSULLARI", items: productItems },
        { title: "FAYDALI BÖLMƏLƏR", items: helpfulItems },
      ].filter((section) => section.items.length > 0)
    : [{ title: "BÖLMƏLƏR", items: group.items }];
  const triggerClass =
    `relative inline-flex h-10 items-center gap-2 rounded-[18px] px-1 text-sm font-semibold transition group-focus-within:text-zinc-900 dark:group-focus-within:text-white ${
      active
        ? "text-zinc-900 dark:text-white"
        : "text-zinc-700 dark:text-zinc-200/90 hover:text-zinc-900 dark:hover:text-white"
    }`;
  const Icon = group.Icon;

  // Panel sabit enlidir (520px). Ən sağdakı qruplarda `left-0` ilə açılsa panel
  // ekranın sağ kənarından kənara çıxır. Triggerin viewport-dakı yerini ölçüb,
  // sağa daşacaqsa paneli `right-0`-a keçirib sola doğru açırıq.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [alignRight, setAlignRight] = useState(false);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const PANEL_WIDTH = 520;
    const MARGIN = 24; // max-w-[calc(100vw-3rem)] ilə eyni boşluq
    const update = () => {
      const left = node.getBoundingClientRect().left;
      setAlignRight(left + PANEL_WIDTH > window.innerWidth - MARGIN);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const triggerContent = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-zinc-700 dark:text-zinc-100" />
      <span className="relative z-10">{group.label}</span>
      <ChevronDown className="relative z-10 h-4 w-4 text-violet-400" />
      {active && (
        <span className="pointer-events-none absolute inset-x-2 -bottom-2 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
      )}
    </>
  );

  return (
    <div ref={containerRef} className="group relative">
      {group.href ? (
        <Link href={group.href} className={triggerClass}>
          {triggerContent}
        </Link>
      ) : (
        <button type="button" className={triggerClass}>
          {triggerContent}
        </button>
      )}
      {/*
        Wrapper-in `pt-3`-ı vizual boşluğu (12px) saxlayır, amma boşluq özü
        hover hədəfidir — kursor triggerdən panelə keçəndə group hover-i
        kəsilmir.
      */}
      <div className={`invisible absolute top-full z-50 w-[520px] max-w-[calc(100vw-3rem)] pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${alignRight ? "right-0" : "left-0"}`}>
        <div className="relative overflow-hidden rounded-[20px] border border-violet-300/45 bg-[radial-gradient(circle_at_7%_7%,rgba(168,85,247,0.10),transparent_31%),radial-gradient(circle_at_94%_10%,rgba(59,130,246,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.97))] p-4 shadow-[0_22px_70px_-42px_rgba(124,58,237,0.35)] backdrop-blur-2xl dark:border-violet-400/[0.45] dark:bg-[radial-gradient(circle_at_7%_7%,rgba(168,85,247,0.24),transparent_31%),radial-gradient(circle_at_94%_10%,rgba(59,130,246,0.16),transparent_28%),linear-gradient(135deg,rgba(17,19,32,0.98),rgba(5,7,15,0.97))] dark:shadow-[0_22px_70px_-34px_rgba(168,85,247,0.85)]">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-8 bottom-0 h-16 bg-violet-700/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3 pb-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-violet-300/45 bg-violet-100 text-violet-700 shadow-[0_0_28px_-18px_rgba(168,85,247,0.65)] dark:border-violet-400/[0.45] dark:bg-violet-950/30 dark:text-white dark:shadow-[0_0_28px_-18px_rgba(168,85,247,0.95)]">
                {group.label === "PlayStation" ? <PlayStationMark /> : <Icon className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <p className="text-xl font-black text-zinc-950 dark:text-white">{group.label}</p>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {group.description ?? "Seçilmiş keçidlər və xidmətlər"}
                </p>
              </div>
            </div>

            {sections.map((section) => (
              <DropdownSection
                key={section.title}
                title={section.title}
                items={section.items}
                pathname={pathname}
                fallbackIcon={Icon}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DropdownSection({
  title,
  items,
  pathname,
  fallbackIcon,
}: {
  title: string;
  items: NavLinkItem[];
  pathname: string;
  fallbackIcon: LucideIcon;
}) {
  if (items.length === 0) return null;
  const gridClass = items.length === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-2.5 flex items-center gap-3">
        <p className="shrink-0 text-xs font-black uppercase text-violet-600 dark:text-violet-300">{title}</p>
        <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
      </div>

      <div className={`grid ${gridClass} gap-2`}>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.href}
            item={item}
            active={hrefMatches(pathname, item.href)}
            fallbackIcon={fallbackIcon}
          />
        ))}
      </div>
    </div>
  );
}

function DropdownMenuItem({
  item,
  active,
  fallbackIcon,
}: {
  item: NavLinkItem;
  active: boolean;
  fallbackIcon: LucideIcon;
}) {
  const ItemIcon = item.Icon ?? fallbackIcon;

  return (
    <Link
      href={item.href}
      className={`group/item relative flex min-h-[48px] items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${
        item.featured
          ? "border-rose-400/70 bg-rose-50 text-rose-700 shadow-[0_0_28px_-20px_rgba(251,113,133,0.55)] hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-100 dark:shadow-[0_0_28px_-20px_rgba(251,113,133,0.95)] dark:hover:bg-rose-500/[0.15]"
          : active
            ? "border-violet-300/[0.55] bg-violet-50 text-zinc-950 dark:bg-violet-500/[0.12] dark:text-white"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300/40 hover:bg-violet-50 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-100 dark:hover:bg-white/[0.065]"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
          item.featured
            ? "border-rose-300/30 bg-rose-100 text-rose-600 dark:bg-rose-300/[0.15] dark:text-rose-200"
            : "border-zinc-200 bg-violet-50 text-violet-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-violet-100"
        }`}
      >
        <ItemIcon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-black ${item.featured ? "text-rose-600 dark:text-rose-200" : "text-zinc-950 dark:text-white"}`}>
          {item.label}
        </span>
        {item.description && (
          <span className="mt-0.5 block truncate text-xs font-medium text-zinc-500 dark:text-zinc-300">
            {item.description}
          </span>
        )}
      </span>

      {item.comingSoon && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-300/40 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-300/30">
          Tezliklə
        </span>
      )}
      {item.featured && <Sparkles className="h-3.5 w-3.5 shrink-0 fill-rose-300/20 text-rose-300" />}
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover/item:translate-x-1 group-hover/item:text-zinc-950 dark:text-zinc-300 dark:group-hover/item:text-white" />
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
        className="flex h-10 max-w-[180px] items-center gap-2 rounded-[18px] border border-zinc-200 bg-white/75 px-3 text-sm font-bold text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:border-violet-400/35 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:bg-white/[0.075]"
        aria-label="Hesab menyusu"
      >
        <span className="grid h-7 w-7 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-white/5 dark:text-zinc-200">
          <User className="h-4 w-4" />
        </span>
        <span className="truncate">{user.name?.split(" ")[0] ?? "Hesab"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-violet-400" />
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
                <User className="h-5 w-5" />
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
                      <Wallet className="h-3.5 w-3.5" />
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
                      <Gem className="h-3.5 w-3.5" />
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
        <Icon className="h-4 w-4" />
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
