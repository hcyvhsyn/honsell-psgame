"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { User, Menu, X, LogIn, ChevronDown, Wallet } from "lucide-react";
import CartIndicator from "./CartIndicator";
import Logo from "./Logo";
import { useModals } from "@/lib/modals";

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
      <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Left Side: Profile & Logo & Links */}
          <div className="flex items-center gap-10">
            {user && (
              <Link
                href="/profile"
                className="hidden sm:flex items-center gap-2 rounded-full bg-[#6D28D9] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#5B21B6]"
                title="Hesab"
              >
                <User className="h-4 w-4" />
                <span>{user.name?.split(" ")[0] ?? "Hesab"}</span>
              </Link>
            )}
            
            <Logo href="/" height={22} priority />
            
            {/* Desktop Center Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-300">
              <Link href="/#kateqoriya" className="hover:text-white transition">Kateqoriya</Link>
              <Link href="/#niye-biz" className="hover:text-white transition">Niyə biz?</Link>
              <Link href="/#mehsullar" className="hover:text-white transition">Məhsullar</Link>
              <Link href="/#reyler" className="hover:text-white transition">Rəylər</Link>
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 transition">
              Aze <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>

            <CartIndicator />

            {user ? (
              <div className="hidden sm:flex items-center gap-3">
                {user.walletBalance !== undefined && (
                  <Link
                    href="/profile/wallet"
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
                    title="Balans"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-white/10 border border-white/5">
                      <Wallet className="h-3 w-3 text-zinc-300" />
                    </div>
                    <span className="flex flex-col items-start leading-tight">
                      <span>{(user.walletBalance / 100).toFixed(2)} ₼</span>
                      {typeof user.cashbackBalanceCents === "number" && user.cashbackBalanceCents > 0 ? (
                        <span className="text-[10px] font-medium text-amber-300/90">
                          CB {(user.cashbackBalanceCents / 100).toFixed(2)} ₼
                        </span>
                      ) : null}
                    </span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={() => open("login")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-white"
                >
                  <LogIn className="h-4 w-4" /> Daxil ol
                </button>
                <button
                  type="button"
                  onClick={() => open("register")}
                  className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
                >
                  Qeydiyyat
                </button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 lg:hidden"
              aria-label="Menyu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute left-0 right-0 top-[57px] rounded-b-2xl border-b border-white/10 bg-zinc-950 px-4 pb-6 pt-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              {user ? (
                <Link
                  href="/profile"
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200"
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
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5"
                  >
                    <LogIn className="h-4 w-4" /> Daxil ol
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); open("register"); }}
                    className="rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
                  >
                    Qeydiyyat
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
