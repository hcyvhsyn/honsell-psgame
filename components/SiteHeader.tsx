import Link from "next/link";
import { Gamepad2, User, LogIn } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import CartIndicator from "./CartIndicator";

/**
 * Public site header. The admin panel is intentionally NOT linked here —
 * staff reach it directly at `/admin/settings`.
 */
export default async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40">
            <Gamepad2 className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Honsell <span className="text-zinc-400 font-normal">PS Store</span>
          </span>
        </Link>

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
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:text-white"
              >
                <LogIn className="h-4 w-4" />
                Daxil ol
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Qeydiyyat
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
