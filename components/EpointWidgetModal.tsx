"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  widgetUrl: string;
  successUrl: string;
  errorUrl: string;
  title?: string;
  onClose: () => void;
};

type WidgetMessage = {
  status?: string;
  payment?: Record<string, unknown>;
  message?: string;
};

function isEpointMessage(value: unknown): value is WidgetMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.status === "string" || typeof v.payment === "object";
}

export default function EpointWidgetModal({
  widgetUrl,
  successUrl,
  errorUrl,
  title = "Google Pay",
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      let widgetOrigin: string;
      try {
        widgetOrigin = new URL(widgetUrl).origin;
      } catch {
        return;
      }
      // DEBUG: prod-da Epoint-in göndərdiyi mesajları görmək üçün
      console.log("[epoint-widget] message", {
        origin: event.origin,
        expectedOrigin: widgetOrigin,
        data: event.data,
      });
      if (event.origin !== widgetOrigin) return;

      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!isEpointMessage(payload)) return;
      const status = String(payload.status ?? "").toLowerCase();
      if (!status) return;

      if (status === "success") {
        setResolved(true);
        window.location.href = successUrl;
      } else if (status === "error" || status === "failed" || status === "declined") {
        setResolved(true);
        window.location.href = errorUrl;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetUrl, successUrl, errorUrl]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={resolved}
            className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50"
            aria-label="Bağla"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative h-[640px] max-h-[78vh] w-full bg-white">
          {loading ? (
            <div className="absolute inset-0 grid place-items-center bg-white">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
            </div>
          ) : null}
          <iframe
            ref={iframeRef}
            src={widgetUrl}
            title={title}
            allow="payment"
            onLoad={() => {
              setLoading(false);
              // Epoint widget bəzən iframe-i success_redirect_url / error_redirect_url-ə
              // yönləndirir (postMessage göndərmədən). Eyni-origin olduğu üçün
              // iframe.contentWindow.location-u oxuya bilirik.
              const frame = iframeRef.current;
              if (!frame || resolved) return;
              try {
                const href = frame.contentWindow?.location.href;
                if (!href) return;
                const url = new URL(href);
                if (url.origin !== window.location.origin) return;
                if (url.pathname.startsWith("/success") || url.pathname.startsWith("/succeess")) {
                  setResolved(true);
                  window.location.href = successUrl;
                } else if (url.pathname.startsWith("/error")) {
                  setResolved(true);
                  window.location.href = errorUrl;
                }
              } catch {
                // Cross-origin — keçmiş.
              }
            }}
            className="h-full w-full border-0"
          />
        </div>

        <footer className="border-t border-zinc-800/80 bg-zinc-900/60 px-4 py-2 text-[11px] text-zinc-500">
          Ödəniş Epoint vasitəsilə təhlükəsiz şəkildə icra olunur. Pəncərəni
          ödəniş bitənədək bağlamayın.
        </footer>
      </div>
    </div>
  );
}
