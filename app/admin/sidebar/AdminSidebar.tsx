"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  ChevronRight,
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
  | "MessageSquare"
  | "Brain"
  | "Briefcase"
  | "Newspaper"
  | "Music";

export type NavItemSpec = {
  href: string;
  label: string;
  iconName: IconName;
  badgeKey?: BadgeKey;
};

export type NavGroupSpec = {
  label: string;
  iconName: IconName;
  /// True olduqda qrup boş ola bilər və "Tezliklə" badge-i göstərilir.
  comingSoon?: boolean;
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

  // Cari path hansı qrupa aiddir? Həmin qrup default olaraq açıq olur,
  // istifadəçi əl ilə başqa qrupları aça bilər.
  const activeGroupLabel = useMemo(() => {
    for (const g of groups) {
      for (const it of g.items) {
        if (pathname === it.href || (it.href !== "/admin" && pathname.startsWith(`${it.href}/`))) {
          return g.label;
        }
      }
    }
    return null;
  }, [groups, pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // active groupu hər path dəyişikliyində auto-aç
  useEffect(() => {
    if (activeGroupLabel) {
      setOpenGroups((prev) => ({ ...prev, [activeGroupLabel]: true }));
    }
  }, [activeGroupLabel]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  // Drawer bağlama tetikleyici
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

  function isItemActive(href: string, allItems: string[]) {
    if (pathname === href) return true;
    if (href === "/admin") return false;
    if (!pathname.startsWith(`${href}/`)) return false;
    // Daha-spesifik route-u tapırıqsa, parent-i aktiv saymırıq.
    const moreSpecific = allItems.some(
      (h) => h !== href && h.startsWith(`${href}/`) && (pathname === h || pathname.startsWith(`${h}/`)),
    );
    return !moreSpecific;
  }

  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));

  const navList = (
    <nav className="px-3 py-3" aria-label="Admin naviqasiya">
      {groups.map((g) => {
        const GroupIcon = ICONS[g.iconName];
        const isOpen = activeGroupLabel === g.label || openGroups[g.label];
        const hasItems = g.items.length > 0;
        const empty = g.comingSoon && !hasItems;
        return (
          <div key={g.label} className="mb-1">
            <button
              type="button"
              onClick={() => toggleGroup(g.label)}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                activeGroupLabel === g.label
                  ? "text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <GroupIcon className="h-3.5 w-3.5" />
                {g.label}
                {g.comingSoon && (
                  <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-200 ring-1 ring-amber-300/30">
                    Tezliklə
                  </span>
                )}
              </span>
              {hasItems && (
                <ChevronRight
                  className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-90" : ""}`}
                />
              )}
            </button>

            {isOpen && hasItems && (
              <div className="mt-1 grid gap-0.5 pl-1">
                {g.items.map(({ href, label, iconName, badgeKey }) => {
                  const Icon = ICONS[iconName];
                  const active = isItemActive(href, allHrefs);
                  const count = badgeKey ? badges[badgeKey] : 0;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={[
                        "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition",
                        active
                          ? "bg-zinc-900 text-white ring-1 ring-indigo-500/30"
                          : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={active ? "h-4 w-4 text-indigo-300" : "h-4 w-4 text-zinc-500"} />
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
              </div>
            )}

            {isOpen && empty && (
              <p className="px-3 py-1.5 text-[11px] text-zinc-600">Tezliklə əlavə olunacaq.</p>
            )}
          </div>
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
      <aside className="hidden w-64 shrink-0 border-r border-zinc-900 bg-zinc-950 md:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto">
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
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-zinc-900 bg-zinc-950 shadow-2xl">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
