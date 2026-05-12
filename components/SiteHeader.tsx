"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  Flame,
  Gamepad2,
  Gem,
  Grid2X2,
  Heart,
  LogIn,
  Menu,
  Music2,
  Sparkles,
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
    { href: "/oyunlar", label: "Oyunlar" },
    { href: "/ps-plus", label: "PS Plus" },
    { href: "/hediyye-kartlari", label: "Hədiyyə Kartları" },
    { href: "/hesab-acma", label: "Hesab Açma" },
    { href: "/kolleksiyalar", label: "Kolleksiyalar" },
    { href: "/endirimler", label: "Endirimlər", featured: true },
    { href: "/reyler", label: "Rəylər" },
    { href: "/profile/favorites", label: "Favoritlərim" },
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

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#03030A]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="honsell-navbar-shell mx-auto flex max-w-7xl flex-col rounded-[26px]">
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
                <NavDropdown key={g.label} group={g} active={isGroupActive(g, pathname)} />
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-5">
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
            className="absolute inset-x-0 top-[7.5rem] flex max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-b-3xl border-b border-white/10 bg-[#09090C] shadow-2xl md:top-[5.75rem] md:max-h-[calc(100dvh-5.75rem)]"
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

function NavDropdown({ group, active }: { group: NavGroup; active: boolean }) {
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
