"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { User, Menu, X, LogIn, ChevronDown, Wallet, UserPlus } from "lucide-react";
import CartIndicator from "./CartIndicator";
import Logo from "./Logo";
import NavSearch from "./NavSearch";
import { useModals } from "@/lib/modals";

const BRAND_PURPLE = "#6301F3";
const BRAND_PURPLE_DARK = "#2D006F";

type NavLinkItem = {
  href: string;
  label: string;
  featured?: boolean;
  comingSoon?: boolean;
};

type NavGroup = {
  label: string;
  href?: string; // Group başlığını klikləməklə dropdown-un əsas səhifəsinə keçid.
  items: NavLinkItem[];
};

// Yeni 6-kateqoriyalı naviqasiya. Hər kateqoriya dropdown-dur — çoxlu sub-link
// saxlayır. PlayStation/Streaming/Music aktivdir; Work/AI/Other gələcək üçün
// rezerv (comingSoon flag-ı UI-da kiçik badge ilə göstərilir).
const playstationGroup: NavGroup = {
  label: "PlayStation",
  href: "/playstation",
  items: [
    { href: "/oyunlar", label: "Oyunlar" },
    { href: "/ps-plus", label: "PS Plus" },
    { href: "/hediyye-kartlari", label: "Hədiyyə Kartları" },
    { href: "/hesab-acma", label: "Hesab Açma" },
    { href: "/kolleksiyalar", label: "Kolleksiyalar" },
    { href: "/endirimler", label: "Endirimlər", featured: true },
    { href: "/reyler", label: "Rəylər" },
    { href: "/profile/favorites", label: "Favoritlərim" },
  ],
};

const streamingGroup: NavGroup = {
  label: "Yayım Platformaları",
  href: "/streaming",
  items: [
    { href: "/streaming", label: "Bütün xidmətlər" },
    { href: "/streaming/netflix", label: "Netflix" },
    { href: "/streaming/hbo-max", label: "HBO Max" },
    { href: "/streaming/gain", label: "Gain" },
    { href: "/streaming/icmallar", label: "İcmallar" },
    { href: "/streaming/izleme-listim", label: "İzləmə Listim" },
  ],
};

const musicGroup: NavGroup = {
  label: "Musiqi Platformaları",
  items: [
    { href: "/streaming/youtube", label: "YouTube Premium" },
  ],
};

const workGroup: NavGroup = {
  label: "İş Platformaları",
  items: [
    { href: "/is-platformalari", label: "Tezliklə", comingSoon: true },
  ],
};

const aiGroup: NavGroup = {
  label: "Süni İntellekt",
  items: [
    { href: "/suni-intellekt", label: "Tezliklə", comingSoon: true },
  ],
};

const otherGroup: NavGroup = {
  label: "Digər",
  items: [
    { href: "/qazan", label: "Qazan" },
    { href: "/bilmeli-olduglarin", label: "Bələdçilər" },
  ],
};

const navGroups: NavGroup[] = [
  playstationGroup,
  streamingGroup,
  musicGroup,
  workGroup,
  aiGroup,
  otherGroup,
];

// Mobile drawer flattens the groups but keeps section headings.
const mobileSections: { heading?: string; items: NavLinkItem[] }[] = navGroups.map((g) => ({
  heading: g.label,
  items: g.items,
}));

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
              {navGroups.map((g) => (
                <NavDropdown key={g.label} group={g} />
              ))}
            </div>
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <NavSearch />

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
        <div className="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true" aria-label="Menyu">
          <button
            type="button"
            aria-label="Menyunu bağla"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
          />
          <div
            className="absolute inset-x-0 top-16 flex max-h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-b-3xl border-b border-white/10 bg-[#09090C] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="grid gap-5">
                {/* Account block — always at the top so primary action is reachable */}
                {user ? (
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] p-3"
                  >
                    <span
                      className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br text-white"
                      style={{ backgroundImage: `linear-gradient(135deg, ${BRAND_PURPLE}, ${BRAND_PURPLE_DARK})` }}
                    >
                      <User className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {user.name ?? "Hesab"}
                      </p>
                      {user.walletBalance !== undefined && (
                        <p className="truncate text-[11px] text-zinc-400">
                          Cüzdan {(user.walletBalance / 100).toFixed(2)} ₼
                          {typeof user.cashbackBalanceCents === "number" && user.cashbackBalanceCents > 0
                            ? ` · CB ${(user.cashbackBalanceCents / 100).toFixed(2)} ₼`
                            : ""}
                        </p>
                      )}
                    </div>
                    <span className="text-zinc-500">→</span>
                  </Link>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); open("login"); }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
                    >
                      <LogIn className="h-4 w-4" /> Daxil ol
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); open("register"); }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-16px_rgba(99,1,243,0.95)]"
                      style={{ backgroundImage: `linear-gradient(90deg, ${BRAND_PURPLE}, ${BRAND_PURPLE_DARK})` }}
                    >
                      <UserPlus className="h-4 w-4" /> Qeydiyyat
                    </button>
                  </div>
                )}

                {/* Nav sections */}
                {mobileSections.map((section, idx) => (
                  <div key={section.heading ?? `section-${idx}`} className="grid gap-2">
                    {section.heading && (
                      <p className="px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                        {section.heading}
                      </p>
                    )}
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                      {section.items.map((item, i) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition active:bg-white/10 hover:bg-white/[0.05] ${
                            i > 0 ? "border-t border-white/5" : ""
                          } ${item.featured ? "text-rose-200" : "text-zinc-200"}`}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="flex items-center gap-2">
                            {item.comingSoon && (
                              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/30">
                                Tezliklə
                              </span>
                            )}
                            <span className="text-zinc-600">→</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavDropdown({ group }: { group: NavGroup }) {
  // Dropdown title-i qrupun əsas səhifəsinə (varsa) link-ə çevrilir; əks halda
  // sadəcə görsəl trigger düymədir. ChevronDown panelin açıldığını göstərir.
  const triggerClass =
    "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07] hover:text-white group-focus-within:bg-white/[0.07] group-focus-within:text-white xl:px-4";

  return (
    <div className="group relative">
      {group.href ? (
        <Link href={group.href} className={triggerClass}>
          {group.label} <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Link>
      ) : (
        <button type="button" className={triggerClass}>
          {group.label} <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      )}
      {/*
        Wrapper-in `pt-3`-ı vizual boşluğu (12px) saxlayır, amma boşluq özü
        hover hədəfidir — kursor triggerdən panelə keçəndə group hover-i
        kəsilmir.
      */}
      <div className="invisible absolute left-1/2 top-full z-50 w-56 -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="rounded-2xl border border-white/10 bg-[#0B0B0E]/95 p-2 shadow-2xl backdrop-blur-xl">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-white/[0.07] ${
                item.featured
                  ? "text-rose-300 hover:text-rose-200"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              <span>{item.label}</span>
              {item.comingSoon && (
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/30">
                  Tezliklə
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
