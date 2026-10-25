"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Gamepad2,
  Settings as SettingsIcon,
  Wallet,
  Gift,
  Crown,
  UserPlus,
  Image as ImageIcon,
  ClipboardList,
  ListChecks,
  HelpCircle,
  LayoutGrid,
  Menu,
  X,
  ShieldCheck,
  Tv,
  MessageSquare,
  MessageSquarePlus,
  Brain,
  Briefcase,
  Newspaper,
  Music,
  Percent,
  RefreshCw,
  Search,
  TrendingUp,
  Filter,
  ArrowLeft,
  Coins,
  Monitor,
  Megaphone,
  Network,
  Star,
  Clapperboard,
  TicketPercent,
  Zap,
  BellRing,
  Package,
  Moon,
  Sun,
  ChevronDown,
} from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import { useTheme } from "@/lib/theme";

type BadgeKey =
  | "pendingDeposits"
  | "pendingGameOrders"
  | "pendingAllOrders"
  | "expiringSubs"
  | "pendingReviews"
  | "pendingTestimonials"
  | "pendingCommunity"
  | "heldInviteBonuses";

type IconName =
  | "LayoutDashboard"
  | "Users"
  | "Receipt"
  | "Gamepad2"
  | "SettingsIcon"
  | "Wallet"
  | "Gift"
  | "Crown"
  | "UserPlus"
  | "ImageIcon"
  | "ClipboardList"
  | "ListChecks"
  | "HelpCircle"
  | "LayoutGrid"
  | "Tv"
  | "MessageSquare"
  | "MessageSquarePlus"
  | "Brain"
  | "Briefcase"
  | "Newspaper"
  | "Music"
  | "Percent"
  | "RefreshCw"
  | "Search"
  | "TrendingUp"
  | "Filter"
  | "Coins"
  | "Monitor"
  | "Megaphone"
  | "Network"
  | "Star"
  | "Clapperboard"
  | "TicketPercent"
  | "Zap"
  | "BellRing"
  | "Package";

export type NavItemSpec = {
  href: string;
  label: string;
  iconName: IconName;
  badgeKey?: BadgeKey;
};

export type NavGroupSpec = {
  label: string;
  iconName: IconName;
  /** Qrupun nə üçün olduğunu bildirən qısa izah (başlığın tooltip-i). */
  description?: string;
  items: NavItemSpec[];
};

/** Bir-biri ilə əlaqəsiz qrupları ayıran üst səviyyə (vizual ayırıcı + başlıq). */
export type NavSectionSpec = {
  label: string;
  groups: NavGroupSpec[];
};

/** Açıq qrupların siyahısı — yalnız cihaz rahatlığı üçün, itməsi problem deyil. */
const OPEN_GROUPS_KEY = "honsell.admin.sidebar.openGroups.v1";

function readOpenGroups(): string[] | null {
  try {
    const raw = window.localStorage.getItem(OPEN_GROUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : null;
  } catch {
    return null;
  }
}

function writeOpenGroups(labels: string[]) {
  try {
    window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(labels));
  } catch {
    // private rejim / bloklanmış storage — sadəcə yadda saxlanmır
  }
}

const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Receipt,
  Gamepad2,
  SettingsIcon,
  Wallet,
  Gift,
  Crown,
  UserPlus,
  ImageIcon,
  ClipboardList,
  ListChecks,
  HelpCircle,
  LayoutGrid,
  Tv,
  MessageSquare,
  MessageSquarePlus,
  Brain,
  Briefcase,
  Newspaper,
  Music,
  Percent,
  RefreshCw,
  Search,
  TrendingUp,
  Filter,
  Coins,
  Monitor,
  Megaphone,
  Network,
  Star,
  Clapperboard,
  TicketPercent,
  Zap,
  BellRing,
  Package,
};

export default function AdminSidebar({
  sections,
  badges,
  userEmail,
}: {
  sections: NavSectionSpec[];
  badges: Record<BadgeKey, number>;
  userEmail: string;
}) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const groups = useMemo(() => sections.flatMap((sec) => sec.groups), [sections]);
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));

  function isItemActive(href: string) {
    if (pathname === href) return true;
    if (href === "/admin") return false;
    if (!pathname.startsWith(`${href}/`)) return false;
    const moreSpecific = allHrefs.some(
      (h) => h !== href && h.startsWith(`${href}/`) && (pathname === h || pathname.startsWith(`${h}/`)),
    );
    return !moreSpecific;
  }

  const activeGroup = groups.find((g) => g.items.some((i) => isItemActive(i.href)))?.label ?? null;

  // SSR ilə eyni başlanğıc: yalnız ilk qrup + aktiv qrup açıq. Saxlanmış seçim mount-dan sonra gəlir.
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set([groups[0]?.label, activeGroup].filter((v): v is string => Boolean(v))),
  );
  useEffect(() => {
    const saved = readOpenGroups();
    if (saved) setOpenGroups(new Set(saved));
  }, []);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      writeOpenGroups(Array.from(next));
      return next;
    });
  }

  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("az");
  const matches = (item: NavItemSpec, group: NavGroupSpec) =>
    !needle ||
    item.label.toLocaleLowerCase("az").includes(needle) ||
    group.label.toLocaleLowerCase("az").includes(needle);

  const visibleSections = sections
    .map((sec) => ({
      ...sec,
      groups: sec.groups
        .map((g) => ({ ...g, items: g.items.filter((i) => matches(i, g)) }))
        .filter((g) => g.items.length > 0),
    }))
    .filter((sec) => sec.groups.length > 0);

  const navList = (
    <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Admin naviqasiya">
      {visibleSections.length === 0 && (
        <p className="px-3 py-6 text-center text-xs text-zinc-500">Heç nə tapılmadı.</p>
      )}
      {visibleSections.map((sec, si) => (
        <section key={sec.label} className={si === 0 ? "pt-1" : "mt-3 border-t border-admin-line pt-3"}>
          <h2 className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 opacity-75">
            {sec.label}
          </h2>
          <div className="grid gap-1">
            {sec.groups.map((g) => {
              const GroupIcon = ICONS[g.iconName];
              // Axtarışda və aktiv səhifənin qrupunda qrup həmişə açıqdır.
              const forcedOpen = Boolean(needle) || g.label === activeGroup;
              const open = forcedOpen || openGroups.has(g.label);
              const groupCount = g.items.reduce(
                (n, i) => n + (i.badgeKey ? badges[i.badgeKey] ?? 0 : 0),
                0,
              );
              const groupId = `admin-nav-${g.label.replace(/\s+/g, "-")}`;
              const singleItem = g.items.length === 1 && g.items[0].label === g.label;
              if (singleItem) {
                return <NavLinkRow key={g.label} item={g.items[0]} active={isItemActive(g.items[0].href)} count={groupCount} />;
              }
              return (
                <div key={g.label}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.label)}
                    disabled={forcedOpen}
                    aria-expanded={open}
                    aria-controls={groupId}
                    title={g.description}
                    className={[
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] font-semibold transition disabled:cursor-default",
                      g.label === activeGroup ? "text-zinc-900" : "text-zinc-700 hover:bg-admin-chip hover:text-zinc-900",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <GroupIcon className="h-4 w-4 shrink-0 text-violet-600" />
                      <span className="truncate">{g.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!open && groupCount > 0 && <CountPill count={groupCount} />}
                      {!forcedOpen && (
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "" : "-rotate-90"}`}
                        />
                      )}
                    </span>
                  </button>
                  {open && (
                    <div id={groupId} className="ml-[1.375rem] mt-0.5 grid gap-0.5 border-l border-admin-line pl-2">
                      {g.items.map((item) => (
                        <NavLinkRow
                          key={item.href}
                          item={item}
                          active={isItemActive(item.href)}
                          count={item.badgeKey ? badges[item.badgeKey] ?? 0 : 0}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );

  const searchBox = (
    <div className="shrink-0 px-3 pb-2">
      <label className="relative block">
        <span className="sr-only">Menyuda axtar</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Menyuda axtar…"
          className="h-9 w-full rounded-lg border border-admin-line bg-admin-bg/60 pl-8 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
        />
      </label>
    </div>
  );

  const sidebarBody = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo href="/admin" height={24} className="admin-logo-black" />
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-500/40">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Bağla"
          className="rounded p-1 text-zinc-600 hover:bg-admin-chip2 hover:text-zinc-900 md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="shrink-0 px-5 pb-3 text-[11px] text-zinc-500">
        <span className="block truncate" title={userEmail}>
          {userEmail}
        </span>
      </div>

      {searchBox}

      {navList}

      <div className="mx-3 mt-2 h-px shrink-0 bg-admin-chip2" />

      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:bg-admin-chip hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Mağazaya
        </Link>
        <div className="flex items-center gap-2">
          <AdminThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar — visible < md */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-admin-line bg-admin-bg/90 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Menyu"
          className="rounded-md p-2 text-zinc-700 hover:bg-admin-chip"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Logo href="/admin" height={22} className="admin-logo-black" />
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-500/40">
            Admin
          </span>
        </div>
        <AdminThemeToggle />
      </div>

      {/* Desktop sidebar — floating, kənardan ayrı (rounded + border + boşluq) */}
      <aside className="hidden w-72 shrink-0 p-3 md:block">
        <div className="sticky top-3 flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-admin-line bg-admin-card shadow-[0_8px_30px_-18px_rgba(76,29,149,0.35)]">
          {sidebarBody}
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-admin-line bg-admin-card shadow-2xl">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}

function AdminThemeToggle() {
  const { theme, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isDark = theme === "dark";

  function handleToggle() {
    const rect = buttonRef.current?.getBoundingClientRect();
    setTheme(
      isDark ? "light" : "dark",
      rect
        ? {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          }
        : undefined,
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "İşıqlı rejimə keç" : "Qaranlıq rejimə keç"}
      title={isDark ? "İşıqlı rejim" : "Qaranlıq rejim"}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-admin-line bg-admin-card text-zinc-600 shadow-sm transition hover:bg-admin-chip hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function CountPill({ count }: { count: number }) {
  return (
    <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-700 ring-1 ring-amber-500/30">
      {count}
    </span>
  );
}

function NavLinkRow({
  item,
  active,
  count,
  compact = false,
}: {
  item: NavItemSpec;
  active: boolean;
  count: number;
  compact?: boolean;
}) {
  const Icon = ICONS[item.iconName];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex items-center justify-between gap-3 rounded-lg px-3 text-sm transition",
        compact ? "py-1.5" : "py-2 font-semibold",
        active
          ? "bg-violet-500/10 text-violet-700"
          : "text-zinc-600 hover:bg-admin-chip hover:text-zinc-900",
      ].join(" ")}
    >
      {active && (
        <span
          aria-hidden
          className={`absolute top-1.5 bottom-1.5 w-0.5 rounded-r bg-violet-500 ${compact ? "-left-[9px]" : "left-0"}`}
        />
      )}
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon
          className={[
            "h-4 w-4 shrink-0 transition",
            active ? "text-violet-700" : "text-zinc-500 group-hover:text-zinc-700",
          ].join(" ")}
        />
        <span className="truncate">{item.label}</span>
      </span>
      {count > 0 && <CountPill count={count} />}
    </Link>
  );
}
