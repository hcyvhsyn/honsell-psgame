"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const pathname = usePathname() ?? "/";
  const { theme, toggle } = useTheme();
  const btnRef = useRef<HTMLButtonElement>(null);

  // Adminlər üçün gizlət.
  if (pathname.startsWith("/admin")) return null;

  const isDark = theme === "dark";

  function handleClick() {
    const el = btnRef.current;
    if (!el) {
      toggle();
      return;
    }
    const r = el.getBoundingClientRect();
    toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      role="switch"
      aria-label={isDark ? "İşıqlı rejimə keç" : "Qaranlıq rejimə keç"}
      aria-checked={isDark}
      title={isDark ? "İşıqlı rejimə keç" : "Qaranlıq rejimə keç"}
      className={`
        group fixed right-4 top-1/2 z-[120] -translate-y-1/2
        inline-flex h-20 w-11 flex-col items-center justify-between
        rounded-full border p-1 shadow-2xl backdrop-blur-xl
        transition-all duration-300
        focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60
        sm:right-6 sm:h-[88px] sm:w-12
        ${
          isDark
            ? "border-white/15 bg-zinc-950/80 text-zinc-200 shadow-[0_18px_48px_-24px_rgba(0,0,0,0.9)] hover:border-indigo-300/50"
            : "border-zinc-200/80 bg-white/85 text-zinc-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.45)] hover:border-amber-300/70"
        }
      `}
    >
      <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full sm:h-10 sm:w-10">
        <Sun
          aria-hidden
          className={`h-4 w-4 transition ${
            isDark ? "text-zinc-500" : "text-amber-500"
          }`}
        />
      </span>

      <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full sm:h-10 sm:w-10">
        <Moon
          aria-hidden
          className={`h-4 w-4 transition ${
            isDark ? "text-indigo-200" : "text-zinc-400"
          }`}
        />
      </span>

      <span
        aria-hidden
        className={`absolute left-1 top-1 z-20 h-9 w-9 rounded-full transition-all duration-500 ease-out sm:h-10 sm:w-10 ${
          isDark
            ? "translate-y-9 bg-gradient-to-br from-indigo-300 via-violet-300 to-zinc-100 text-zinc-950 shadow-[0_10px_24px_-12px_rgba(129,140,248,0.9)] sm:translate-y-10"
            : "translate-y-0 bg-gradient-to-br from-amber-200 via-yellow-300 to-white text-amber-900 shadow-[0_10px_24px_-12px_rgba(245,158,11,0.85)]"
        }`}
      >
        {isDark ? (
          <Moon aria-hidden className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2" />
        ) : (
          <Sun aria-hidden className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2" />
        )}
      </span>

      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
          isDark
            ? "bg-[radial-gradient(circle_at_50%_72%,rgba(129,140,248,0.18),transparent_44%)]"
            : "bg-[radial-gradient(circle_at_50%_28%,rgba(245,158,11,0.16),transparent_44%)]"
        }`}
      />
    </button>
  );
}
