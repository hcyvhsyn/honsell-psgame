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
} from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";

type BadgeKey =
  | "pendingDeposits"
  | "pendingGameOrders"
  | "pendingAllOrders"
  | "expiringSubs"
  | "pendingReviews";

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
  | "MessageSquare";

type NavItem = {
  href: string;
  label: string;
  iconName: IconName;
  badgeKey?: BadgeKey;
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
};

export default function AdminSidebar({
  nav,
  badges,
  userEmail,
}: {
  nav: NavItem[];
  badges: Record<BadgeKey, number>;
  userEmail: string;
}) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const navList = (
    <nav className="px-3 py-4">
      {nav.map(({ href, label, iconName, badgeKey }) => {
        const Icon = ICONS[iconName];
        const isActive =
          pathname === href ||
          (href !== "/admin" && (pathname === href || pathname.startsWith(`${href}/`)));
        const count = badgeKey ? badges[badgeKey] : 0;

        return (
          <Link
            key={href}
            href={href}
            className={[
              "mb-1 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition",
              isActive
                ? "bg-zinc-900 text-white ring-1 ring-indigo-500/30"
                : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
            ].join(" ")}
          >
            <span className="flex items-center gap-3">
              <Icon className={isActive ? "h-4 w-4 text-indigo-300" : "h-4 w-4 text-zinc-500"} />
              {label}
            </span>
            {count > 0 && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarBody = (
    <>
      <div className="flex h-16 items-center justify-between gap-3 border-b border-zinc-900 px-5">
        <div className="flex items-center gap-3">
          <Logo href="/admin" height={26} />
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
            <ShieldCheck className="h-3 w-3" /> Admin
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
      <div className="border-b border-zinc-900 px-5 py-2 text-[11px] text-zinc-500">
        {userEmail}
      </div>

      {navList}

      <div className="px-3 pt-2">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Back to store
        </Link>
      </div>

      <div className="px-5 pt-3 pb-6">
        <LogoutButton />
      </div>
    </>
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
      <aside className="hidden w-60 shrink-0 border-r border-zinc-900 bg-zinc-950 md:block">
        {sidebarBody}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-zinc-900 bg-zinc-950 shadow-2xl">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
