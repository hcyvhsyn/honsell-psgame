"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  HelpCircle,
  LayoutGrid,
  Menu,
  X,
  ShieldCheck,
  Tv,
  MessageSquare,
  Brain,
  Briefcase,
  Newspaper,
  Music,
  Percent,
  RefreshCw,
  Search,
  TrendingUp,
  ArrowLeft,
  Coins,
  Monitor,
  Megaphone,
  Network,
  Star,
  Moon,
  Sun,
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
  | "newWebsiteApplications"
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
  | "HelpCircle"
  | "LayoutGrid"
  | "Tv"
  | "MessageSquare"
  | "Brain"
  | "Briefcase"
  | "Newspaper"
  | "Music"
  | "Percent"
  | "RefreshCw"
  | "Search"
  | "TrendingUp"
  | "Coins"
  | "Monitor"
  | "Megaphone"
  | "Network"
  | "Star";

export type NavItemSpec = {
  href: string;
  label: string;
  iconName: IconName;
  badgeKey?: BadgeKey;
};

export type NavGroupSpec = {
  label: string;
  iconName: IconName;
  /** Qrupun nə üçün olduğunu bildirən qısa altyazı (başlığın altında göstərilir). */
  description?: string;
  items: NavItemSpec[];
};

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
  HelpCircle,
  LayoutGrid,
  Tv,
  MessageSquare,
  Brain,
  Briefcase,
  Newspaper,
  Music,
  Percent,
  RefreshCw,
  Search,
  TrendingUp,
  Coins,
  Monitor,
  Megaphone,
  Network,
  Star,
};

export default function AdminSidebar({
  groups,
  badges,
  userEmail,
}: {
  groups: NavGroupSpec[];
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

  const navList = (
    <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Admin naviqasiya">
      {groups.map((g, gi) => (
        <div key={g.label} className={gi === 0 ? "" : "mt-5"}>
          <div className="px-3 pb-0.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {g.label}
          </div>
          {g.description ? (
            <p className="px-3 pb-1.5 text-[11px] leading-tight text-zinc-600">
              {g.description}
            </p>
          ) : (
            <div className="pb-1" />
          )}
          <div className="grid gap-0.5">
            {g.items.map(({ href, label, iconName, badgeKey }) => {
              const Icon = ICONS[iconName];
              const active = isItemActive(href);
              const count = badgeKey ? badges[badgeKey] : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-violet-500/10 text-violet-700"
                      : "text-zinc-600 hover:bg-admin-chip hover:text-zinc-900",
                  ].join(" ")}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-violet-400"
                    />
                  )}
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon
                      className={[
                        "h-4 w-4 shrink-0 transition",
                        active ? "text-violet-700" : "text-zinc-500 group-hover:text-zinc-700",
                      ].join(" ")}
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  {count > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-700 ring-1 ring-amber-500/30">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
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

      <div className="mx-3 mb-2 h-px shrink-0 bg-admin-chip2" />

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
