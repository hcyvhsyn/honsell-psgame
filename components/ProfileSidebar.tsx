"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  UserRound,
  Receipt,
  Share2,
  LogOut,
  Wallet,
  Crown,
  Heart,
  Gamepad2,
  Package,
  type LucideIcon,
} from "lucide-react";
import { clearCachedSession } from "@/components/SessionProvider";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Bu bəndi aktiv sayan köhnə/birləşdirilmiş yollar (yönləndirilən səhifələr). */
  also?: string[];
};

/**
 * Profil menyusu — 8 bənd (2026-11 sadələşdirmə).
 * - "Aktiv abunəliklər" + "Netflix / Spotify abunəliklərim" → "Abunəliklərim" (/profile/abunelikler;
 *   bu URL CRM giriş/ödəniş axınlarında işlənir, ona görə əsas odur, /profile/subscriptions yönlənir).
 * - "Hədiyyə kart" → Balans səhifəsinin içində (kod cüzdana köçür).
 * - "Profillerim" → "PSN hesablarım".
 * - "Qutu açılışları" yalnız tarixçəsi olan istifadəçiyə (`showLootBoxes`).
 * Sıra istifadə tezliyinə görədir; "Hesab məlumatları" sonda.
 */
const ITEMS: Item[] = [
  { href: "/profile", label: "Ümumi baxış", icon: LayoutDashboard },
  { href: "/profile/orders", label: "Sifarişlər", icon: Receipt },
  { href: "/profile/abunelikler", label: "Abunəliklərim", icon: Crown, also: ["/profile/subscriptions"] },
  { href: "/profile/wallet", label: "Balans", icon: Wallet, also: ["/profile/hediyye-kart"] },
  { href: "/profile/profiles", label: "PSN hesablarım", icon: Gamepad2, also: ["/profile/accounts"] },
  { href: "/profile/favorites", label: "Favorilər", icon: Heart },
  { href: "/profile/referrals", label: "Referallar", icon: Share2 },
  { href: "/profile/settings", label: "Hesab məlumatları", icon: UserRound },
];

const LOOT_BOX_ITEM: Item = { href: "/profile/qutular", label: "Qutu açılışları", icon: Package };

export default function ProfileSidebar({
  profileIncomplete = false,
  showLootBoxes = false,
}: {
  profileIncomplete?: boolean;
  showLootBoxes?: boolean;
}) {
  const pathname = usePathname();
  const items = showLootBoxes
    ? [...ITEMS.slice(0, -1), LOOT_BOX_ITEM, ITEMS[ITEMS.length - 1]]
    : ITEMS;

  // Telefonda menyu üfüqi lentdir — aktiv bənd görünən sahəyə sürüşsün (məs. "Hesab məlumatları" sondadır).
  const activeMobileRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    activeMobileRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearCachedSession();
    window.location.href = "/";
  }

  // min-w-0: grid elementi telefonda üfüqi lentin eninə (≈1150px) uzanıb bütün səhifəni yana sürüşdürürdü.
  return (
    <aside className="min-w-0 lg:sticky lg:top-36 lg:self-start">
      {/* Telefon/planşet: tək sətirlik üfüqi lent. Əvvəl 2 sütunlu şəbəkə idi (11 bənd → 6 sətir) və
          hər profil səhifəsində məzmunu ~300px aşağı itələyirdi; "Çıxış" isə telefonda ümumiyyətlə yox idi. */}
      <nav aria-label="Profil menyusu" className="-mx-4 mb-4 sm:-mx-6 lg:hidden">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            const showBadge = profileIncomplete && item.href === "/profile/settings";
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  ref={active ? activeMobileRef : undefined}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition ${
                    active
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {showBadge && <IncompleteDot />}
                </Link>
              </li>
            );
          })}
          <li className="shrink-0">
            <button
              type="button"
              onClick={logout}
              className="flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 text-sm font-semibold text-zinc-500 transition dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Çıxış
            </button>
          </li>
        </ul>
      </nav>

      <div className="hidden w-[260px] lg:block">
        <nav
          aria-label="Profil menyusu"
          className="rounded-[16px] border border-violet-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,246,251,0.94))] p-2.5 shadow-[0_28px_72px_-54px_rgba(124,58,237,0.45),inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-violet-300/20 dark:bg-[linear-gradient(180deg,rgba(15,16,31,0.98),rgba(9,10,22,0.98))] dark:shadow-[0_30px_80px_-54px_rgba(124,58,237,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          <ul className="flex flex-col space-y-1">
            {items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              const showBadge = profileIncomplete && item.href === "/profile/settings";
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group flex h-12 items-center gap-3.5 rounded-[12px] px-4 text-[15px] transition ${
                      active
                        ? "bg-gradient-to-r from-violet-700 via-purple-800 to-violet-950 text-white shadow-[0_18px_42px_-24px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.12)]"
                        : "text-zinc-600 hover:bg-violet-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.055] dark:hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
                    />
                    <span className="font-medium">{item.label}</span>
                    {showBadge && <IncompleteDot />}
                  </Link>
                </li>
              );
            })}

            <li aria-hidden className="mx-4 my-2 h-px bg-zinc-200 dark:bg-white/10" />

            <li>
              <button
                type="button"
                onClick={logout}
                className="group flex h-12 w-full items-center gap-3.5 rounded-[12px] px-4 text-[15px] text-zinc-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-zinc-400 dark:hover:bg-white/[0.055] dark:hover:text-white"
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

/** Natamam profil işarəsi — qırmızı "!" xəta kimi görünürdü; məlumat könüllüdür, yumşaq nöqtə kifayətdir. */
function IncompleteDot() {
  return (
    <span
      title="Profil məlumatları natamamdır"
      aria-label="Profil məlumatları natamamdır"
      className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.2)]"
    />
  );
}

function isActive(pathname: string, item: Item) {
  if (item.href === "/profile") return pathname === "/profile";
  return [item.href, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
