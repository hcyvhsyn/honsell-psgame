"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

type BadgeKey = "pendingDeposits" | "pendingGameOrders" | "pendingAllOrders";

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
  | "HelpCircle";

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
};

export default function AdminSidebar({
  nav,
  badges,
}: {
  nav: NavItem[];
  badges: Record<BadgeKey, number>;
}) {
  const pathname = usePathname() ?? "";

  return (
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
}

