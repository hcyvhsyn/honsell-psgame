"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { User, Menu, X, LogIn, ChevronDown, Wallet, UserPlus } from "lucide-react";
import CartIndicator from "./CartIndicator";
import FavoriteIndicator from "./FavoriteIndicator";
import Logo from "./Logo";
import { useModals } from "@/lib/modals";

const BRAND_PURPLE = "#6301F3";
const BRAND_PURPLE_DARK = "#2D006F";

type NavLinkItem = {
  href: string;
  label: string;
  featured?: boolean;
};

const primaryNavLinks: NavLinkItem[] = [
  { href: "/oyunlar", label: "Oyunlar" },
  { href: "/kolleksiyalar", label: "Kolleksiyalar" },
  { href: "/endirimler", label: "Endirimlər", featured: true },
  { href: "/ps-plus", label: "PS Plus" },
  { href: "/streaming", label: "Streaming" },
];

const secondaryNavLinks: NavLinkItem[] = [
  { href: "/hediyye-kartlari", label: "Hədiyyə Kartları" },
  { href: "/bilmeli-olduglarin", label: "Bələdçilər" },
];

const allNavLinks = [...primaryNavLinks, ...secondaryNavLinks];

export default function SiteHeader({
  user,
}: {
  user?: {
    name?: string | null;
    walletBalance?: number;
    cashbackBalanceCents?: number;
  } | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { open } = useModals();

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07070A]/95 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-[1480px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6 lg:gap-5">
          <div className="flex min-w-0 items-center">
            <Logo href="/" height={22} priority />
          </div>

          <nav className="hidden min-w-0 items-center justify-center xl:flex" aria-label="Əsas naviqasiya">
            <div className="flex min-w-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
              {primaryNavLinks.map((item) => (
                <HeaderNavLink key={item.href} href={item.href} featured={item.featured}>
                  {item.label}
                </HeaderNavLink>
              ))}

              <div className="group relative">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white group-focus-within:bg-white/[0.07] group-focus-within:text-white"
                >
                  Digər <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
                <div className="invisible absolute left-1/2 top-full z-50 mt-3 w-56 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0B0B0E]/95 p-2 opacity-0 shadow-2xl backdrop-blur-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  {secondaryNavLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <button
              className="hidden h-10 items-center gap-1.5 rounded-full border bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.07] xl:flex"
              style={{ borderColor: `${BRAND_PURPLE}80` }}
            >
              Aze <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>

            <FavoriteIndicator />
            <CartIndicator />

            {user ? (
              <div className="hidden sm:flex items-center gap-3">
                {user.walletBalance !== undefined && (
                  <Link
                    href="/profile/wallet"
                    className="inline-flex h-10 items-center gap-2 rounded-full border bg-white/[0.04] px-3 text-sm font-semibold text-white transition hover:bg-white/10 xl:px-4"
                    title="Balans"
                    style={{ borderColor: `${BRAND_PURPLE}80` }}
                  >
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full bg-white/5"
                    >
                      <Wallet className="h-4 w-4 text-zinc-200" />
                    </span>
                    <span className="hidden tabular-nums xl:inline">{(user.walletBalance / 100).toFixed(2)}₼</span>
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="inline-flex h-10 max-w-[150px] items-center gap-2 rounded-full bg-gradient-to-r px-4 text-sm font-semibold text-white shadow-[0_10px_30px_-16px_rgba(99,1,243,0.95)] transition xl:max-w-[180px] xl:px-5"
                  title="Hesab"
                  style={{ backgroundImage: `linear-gradient(90deg, ${BRAND_PURPLE}, ${BRAND_PURPLE_DARK})` }}
                >
                  <User className="h-4 w-4" />
                  <span className="truncate">{user.name?.split(" ")[0] ?? "Hesab"}</span>
                </Link>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => open("login")}
                  className="inline-flex items-center gap-2 rounded-full border bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                  style={{ borderColor: `${BRAND_PURPLE}80` }}
                >
                  <LogIn className="h-4 w-4" /> Daxil ol
                </button>
                <button
                  type="button"
                  onClick={() => open("register")}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-16px_rgba(99,1,243,0.95)] transition"
                  style={{ backgroundImage: `linear-gradient(90deg, ${BRAND_PURPLE}, ${BRAND_PURPLE_DARK})` }}
                >
                  <UserPlus className="h-4 w-4" />
                  Qeydiyyatdan keç
                </button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/10 xl:hidden"
              aria-label="Menyu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 xl:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute left-0 right-0 top-16 rounded-b-3xl border-b border-white/10 bg-[#09090C] px-4 pb-6 pt-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid gap-2">
              {allNavLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold transition hover:bg-white/[0.07] ${
                    item.featured ? "text-rose-200" : "text-zinc-200"
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  <span className="text-zinc-500">→</span>
                </Link>
              ))}

              <div className="mt-2 h-px bg-white/10" />

              {user ? (
                <Link
                  href="/profile"
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="h-5 w-5 text-zinc-400" />
                  <div>
                    <p className="font-medium">{user.name ?? "Hesab"}</p>
                    {user.walletBalance !== undefined && (
                      <p className="text-xs text-zinc-500">
                        Cüzdan {(user.walletBalance / 100).toFixed(2)} ₼
                        {typeof user.cashbackBalanceCents === "number" && user.cashbackBalanceCents > 0
                          ? ` · CB ${(user.cashbackBalanceCents / 100).toFixed(2)} ₼`
                          : ""}
                      </p>
                    )}
                  </div>
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); open("login"); }}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5"
                  >
                    <LogIn className="h-4 w-4" /> Daxil ol
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); open("register"); }}
                    className="rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
                  >
                    Qeydiyyatdan keç
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HeaderNavLink({
  href,
  featured = false,
  children,
}: {
  href: string;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition xl:px-4 ${
        featured
          ? "text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
          : "text-zinc-300 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
