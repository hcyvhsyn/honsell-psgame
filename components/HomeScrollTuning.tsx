"use client";

import { useEffect } from "react";

/**
 * Ana səhifə üçün şəkil ön-yükləmə optimallaşdırması (yalnız client tərəfdə,
 * heç bir görünən element render etmir).
 *
 * Viewport-dan ~1200px qabaqdakı `loading="lazy"` şəkilləri "eager"-ə çevirib
 * indidən yüklənməyə məcbur edir — beləcə sürətli scroll-da şəkillər hazır olur.
 *
 * QEYD: Əvvəl burada `wheel` hadisəsini tutub scroll sürətini 90px/hadisə ilə
 * məhdudlaşdıran məntiq var idi. Bu, sürətli scroll-da native momentum-u kəsib
 * "tutulma/donma" effekti yaradırdı — ona görə tamamilə silindi. Native scroll
 * həm daha hamar, həm passiv (kompozitoru bloklamır).
 */
export default function HomeScrollTuning() {
  useEffect(() => {
    const PRELOAD_MARGIN = "1200px 0px";

    const promote = (img: HTMLImageElement) => {
      if (img.dataset.preloaded === "1") return;
      img.dataset.preloaded = "1";
      // Lazy → eager: brauzer şəkili dərhal yükləməyə başlayır.
      img.loading = "eager";
      img.setAttribute("fetchpriority", "high");
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            promote(entry.target as HTMLImageElement);
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    );

    const observeLazyImages = () => {
      document
        .querySelectorAll<HTMLImageElement>('img[loading="lazy"]:not([data-preloaded])')
        .forEach((img) => io.observe(img));
    };

    observeLazyImages();

    // Sonradan əlavə olunan şəkilləri (karusel, lazy bölmələr) də izlə — amma
    // tam-sənəd querySelectorAll bahalıdır. Geri sayğacların hər saniyəlik DOM
    // dəyişiklikləri kimi partlamaları birləşdirmək üçün debounce + idle edirik
    // ki, scroll zamanı əsas thread-ə yığılmasın.
    let scanScheduled = false;
    const scheduleScan = () => {
      if (scanScheduled) return;
      scanScheduled = true;
      const run = () => {
        scanScheduled = false;
        observeLazyImages();
      };
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(run, { timeout: 500 });
      } else {
        window.setTimeout(run, 200);
      }
    };

    const mo = new MutationObserver((records) => {
      // Yalnız ELEMENT əlavə olunan mutasiyalara reaksiya ver — mətn/atribut
      // dəyişiklikləri (geri sayğac və s.) yeni şəkil gətirmir.
      for (const r of records) {
        if (r.addedNodes.length > 0) {
          scheduleScan();
          return;
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
