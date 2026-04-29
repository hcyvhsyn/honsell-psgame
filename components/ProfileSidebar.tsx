"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserRound,
  Gamepad2,
  Receipt,
  Share2,
  Wallet,
  LogOut,
  Plus,
} from "lucide-react";

const ITEMS = [
  { href: "/profile", label: "Ümumi baxış", icon: LayoutDashboard },
  { href: "/profile/settings", label: "Hesab məlumatları", icon: UserRound },
  { href: "/profile/accounts", label: "PSN hesabları", icon: Gamepad2 },
  { href: "/profile/orders", label: "Sifarişlər", icon: Receipt },
  { href: "/profile/referrals", label: "Referallar", icon: Share2 },
];

export default function ProfileSidebar({
  walletBalance,
}: {
  /** Balance in qəpik (1 AZN = 100). */
  walletBalance: number;
}) {
  const pathname = usePathname();
  const aznBalance = (walletBalance / 100).toFixed(2);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      {/* Mobile: horizontal nav pills */}
      <nav className="lg:hidden">
        <ul className="flex flex-row gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? "bg-indigo-500/15 text-indigo-200"
                      : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: vertical sidebar with wallet card + logout */}
      <div className="hidden lg:flex lg:flex-col lg:gap-3">
        <nav className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-1.5">
          <ul className="space-y-0.5">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? "bg-indigo-500/15 text-indigo-200"
                        : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 transition ${
                        active ? "text-indigo-300" : "text-zinc-500 group-hover:text-zinc-300"
                      }`}
                    />
                    <span className="font-medium">{item.label}</span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Wallet quick-card */}
        <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/70 via-zinc-900/60 to-zinc-950 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300/80">
              <Wallet className="h-3 w-3" /> Cüzdan balansı
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-white">
                {aznBalance}
              </span>
              <span className="text-xs font-medium text-zinc-400">AZN</span>
            </div>
            <Link
              href="/profile/wallet"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
            >
              <Plus className="h-3.5 w-3.5" /> Balans yüklə
            </Link>
          </div>
        </div>

        {/* Distinct logout */}
        <button
          type="button"
          onClick={logout}
          className="group flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3.5 py-2.5 text-sm text-zinc-300 transition hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-300"
        >
          <span className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700/60 transition group-hover:bg-rose-500/15 group-hover:text-rose-300 group-hover:ring-rose-500/30">
              <LogOut className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">Hesabdan çıx</span>
          </span>
          <span className="text-xs text-zinc-600 transition group-hover:text-rose-400/70">
            →
          </span>
        </button>
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/profile" ? pathname === "/profile" : pathname.startsWith(href);
}
