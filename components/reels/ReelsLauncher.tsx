"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard } from "lucide-react";

/**
 * Desktop-da ekranın sağ kənarında sabit (sticky) "Reels" launcher düyməsi.
 * Yalnız geniş ekranda görünür (mobil-də bottom bar-dakı Reels bəndi var).
 *
 * Launcher `app/layout.tsx`-dən QLOBAL mount olunur, ona görə gizlədilməli
 * path-lar burada saxlanılır:
 *   • `/reels`  — səhifənin özü;
 *   • `/admin`  — iş paneli, marketinq CTA-sının yeri deyil;
 *   • auth axını (`/login`, `/register`, `/forgot-password`, `/set-password`) —
 *     kənar CTA diqqəti yayındırır və səhifələr eyni görünməlidir.
 */
const HIDDEN_PREFIXES = [
  "/reels",
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/set-password",
] as const;

export default function ReelsLauncher() {
  const pathname = usePathname();
  // Prefiks yoxlanışı: `/admin/reels` kimi alt route-lar da tutulur.
  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <Link
      href="/reels"
      aria-label="Reels"
      className="group fixed right-4 top-1/2 z-[120] hidden -translate-y-1/2 xl:flex xl:flex-col xl:items-center xl:gap-1"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-xl shadow-fuchsia-600/40 transition group-hover:scale-105 group-active:scale-95">
        <Clapperboard className="h-6 w-6" />
      </span>
      <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
        Reels
      </span>
    </Link>
  );
}
