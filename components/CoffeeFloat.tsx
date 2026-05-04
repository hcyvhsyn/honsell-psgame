"use client";

import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";

const COFFEE_HREF = "https://kofe.al/@honsell";

export default function CoffeeFloat() {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      setShowTooltip(true);
      setTimeout(() => {
        if (cancelled) return;
        setShowTooltip(false);
      }, 3500);
    };

    const initial = setTimeout(cycle, 7000);
    const interval = setInterval(cycle, 12000);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed bottom-24 right-5 z-50 flex items-end gap-2 sm:bottom-[104px] sm:right-6">
      <div
        className={`pointer-events-none mb-3 origin-bottom-right rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg shadow-amber-900/20 transition-all duration-300 ${
          showTooltip
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-1 scale-95 opacity-0"
        }`}
      >
        <span className="relative">
          Bir kofe ilə dəstək ol
          <span className="absolute -bottom-[10px] right-3 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
        </span>
      </div>

      <a
        href={COFFEE_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Bir kofe ilə dəstək ol"
        className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-900/40 transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-amber-500 opacity-40" />
        <span className="absolute inset-0 rounded-full ring-2 ring-white/20" />
        <Coffee className="relative h-7 w-7" strokeWidth={2.2} />
      </a>
    </div>
  );
}
