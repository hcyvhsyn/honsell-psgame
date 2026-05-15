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
  Gift,
  AlertCircle,
} from "lucide-react";

const ITEMS = [
  { href: "/profile", label: "Ümumi baxış", icon: LayoutDashboard },
  { href: "/profile/settings", label: "Hesab məlumatları", icon: UserRound },
  { href: "/profile/wallet", label: "Balans", icon: Wallet },
  { href: "/profile/hediyye-kart", label: "Hədiyyə kart", icon: Gift },
  { href: "/profile/accounts", label: "PSN hesabları", icon: Gamepad2 },
  { href: "/profile/favorites", label: "Favorilər", icon: Heart },
  { href: "/profile/subscriptions", label: "Aktiv abunəliklər", icon: Crown },
  { href: "/profile/orders", label: "Sifarişlər", icon: Receipt },
  { href: "/profile/referrals", label: "Referallar", icon: Share2 },
];

export default function ProfileSidebar({
  profileIncomplete = false,
}: {
  profileIncomplete?: boolean;
}) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <aside className="lg:sticky lg:top-36 lg:self-start">
      <nav className="mb-5 lg:hidden">
        <ul className="grid grid-cols-2 gap-2 rounded-[16px] border border-violet-300/20 bg-[#0b0c18]/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:grid-cols-3">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const showBadge =
              profileIncomplete && item.href === "/profile/settings";
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-[12px] px-3 text-xs font-semibold transition sm:text-sm ${
                    active
                      ? "bg-gradient-to-r from-violet-700 to-purple-900 text-white shadow-lg shadow-violet-950/30"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {showBadge && (
                    <span
                      title="Profil məlumatları natamamdır"
                      className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/90 text-[11px] font-black text-white shadow-[0_0_0_2px_rgba(244,63,94,0.25)]"
                    >
                      !
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden w-[260px] lg:block">
        <nav className="rounded-[16px] border border-violet-300/20 bg-[linear-gradient(180deg,rgba(15,16,31,0.98),rgba(9,10,22,0.98))] p-2.5 shadow-[0_30px_80px_-54px_rgba(124,58,237,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <ul className="flex flex-col space-y-1.5">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              const showBadge =
                profileIncomplete && item.href === "/profile/settings";
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex h-[54px] items-center gap-3.5 rounded-[12px] px-4 text-[15px] transition ${
                      active
                        ? "bg-gradient-to-r from-violet-700 via-purple-800 to-violet-950 text-white shadow-[0_18px_42px_-24px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.12)]"
                        : "text-zinc-400 hover:bg-white/[0.055] hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                    />
                    <span className="font-medium">{item.label}</span>
                    {showBadge && (
                      <span
                        title="Profil məlumatları natamamdır — tamamla"
                        className="ml-auto inline-flex h-6 min-w-6 shrink-0 items-center justify-center gap-1 rounded-full bg-rose-500 px-1.5 text-xs font-black text-white shadow-[0_0_0_3px_rgba(244,63,94,0.2)]"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}

            <div className="mx-4 my-3 h-px bg-white/10" />

            <li>
              <button
                type="button"
                onClick={logout}
                className="group flex h-[54px] w-full items-center gap-3.5 rounded-[12px] px-4 text-[15px] text-zinc-400 transition hover:bg-white/[0.055] hover:text-white"
              >
                <LogOut className="h-5 w-5 opacity-70 group-hover:opacity-100" />
                <span className="font-medium">Çıxış</span>
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
