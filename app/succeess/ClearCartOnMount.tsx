"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart";
import { trackEvent } from "@/lib/track";

export default function ClearCartOnMount({
  active,
  orderTotalAznCents,
}: {
  active: boolean;
  /** Ödənilən məbləğ (AZN qəpik) — bilinmirsə event dəyərsiz göndərilir. */
  orderTotalAznCents?: number;
}) {
  const { clear } = useCart();
  const tracked = useRef(false);

  useEffect(() => {
    if (!active) return;

    // ⚠️ Huni bayrağı səbət təmizlənməzdən ƏVVƏL atəşlənməlidir: `clear()`
    // səbət sinxronunu işə salır və istifadəçi dərhal başqa səhifəyə keçə
    // bilər. `trackEvent` "purchase" üçün növbəni dərhal boşaldır.
    //
    // ⚠️ Bu, gəlir mənbəyi DEYİL — kart ödənişi uğursuz ola, sifariş yerinə
    // yetirilməyə bilər. Hesabatdakı AZN həmişə `Transaction` + `OrderAttribution`
    // birləşməsindən gəlir. Bu event yalnız hunidəki son addımı işarələyir.
    if (!tracked.current) {
      tracked.current = true;
      trackEvent("purchase", {
        ...(typeof orderTotalAznCents === "number"
          ? { valueAznCents: orderTotalAznCents }
          : {}),
      });
    }

    clear();
  }, [active, clear, orderTotalAznCents]);

  return null;
}
