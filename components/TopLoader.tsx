"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const COLOR = "#a855f7";
const HEIGHT = 3;

export default function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const start = () => {
    clearTimers();
    setVisible(true);
    setProgress(10);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const inc = p < 40 ? 8 : p < 70 ? 4 : 1.5;
        return Math.min(90, p + inc);
      });
    }, 200);
  };

  const done = () => {
    clearTimers();
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  };

  useEffect(() => {
    const isSameOriginNav = (anchor: HTMLAnchorElement, e: MouseEvent) => {
      if (!anchor.href) return false;
      if (e.defaultPrevented) return false;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
      if (e.button !== 0) return false;
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return false;
      if (anchor.hasAttribute("download")) return false;
      try {
        const url = new URL(anchor.href);
        if (url.origin !== window.location.origin) return false;
        const samePath =
          url.pathname === window.location.pathname &&
          url.search === window.location.search;
        if (samePath && url.hash) return false;
        if (samePath && !url.hash) return false;
        return true;
      } catch {
        return false;
      }
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (anchor && isSameOriginNav(anchor, e)) {
        start();
        return;
      }
      const trigger = target.closest("[data-toploader]") as HTMLElement | null;
      if (trigger) {
        start();
      }
    };

    const onSubmit = () => start();

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  useEffect(() => {
    if (visible) done();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: HEIGHT,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: COLOR,
          boxShadow: `0 0 10px ${COLOR}, 0 0 6px ${COLOR}`,
          transition: "width 200ms ease-out, opacity 300ms ease",
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
