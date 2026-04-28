"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User as UserIcon,
  Gamepad2,
  Receipt,
  Share2,
} from "lucide-react";

const ITEMS = [
  { href: "/profile", label: "Ümumi baxış", icon: UserIcon },
  { href: "/profile/accounts", label: "PSN hesabları", icon: Gamepad2 },
  { href: "/profile/orders", label: "Sifarişlər", icon: Receipt },
  { href: "/profile/referrals", label: "Referallar", icon: Share2 },
];

export default function ProfileSidebar() {
  const pathname = usePathname();

  return (
    <nav className="lg:sticky lg:top-20 lg:self-start">
      <ul className="flex flex-row gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-1 lg:flex-col lg:overflow-visible">
        {ITEMS.map((item) => {
          const active =
            item.href === "/profile"
              ? pathname === "/profile"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="shrink-0 lg:shrink lg:w-full">
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
  );
}
