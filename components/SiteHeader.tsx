"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  Flame,
  Gamepad2,
  Gem,
  Gift,
  Grid2X2,
  Heart,
  LogIn,
  Menu,
  MessageCircle,
  Music2,
  Sparkles,
  Tags,
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
  items: NavLinkItem[];
};

// Yeni 6-kateqoriyalı naviqasiya. Hər kateqoriya dropdown-dur və aktiv public
// səhifəyə aparır.
const playstationGroup: NavGroup = {
  label: "PlayStation",
  Icon: Gamepad2,
  href: "/playstation",
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
      href: "/endirimler",
      label: "Endirimlər",
      description: "Kampaniyalar və ucuz təkliflər",
      Icon: Tags,
      section: "helpful",
      featured: true,
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

const streamingGroup: NavGroup = {
  label: "Yayım",
  Icon: Video,
  href: "/streaming",
  items: [
    { href: "/streaming", label: "Bütün xidmətlər" },
    { href: "/streaming/netflix", label: "Netflix" },
    { href: "/streaming/hbo-max", label: "HBO Max" },
    { href: "/streaming/gain", label: "Gain" },
    { href: "/streaming/icmallar", label: "İcmallar" },
    { href: "/streaming/izleme-listim", label: "İzləmə Listim" },
  ],
};

const musicGroup: NavGroup = {
  label: "Musiqi",
  Icon: Music2,
  href: "/music",
  items: [
    { href: "/music", label: "Bütün musiqi paketləri" },
    { href: "/streaming/youtube", label: "YouTube Premium" },
  ],
};

const workGroup: NavGroup = {
  label: "İş",
  Icon: BriefcaseBusiness,
  href: "/work",
  items: [
    { href: "/work", label: "İş platformaları" },
  ],
};

const aiGroup: NavGroup = {
  label: "AI",
  Icon: Sparkles,
  href: "/ai",
  items: [
    { href: "/ai", label: "Süni intellekt paketləri" },
    { href: "/ai/claude", label: "Claude" },
    { href: "/ai/chatgpt", label: "ChatGPT" },
  ],
};

const otherGroup: NavGroup = {
  label: "Digər",
  Icon: Grid2X2,
  items: [
    { href: "/qazan", label: "Qazan" },
    { href: "/bilmeli-olduglarin", label: "Bələdçilər" },
    { href: "/haqqimizda", label: "Haqqımızda" },
    { href: "/mexfilik-siyaseti", label: "Məxfilik siyasəti" },
  ],
};

const navGroups: NavGroup[] = [
  playstationGroup,
  streamingGroup,
  musicGroup,
  workGroup,
  aiGroup,
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
      <header ref={headerRef} className="sticky top-0 z-50 bg-[#03030A]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="honsell-navbar-shell mx-auto flex max-w-[1536px] flex-col rounded-[24px]">
          <div className="grid min-h-[66px] grid-cols-[auto_1fr] items-center gap-3 px-4 py-3 md:grid-cols-[150px_minmax(220px,1fr)_auto] md:px-5 xl:grid-cols-[170px_minmax(260px,1fr)_auto] xl:gap-4 xl:px-6">
            <div className="flex min-w-0 items-center">
              <Logo href="/" height={28} priority className="h-6 w-auto xl:h-7" />
            </div>

            <div className="hidden min-w-0 md:block">
              <NavSearch />
            </div>

            <div className="flex min-w-0 items-center justify-end gap-2 xl:gap-3">
              <Link
                href="/profile/favorites"
                className="hidden h-10 items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.045] px-3 text-sm font-semibold text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-400/35 hover:bg-white/[0.075] lg:inline-flex"
              >
                <Heart className="h-5 w-5" />
                Favorilər
              </Link>

              <CartIndicator />

              {user?.walletBalance !== undefined && (
                <Link
                  href="/profile/wallet"
                  className="hidden h-10 items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-400/35 hover:bg-white/[0.075] sm:inline-flex"
                  title="Balans"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-white/5 text-zinc-200">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <span className="tabular-nums">{(user.walletBalance / 100).toFixed(2)}₼</span>
                </Link>
              )}

              {user ? (
                <Link
                  href="/profile"
                  className="hidden h-10 max-w-[170px] items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-400/35 hover:bg-white/[0.075] sm:inline-flex"
                  title="Hesab"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-white/5 text-zinc-200">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="truncate">{user.name?.split(" ")[0] ?? "Hesab"}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-violet-400" />
                </Link>
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => open("login")}
                    className="inline-flex h-10 items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.045] px-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.075]"
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
                className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.045] text-zinc-200 transition hover:bg-white/[0.075] xl:hidden"
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

          <div className="hidden min-h-[64px] items-center justify-between gap-4 border-t border-violet-300/15 px-6 xl:flex">
            <nav className="flex min-w-0 items-center gap-5" aria-label="Əsas naviqasiya">
              {navGroups.map((g) => (
                <NavDropdown key={g.label} group={g} active={isGroupActive(g, pathname)} pathname={pathname} />
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-5">
              <Link
                href="/hediyye-kartlari/honsell"
                className="honsell-gift-btn inline-flex h-11 items-center gap-2 px-4 text-sm font-bold text-white transition hover:brightness-110"
              >
                <Gift className="h-5 w-5 text-white" />
                Honsell hədiyyə kartları
              </Link>
              <Link
                href="/qazan"
                className="inline-flex h-11 items-center gap-2 rounded-[20px] border border-violet-500/35 bg-violet-950/25 px-4 text-sm font-semibold text-violet-50 shadow-[0_0_24px_-16px_rgba(124,58,237,0.9)] transition hover:border-violet-300/60 hover:bg-violet-900/35"
              >
                <Gem className="h-5 w-5" />
                Bonus qazan
              </Link>
              <Link
                href="/endirimler"
                className="inline-flex h-11 items-center gap-2 rounded-[20px] bg-gradient-to-r from-violet-600 via-purple-600 to-violet-800 px-5 text-sm font-black text-white shadow-[0_18px_44px_-22px_rgba(124,58,237,0.95)] transition hover:from-violet-500 hover:via-purple-500 hover:to-violet-700"
              >
                <Flame className="h-5 w-5 fill-white/20" />
                Endirimlər
              </Link>
            </div>
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
            className="absolute inset-x-0 flex flex-col overflow-hidden rounded-b-3xl border-b border-white/10 bg-[#09090C] shadow-2xl"
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
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] p-3"
                  >
                    <span
                      className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br text-white"
                      style={{ backgroundImage: `linear-gradient(135deg, ${BRAND_PURPLE}, ${BRAND_PURPLE_DARK})` }}
                    >
                      <User className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {user.name ?? "Hesab"}
                      </p>
                      {user.walletBalance !== undefined && (
                        <p className="truncate text-[11px] text-zinc-400">
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
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
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
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                      {section.items.map((item, i) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition active:bg-white/10 hover:bg-white/[0.05] ${
                            i > 0 ? "border-t border-white/5" : ""
                          } ${item.featured ? "text-rose-200" : "text-zinc-200"}`}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="flex items-center gap-2">
                            {item.comingSoon && (
                              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/30">
                                Tezliklə
                              </span>
                            )}
                            <span className="text-zinc-600">→</span>
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
  if (group.label === "PlayStation") {
    return <PlayStationDropdown group={group} active={active} pathname={pathname} />;
  }

  // Dropdown title-i qrupun əsas səhifəsinə (varsa) link-ə çevrilir; əks halda
  // sadəcə görsəl trigger düymədir. ChevronDown panelin açıldığını göstərir.
  const triggerClass =
    `relative inline-flex h-10 items-center gap-2 rounded-[18px] px-1 text-sm font-semibold transition group-focus-within:text-white ${
      active
        ? "text-white"
        : "text-zinc-200/90 hover:text-white"
    }`;
  const Icon = group.Icon;
  const triggerContent = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-zinc-100" />
      <span className="relative z-10">{group.label}</span>
      <ChevronDown className="relative z-10 h-4 w-4 text-violet-400" />
      {active && (
        <span className="pointer-events-none absolute inset-x-2 -bottom-2 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
      )}
    </>
  );

  return (
    <div className="group relative">
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
      <div className="invisible absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="rounded-2xl border border-rose-300/15 bg-[#0B0B0E]/95 p-2 shadow-[0_24px_80px_-36px_rgba(244,63,94,0.55)] backdrop-blur-xl">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-white/[0.07] ${
                item.featured
                  ? "text-rose-300 hover:text-rose-200"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              <span>{item.label}</span>
              {item.comingSoon && (
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/30">
                  Tezliklə
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayStationDropdown({
  group,
  active,
  pathname,
}: {
  group: NavGroup;
  active: boolean;
  pathname: string;
}) {
  const productItems = group.items.filter((item) => item.section !== "helpful");
  const helpfulItems = group.items.filter((item) => item.section === "helpful");

  return (
    <div className="group relative">
      <Link
        href={group.href ?? "/playstation"}
        className={`relative inline-flex h-12 items-center gap-3 rounded-[20px] border px-4 pr-3 text-base font-bold transition ${
          active
            ? "border-violet-400/70 bg-violet-950/50 text-fuchsia-100 shadow-[0_0_34px_-18px_rgba(168,85,247,0.95)]"
            : "border-white/10 bg-white/[0.035] text-zinc-100 hover:border-violet-400/60 hover:bg-violet-950/40 hover:text-fuchsia-100"
        }`}
      >
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-400/10 text-fuchsia-100 ring-1 ring-violet-300/30">
          <PlayStationMark compact />
        </span>
        <span>PlayStation</span>
        <ChevronDown className="h-4 w-4 text-fuchsia-100 transition group-hover:rotate-180" />
      </Link>

      <div className="invisible absolute left-0 top-full z-50 w-[820px] max-w-[calc(100vw-3rem)] pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div
          className="relative overflow-hidden rounded-[30px] border border-violet-400/[0.45] p-7 shadow-[0_30px_100px_-30px_rgba(168,85,247,0.85)] backdrop-blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 7% 7%, rgba(168, 85, 247, 0.24), transparent 31%), radial-gradient(circle at 94% 10%, rgba(59, 130, 246, 0.16), transparent 28%), linear-gradient(135deg, rgba(17, 19, 32, 0.98), rgba(5, 7, 15, 0.97))",
          }}
        >
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-8 bottom-0 h-24 bg-violet-700/10 blur-3xl" />
          <PlayStationShapes />

          <div className="relative">
            <div className="flex items-center gap-7 pb-6">
              <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full border border-violet-400/[0.45] bg-violet-950/30 shadow-[0_0_42px_-18px_rgba(168,85,247,0.95)]">
                <PlayStationMark />
              </span>
              <div className="min-w-0">
                <p className="text-3xl font-black text-white">PlayStation</p>
                <p className="mt-2 text-lg font-medium text-zinc-300">
                  Oyunlar, abunəliklər və faydalı keçidlər
                </p>
              </div>
            </div>

            <PlayStationSection title="SATIŞ MƏHSULLARI" items={productItems} pathname={pathname} />
            <PlayStationSection title="FAYDALI BÖLMƏLƏR" items={helpfulItems} pathname={pathname} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayStationSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavLinkItem[];
  pathname: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mt-5 first:mt-0">
      <div className="mb-3 flex items-center gap-4">
        <p className="shrink-0 text-sm font-black uppercase text-violet-300">{title}</p>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="grid gap-2.5">
        {items.map((item) => (
          <PlayStationMenuItem key={item.href} item={item} active={hrefMatches(pathname, item.href)} />
        ))}
      </div>
    </div>
  );
}

function PlayStationMenuItem({ item, active }: { item: NavLinkItem; active: boolean }) {
  const ItemIcon = item.Icon ?? Gamepad2;

  return (
    <Link
      href={item.href}
      className={`group/item relative flex min-h-[76px] items-center gap-4 rounded-[14px] border px-4 py-3 transition ${
        item.featured
          ? "border-rose-400/70 bg-rose-500/10 text-rose-100 shadow-[0_0_28px_-20px_rgba(251,113,133,0.95)] hover:bg-rose-500/[0.15]"
          : active
            ? "border-violet-300/[0.55] bg-violet-500/[0.12] text-white"
            : "border-white/10 bg-white/[0.035] text-zinc-100 hover:border-violet-300/40 hover:bg-white/[0.065]"
      }`}
    >
      <span
        className={`grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[14px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
          item.featured
            ? "border-rose-300/30 bg-rose-300/[0.15] text-rose-200"
            : "border-white/10 bg-white/[0.06] text-violet-100"
        }`}
      >
        <ItemIcon className="h-7 w-7" />
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block text-lg font-black ${item.featured ? "text-rose-200" : "text-white"}`}>
          {item.label}
        </span>
        {item.description && (
          <span className="mt-1 block truncate text-base font-medium text-zinc-300">
            {item.description}
          </span>
        )}
      </span>

      {item.featured && <Sparkles className="h-5 w-5 shrink-0 fill-rose-300/20 text-rose-300" />}
      <ChevronRight className="h-6 w-6 shrink-0 text-zinc-300 transition group-hover/item:translate-x-1 group-hover/item:text-white" />
    </Link>
  );
}

function PlayStationMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`font-black text-white ${compact ? "text-[13px]" : "text-2xl"}`}
      aria-hidden="true"
    >
      PS
    </span>
  );
}

function PlayStationShapes() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute right-10 top-6 h-28 w-36">
      <span className="absolute left-4 top-3 h-0 w-0 rotate-[28deg] border-y-[18px] border-r-[30px] border-y-transparent border-r-violet-300/25" />
      <span className="absolute right-1 top-3 h-12 w-12 rounded-full border-[5px] border-violet-300/25" />
      <span className="absolute bottom-2 left-16 h-12 w-12 rotate-[24deg] border-[5px] border-violet-300/20" />
      <span className="absolute bottom-6 left-1 h-14 w-14">
        <span className="absolute left-1/2 top-0 h-full w-[5px] -translate-x-1/2 rotate-[63deg] rounded-full bg-violet-300/20" />
        <span className="absolute left-1/2 top-0 h-full w-[5px] -translate-x-1/2 -rotate-[63deg] rounded-full bg-violet-300/20" />
      </span>
    </div>
  );
}
