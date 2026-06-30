"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const pathname = usePathname() ?? "/";
  const { theme, setTheme } = useTheme();
  const lightBtnRef = useRef<HTMLButtonElement>(null);
  const darkBtnRef = useRef<HTMLButtonElement>(null);

  if (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return null;
  }

  const isDark = theme === "dark";

  function handlePick(next: "light" | "dark") {
    if (theme === next) return;
    const el = next === "light" ? lightBtnRef.current : darkBtnRef.current;
    if (!el) {
      setTheme(next);
      return;
    }
    const r = el.getBoundingClientRect();
    setTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  return (
    <div
      id="theme-toggle"
      role="radiogroup"
      aria-label="Mövzu rejimi"
      className={`group fixed left-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[110]
        inline-flex h-24 w-12 flex-col items-center justify-between
        rounded-full border p-1 shadow-lg backdrop-blur-xl
        transition-[background-color,border-color,box-shadow] duration-300
        sm:h-[104px] sm:w-[52px]
        xl:bottom-6 xl:left-5
        ${
          isDark
            ? "border-white/[0.12] bg-zinc-950/70 text-zinc-200 shadow-[0_14px_40px_-26px_rgba(0,0,0,0.9)] hover:border-indigo-300/45"
            : "border-zinc-200/80 bg-white/80 text-zinc-600 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.4)] hover:border-amber-300/70"
        }`}
    >
      {/* Sliding indicator — purely decorative, clicks pass through */}
      <span
        aria-hidden
        className={`pointer-events-none absolute left-1 top-1 z-10 h-10 w-10 rounded-full transition-transform duration-500 ease-out sm:h-11 sm:w-11 ${
          isDark
            ? "translate-y-[52px] bg-gradient-to-br from-indigo-300 via-violet-300 to-zinc-100 shadow-[0_10px_24px_-12px_rgba(129,140,248,0.9)] sm:translate-y-[56px]"
            : "translate-y-0 bg-gradient-to-br from-amber-200 via-yellow-300 to-white shadow-[0_10px_24px_-12px_rgba(245,158,11,0.85)]"
        }`}
      />

      {/* Light option (top half) */}
      <button
        ref={lightBtnRef}
        type="button"
        role="radio"
        aria-checked={!isDark}
        aria-label="İşıqlı rejimə keç"
        title="İşıqlı rejim"
        onClick={() => handlePick("light")}
        className="relative z-20 grid h-11 w-10 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 sm:h-11 sm:w-11"
      >
        <Sun
          aria-hidden
          className={`h-[18px] w-[18px] transition-[color,transform,opacity] duration-300 ${
            isDark
              ? "scale-90 text-zinc-500 opacity-70"
              : "scale-100 text-amber-700 opacity-100"
          }`}
        />
      </button>

      {/* Dark option (bottom half) */}
      <button
        ref={darkBtnRef}
        type="button"
        role="radio"
        aria-checked={isDark}
        aria-label="Qaranlıq rejimə keç"
        title="Qaranlıq rejim"
        onClick={() => handlePick("dark")}
        className="relative z-20 grid h-11 w-10 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 sm:h-11 sm:w-11"
      >
        <Moon
          aria-hidden
          className={`h-[18px] w-[18px] transition-[color,transform,opacity] duration-300 ${
            isDark
              ? "scale-100 text-zinc-900 opacity-100"
              : "scale-90 text-zinc-400 opacity-70"
          }`}
        />
      </button>

      {/* Soft glow on hover */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
          isDark
            ? "bg-[radial-gradient(circle_at_50%_75%,rgba(129,140,248,0.18),transparent_44%)]"
            : "bg-[radial-gradient(circle_at_50%_25%,rgba(245,158,11,0.16),transparent_44%)]"
        }`}
      />
    </div>
  );
}
