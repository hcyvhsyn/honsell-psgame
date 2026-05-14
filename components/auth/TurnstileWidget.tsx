"use client";

import { useEffect, useRef } from "react";

type TurnstileGlobal = {
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      action?: string;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
    __honsellTurnstileLoaded?: boolean;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile(): Promise<TurnstileGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("not browser"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    if (!window.__honsellTurnstileLoaded) {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error("turnstile script load failed"));
      document.head.appendChild(script);
      window.__honsellTurnstileLoaded = true;
    }
    const start = Date.now();
    const tick = () => {
      if (window.turnstile) return resolve(window.turnstile);
      if (Date.now() - start > 10000) return reject(new Error("turnstile timeout"));
      setTimeout(tick, 100);
    };
    tick();
  });
}

/**
 * Cloudflare Turnstile captcha widget. Token alındıqda `onToken` çağırılır,
 * captcha vaxtı keçəndə `onToken("")` çağırılır ki, parent yenidən tələb etsin.
 *
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY yoxdursa widget render olunmur (dev mühit).
 */
export default function TurnstileWidget({
  onToken,
  action,
}: {
  onToken: (token: string) => void;
  action?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadTurnstile()
      .then((t) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = t.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token),
          "error-callback": () => onToken(""),
          "expired-callback": () => onToken(""),
          theme: "dark",
          action,
        });
      })
      .catch((err) => {
        console.error("[turnstile] load failed", err);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
    // siteKey/action stabil olduğu üçün sadəcə mount-da render edirik
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!siteKey) return null;
  return <div ref={containerRef} className="cf-turnstile" />;
}
