"use client";

import { ArrowUp } from "lucide-react";

/** Footer-in "Yuxarı qayıt" düyməsi — yeganə client hissə (SiteFooter özü server komponentidir). */
export default function FooterBackToTop({
  className,
  labelClassName,
}: {
  className?: string;
  /** Mobildə mətn vizual gizlənir (ekran oxuyucusu üçün qalır). */
  labelClassName?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      <span className={labelClassName}>Yuxarı qayıt</span>
      <ArrowUp aria-hidden />
    </button>
  );
}
