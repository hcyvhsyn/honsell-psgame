"use client";

import { useEffect } from "react";

/**
 * Mərkəzləşdirilmiş scroll-animasiya meneceri.
 *
 * Ana səhifədə bir neçə dekorativ, `infinite` CSS animasiyası var (bölmə-arası
 * marquee zolaqları — `SectionFlowDivider`, və hero-dakı üzən PS simvolları —
 * `ps-float`). Bunların hamısı ekranda olmasa belə fasiləsiz işləyir; hər biri
 * daimi bir GPU kompozit qatı (`will-change: transform`) saxlayır və kompozitor
 * thread-ini yükləyir. Sürətli scroll zamanı bu, yeni açılan sahələrin gec
 * boyanmasına — yəni "boş/qara zolaq" effektinə səbəb olur.
 *
 * Bu menecer TƏK bir IntersectionObserver ilə bütün `[data-scroll-anim]`
 * elementlərini izləyir və yalnız görünənləri işlək saxlayır; görünməyənlərə
 * `.anim-idle` əlavə edərək animasiyanı dayandırır və `will-change`-i sıfırlayır
 * (bax: app/globals.css). Beləcə eyni anda cəmi 1–2 animasiya aktiv olur, 6 yox.
 *
 * Hər komponentin öz observer/listener-ini yaratması əvəzinə vahid idarə nöqtəsi:
 * yeni animasiyalı element sadəcə `data-scroll-anim` atributu ilə qeyd olunur.
 *
 * Progressive enhancement: JS işləməsə, elementlər əvvəlki kimi (hamısı işlək)
 * qalır — heç bir vizual reqressiya olmur.
 */
export default function ScrollAnimationManager() {
  useEffect(() => {
    // Reduced-motion istifadəçiləri üçün CSS onsuz da animasiyaları söndürür —
    // observer qurmağa ehtiyac yoxdur.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Görünəndə animasiya işlək, görünməyəndə dayandırılır.
          (entry.target as HTMLElement).classList.toggle(
            "anim-idle",
            !entry.isIntersecting,
          );
        }
      },
      // Ekrana girməzdən bir az əvvəl "isindirmək" üçün kiçik marja — element
      // görünən an artıq axar vəziyyətdə olsun, yarıda başlamış kimi görünməsin.
      { rootMargin: "150px 0px" },
    );

    const els = document.querySelectorAll<HTMLElement>("[data-scroll-anim]");
    els.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
