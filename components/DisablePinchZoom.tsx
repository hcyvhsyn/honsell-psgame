"use client";

import { useEffect } from "react";

/**
 * Telefonda təsadüfi böyütməni bağlayır — sayt mobil tətbiq kimi hiss olunsun.
 *
 * Üç qat lazımdır, çünki brauzerlər fərqli davranır:
 *   1. `viewport` (app/layout.tsx): `maximumScale: 1, userScalable: false` —
 *      Android Chrome-da pinch-i bağlayır, iOS-da input fokusunda avtomatik
 *      böyüməni də söndürür.
 *   2. CSS `touch-action: manipulation` (globals.css) — iki dəfə toxunub böyütmə.
 *   3. Bu komponent — iOS Safari 10+ `user-scalable=no`-ya məhəl QOYMUR; pinch
 *      yalnız `gesturestart`/`gesturechange` hadisələrini dayandırmaqla bağlanır.
 *      Hadisə yalnız Safari-də var, digər brauzerlərdə listener boş qalır.
 */
export default function DisablePinchZoom() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
    };
  }, []);

  return null;
}
