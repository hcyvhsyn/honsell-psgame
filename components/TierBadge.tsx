"use client";

import { useState } from "react";

/**
 * Müştəri tier nişanı (status) — ad + SVG ikon.
 * SVG public/-dan gəlir: icon "bronze" → /tiers/bronze.svg (admin əlavə edir).
 * SVG hələ yoxdursa (404) ikon sakitcə gizlədilir — yalnız ad qalır.
 */
export type TierBadgeData = {
  name: string;
  displayName?: string | null;
  icon?: string | null;
  color?: string | null;
};

export default function TierBadge({
  tier,
  full = false,
  className = "",
}: {
  tier: TierBadgeData | null | undefined;
  full?: boolean;
  className?: string;
}) {
  const [iconOk, setIconOk] = useState(true);
  if (!tier) return null;
  const label = (full ? tier.displayName || tier.name : tier.name) || "";
  if (!label) return null;
  const style = tier.color
    ? { borderColor: `${tier.color}55`, color: tier.color, backgroundColor: `${tier.color}14` }
    : undefined;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
        tier.color ? "" : "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      } ${className}`}
      style={style}
      title={tier.displayName || tier.name}
    >
      {tier.icon && iconOk && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`/tiers/${tier.icon}.svg`}
          alt=""
          width={14}
          height={14}
          className="h-3.5 w-3.5"
          onError={() => setIconOk(false)}
        />
      )}
      {label}
    </span>
  );
}
