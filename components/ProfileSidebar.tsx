"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserRound,
  Gamepad2,
  Receipt,
  Share2,
  LogOut,
  Wallet,
  Crown,
  Heart,
} from "lucide-react";

const ITEMS = [
  { href: "/profile", label: "Ümumi baxış", icon: LayoutDashboard },
  { href: "/profile/settings", label: "Hesab məlumatları", icon: UserRound },
  { href: "/profile/wallet", label: "Balans", icon: Wallet },
  { href: "/profile/accounts", label: "PSN hesabları", icon: Gamepad2 },
  { href: "/profile/favorites", label: "Favorilər", icon: Heart },
  { href: "/profile/subscriptions", label: "Aktiv abunəliklər", icon: Crown },
  { href: "/profile/orders", label: "Sifarişlər", icon: Receipt },
  { href: "/profile/referrals", label: "Referallar", icon: Share2 },
];

export default function ProfileSidebar() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      {/* Mobile: responsive grid nav */}
      <nav className="lg:hidden mb-6">
        <ul className="grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-[#0F0F13] p-2 sm:grid-cols-3">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm transition ${
                    active
                      ? "bg-[#5B21B6] text-white shadow-lg shadow-[#5B21B6]/20"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: vertical sidebar */}
      <div className="hidden lg:block w-[280px]">
        <nav className="rounded-[24px] border border-[#5B21B6]/20 bg-[#0F0F13] p-3 shadow-2xl">
          <ul className="space-y-1.5 flex flex-col">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3.5 rounded-[16px] px-4 py-3.5 text-sm transition ${
                      active
                        ? "bg-[#5B21B6] text-white shadow-[0_4px_20px_-4px_rgba(91,33,182,0.5)]"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`} />
                    <span className="font-medium tracking-wide">{item.label}</span>
                  </Link>
                </li>
              );
            })}

            <div className="my-2 h-px w-full bg-white/5" />

            <li>
              <button
                type="button"
                onClick={logout}
                className="group flex w-full items-center gap-3.5 rounded-[16px] px-4 py-3.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-4 w-4 opacity-70 group-hover:opacity-100" />
                <span className="font-medium tracking-wide">Çıxış</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/profile" ? pathname === "/profile" : pathname.startsWith(href);
}
