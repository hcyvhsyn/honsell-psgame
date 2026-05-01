"use client";

import { useEffect, useState } from "react";

const WHATSAPP_MSISDN = "994702560509";
const WA_HREF = `https://wa.me/${WHATSAPP_MSISDN}`;

export default function WhatsAppFloat() {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      setShowTooltip(true);
      const hideTimer = setTimeout(() => {
        if (cancelled) return;
        setShowTooltip(false);
      }, 3500);
      return hideTimer;
    };

    const initial = setTimeout(() => {
      cycle();
    }, 4000);

    const interval = setInterval(() => {
      cycle();
    }, 12000);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-end gap-2 sm:bottom-6 sm:right-6">
      <div
        className={`pointer-events-none mb-3 origin-bottom-right rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg shadow-emerald-900/20 transition-all duration-300 ${
          showTooltip
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-1 scale-95 opacity-0"
        }`}
      >
        <span className="relative">
          Sualınız var?
          <span className="absolute -bottom-[10px] right-3 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" />
        </span>
      </div>

      <a
        href={WA_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp ilə əlaqə"
        className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-900/40 transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-40" />
        <span className="absolute inset-0 rounded-full ring-2 ring-white/20" />
        <svg
          viewBox="0 0 32 32"
          className="relative h-7 w-7"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.961 2.722.961.345 0 1.318-.07 1.318-1.06 0-.144-.014-.345-.043-.502-.114-.287-2.808-1.518-3.252-1.518zm-3.137 7.2h-.014c-1.69 0-3.353-.46-4.815-1.318l-.345-.215-3.51.918.93-3.424-.215-.345a8.93 8.93 0 0 1-1.39-4.79c0-4.99 4.06-8.94 9.05-8.94 4.99 0 8.94 3.95 8.94 8.94 0 4.991-3.95 9.174-8.94 9.174zm7.59-16.84A10.61 10.61 0 0 0 15.974 4.41c-5.847 0-10.624 4.778-10.624 10.624 0 1.876.487 3.682 1.418 5.286L5.27 26.59l6.42-1.69a10.5 10.5 0 0 0 5.07 1.276h.013c5.846 0 10.61-4.79 10.61-10.624a10.59 10.59 0 0 0-3.137-7.532z" />
        </svg>
      </a>
    </div>
  );
}
