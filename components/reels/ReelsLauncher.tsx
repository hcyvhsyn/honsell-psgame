"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard } from "lucide-react";

/**
 * Desktop-da ekranın sağ kənarında sabit (sticky) "Reels" launcher düyməsi.
 * Yalnız geniş ekranda görünür (mobil-də bottom bar-dakı Reels bəndi var) və
 * /reels səhifəsinin özündə gizlənir.
 */
export default function ReelsLauncher() {
  const pathname = usePathname();
  if (pathname?.startsWith("/reels")) return null;

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
