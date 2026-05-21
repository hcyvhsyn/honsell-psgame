"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/**
 * Floating sticky theme toggle.
 *   - Yapışıq olaraq ekranın sağ kənarında, şaquli ortalanmış.
 *   - Sun / moon ikonları cross-fade + rotate ilə dəyişir.
 *   - Klik anında düymənin koordinatından dairəvi wipe açılır və tema dəyişir.
 *   - /admin altında render edilmir (yalnız user-facing səhifələrdə görünür).
 */
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
      aria-label={isDark ? "İşıqlı rejimə keç" : "Qaranlıq rejimə keç"}
      aria-pressed={isDark}
      title={isDark ? "İşıqlı rejimə keç" : "Qaranlıq rejimə keç"}
      className={`
        group fixed right-4 top-1/2 z-[120] -translate-y-1/2
        inline-flex h-14 w-14 items-center justify-center
        rounded-full border-2 shadow-2xl backdrop-blur-md
        transition-all duration-300
        focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50
        sm:right-6
        ${
          isDark
            ? "border-amber-300/40 bg-gradient-to-br from-zinc-900 to-zinc-950 text-amber-300 shadow-[0_10px_40px_-10px_rgba(252,211,77,0.5)] hover:scale-110"
            : "border-violet-400/50 bg-gradient-to-br from-white to-violet-50 text-violet-600 shadow-[0_10px_40px_-10px_rgba(124,58,237,0.45)] hover:scale-110"
        }
      `}
    >
      <span className="relative inline-flex h-7 w-7 items-center justify-center">
        {/* Sun icon (visible in dark theme as the "next" target). */}
        <Sun
          aria-hidden
          strokeWidth={2.4}
          className={`absolute h-7 w-7 transition-all duration-500 ${
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-50 opacity-0"
          }`}
        />
        {/* Moon icon (visible in light theme). */}
        <Moon
          aria-hidden
          strokeWidth={2.4}
          className={`absolute h-7 w-7 transition-all duration-500 ${
            isDark
              ? "rotate-90 scale-50 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>

      {/* Decorative glow ring */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${
          isDark
            ? "bg-[radial-gradient(circle_at_center,rgba(252,211,77,0.18),transparent_70%)]"
            : "bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.18),transparent_70%)]"
        }`}
      />
      {/* Decorative rays/stars around the icon */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-[-6px] rounded-full transition-opacity duration-500 ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "conic-gradient(from 0deg, rgba(252,211,77,0) 0%, rgba(252,211,77,0.25) 12%, rgba(252,211,77,0) 24%, rgba(252,211,77,0.25) 36%, rgba(252,211,77,0) 48%, rgba(252,211,77,0.25) 60%, rgba(252,211,77,0) 72%, rgba(252,211,77,0.25) 84%, rgba(252,211,77,0) 100%)",
          mask: "radial-gradient(circle, transparent 56%, black 60%, black 72%, transparent 76%)",
          WebkitMask:
            "radial-gradient(circle, transparent 56%, black 60%, black 72%, transparent 76%)",
        }}
      />
    </button>
  );
}
