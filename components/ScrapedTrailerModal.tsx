"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, ExternalLink, Film } from "lucide-react";
import type { ScrapedCardData } from "@/components/ScrapedTitleCard";

type State =
  | { status: "loading" }
  | { status: "ready"; key: string }
  | { status: "none" };

/**
 * Scrape başlığı üçün fragman modalı. Açılanda `/api/streaming/trailer?id=`
 * çağırır — trailer tapılsa YouTube embed edir, tapılmasa platformada açmaq
 * üçün deep link göstərir.
 *
 * `document.body`-yə portal ilə render olunur — kartların hover `translate`-i
 * `position: fixed`-i sındırmasın.
 */
export default function ScrapedTrailerModal({
  data,
  onClose,
}: {
  data: ScrapedCardData | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/streaming/trailer?id=${encodeURIComponent(data.id)}`)
      .then((r) => r.json())
      .then((j: { key: string | null }) => {
        if (!cancelled) setState(j.key ? { status: "ready", key: j.key } : { status: "none" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [data, onClose]);

  if (!data || !mounted) return null;

  const deepLink = data.platforms.find((p) => p.deepLinkUrl)?.deepLinkUrl ?? null;

  const node = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={data.title}
    >
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute -top-10 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          {state.status === "loading" && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          )}

          {state.status === "ready" && (
            <iframe
              src={`https://www.youtube.com/embed/${state.key}?autoplay=1&rel=0`}
              title={`${data.title} — fragman`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}

          {state.status === "none" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Film className="h-10 w-10 text-zinc-600" />
              <p className="text-sm text-zinc-300">{data.title} üçün fragman tapılmadı.</p>
              {deepLink && (
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
                >
                  Platformada aç <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
