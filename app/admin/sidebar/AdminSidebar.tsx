"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";

type BadgeKey =
  | "pendingDeposits"
  | "pendingGameOrders"
  | "pendingAllOrders"
  | "expiringSubs"
  | "pendingReviews"
  | "newWebsiteApplications";

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
  | "Monitor";

export type NavItemSpec = {
  href: string;
  label: string;
  iconName: IconName;
  badgeKey?: BadgeKey;
};

export type NavGroupSpec = {
  label: string;
  iconName: IconName;
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
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {g.label}
          </div>
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
                      ? "bg-indigo-500/10 text-white"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                  ].join(" ")}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-indigo-400"
                    />
                  )}
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon
                      className={[
                        "h-4 w-4 shrink-0 transition",
                        active ? "text-indigo-300" : "text-zinc-500 group-hover:text-zinc-300",
                      ].join(" ")}
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  {count > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-200 ring-1 ring-amber-500/30">
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
          <Logo href="/admin" height={24} />
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Bağla"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="shrink-0 px-5 pb-3 text-[11px] text-zinc-500">
        <span className="block truncate" title={userEmail}>
          {userEmail}
        </span>
      </div>

      <div className="mx-3 mb-2 h-px shrink-0 bg-zinc-900" />

      {navList}

      <div className="mx-3 mt-2 h-px shrink-0 bg-zinc-900" />

      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Mağazaya
        </Link>
        <div className="flex items-center">
          <LogoutButton />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar — visible < md */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-900 bg-zinc-950/95 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Menyu"
          className="rounded-md p-2 text-zinc-300 hover:bg-zinc-900"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Logo href="/admin" height={22} />
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
            Admin
          </span>
        </div>
        <div className="w-9" />
      </div>

      {/* Desktop sidebar — visible md+ */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-900 bg-zinc-950 md:block">
        <div className="sticky top-0 flex h-screen flex-col">{sidebarBody}</div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-zinc-900 bg-zinc-950 shadow-2xl">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
