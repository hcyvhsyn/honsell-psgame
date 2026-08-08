"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/track";
import type { EventName } from "@/lib/analyticsShared";

/**
 * Server Component-dən atəşlənən event üçün nazik körpü. Heç nə render etmir.
 *
 * Niyə ayrıca komponent: `app/oyunlar/[slug]/page.tsx` bir RSC-dir və `useEffect`
 * işlədə bilmir. Bütün məhsul səhifəsini `"use client"` etmək isə SEO və ilk
 * yükləmə üçün ağır olardı.
 *
 * `key` verməyə ehtiyac yoxdur — Next naviqasiyada komponenti yenidən mount edir;
 * `sentFor` ref-i yalnız eyni mount daxilində təkrarın qarşısını alır (React
 * StrictMode `useEffect`-i iki dəfə çağırır).
 */
export default function TrackView({
  name = "view_item",
  productId,
  productType,
  valueAznCents,
}: {
  name?: EventName;
  productId?: string;
  productType?: string;
  valueAznCents?: number;
}) {
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    const key = `${name}:${productId ?? ""}`;
    if (sentFor.current === key) return;
    sentFor.current = key;

    trackEvent(name, {
      ...(productId ? { productId } : {}),
      ...(productType ? { productType } : {}),
      ...(typeof valueAznCents === "number" ? { valueAznCents } : {}),
    });
  }, [name, productId, productType, valueAznCents]);

  return null;
}
