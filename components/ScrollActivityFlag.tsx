"use client";

import { useEffect } from "react";

/**
 * Sayt boyu (root layout-da) qoşulan minik scroll-vəziyyət bayrağı.
 *
 * Scroll gedərkən <html>-ə `is-scrolling` sinfini əlavə edir və scroll bitəndən
 * ~140ms sonra silir. globals.css bu sinfə görə bütün dekorativ `@keyframes`
 * animasiyalarını müvəqqəti dayandırır.
 *
 * Səbəb: həmişə görünən header-də bir neçə `infinite` animasiya `filter:
 * drop-shadow` və `background-position` kimi paint-tələb edən propertyləri hər
 * frame-də dəyişir. Scroll zamanı bu, kompozitoru scroll ilə birlikdə yükləyib
 * "boş/qara zolaq" yaradır. Scroll müddətində animasiyaları dayandırmaqla
 * kompozitor yalnız scroll-a fokuslanır; scroll bitən kimi animasiyalar davam
 * edir. Bu, header bütün səhifələrdə olduğu üçün qlobal qoşulur.
 *
 * Yalnız `animation-play-state`-ə təsir edir — hover/state `transition`-ları
 * toxunulmaz qalır. `passive` listener kompozitoru bloklamır.
 */
export default function ScrollActivityFlag() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let timer: number | undefined;
    let scrolling = false;

    const onScroll = () => {
      if (!scrolling) {
        scrolling = true;
        root.classList.add("is-scrolling");
      }
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        scrolling = false;
        root.classList.remove("is-scrolling");
      }, 140);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) window.clearTimeout(timer);
      root.classList.remove("is-scrolling");
    };
  }, []);

  return null;
}
