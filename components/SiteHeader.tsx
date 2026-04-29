import Link from "next/link";
import { User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import CartIndicator from "./CartIndicator";
import HeaderGuestButtons from "./HeaderGuestButtons";
import Logo from "./Logo";

/**
 * Public site header. The admin panel is intentionally NOT linked here —
 * staff reach it directly at `/admin/settings`.
 */
export default async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Logo href="/" height={24} priority />

        <nav className="flex items-center gap-2 sm:gap-3">
          <CartIndicator />
          {user ? (
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 transition hover:border-indigo-500/60 hover:text-white"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">
                {user.name?.split(" ")[0] ?? "Hesab"}
              </span>
              <span className="hidden text-xs text-zinc-400 sm:inline">
                · {(user.walletBalance / 100).toFixed(2)} AZN
              </span>
            </Link>
          ) : (
            <HeaderGuestButtons />
          )}
        </nav>
      </div>
    </header>
  );
}
