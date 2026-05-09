"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink } from "lucide-react";
import { extractYouTubeId, youTubeEmbedUrl } from "@/lib/youtubeUtils";

/**
 * In-page trailer player. YouTube ID-si URL-dən çıxarılırsa iframe ilə oynadır,
 * yoxsa istifadəçini xarici linkə yönləndirir.
 *
 * Modal `document.body`-yə portal ilə render olunur ki, valideyn elementinin
 * `transform` və ya `filter` xüsusiyyətləri (məs: hover translate) `position:
 * fixed` davranışını sındırmasın və modal həmişə tam viewport-u tutsun.
 */
export default function TrailerModal({
  open,
  onClose,
  url,
  title,
}: {
  open: boolean;
  onClose: () => void;
  url: string | null;
  title?: string | null;
}) {
  // Portal yalnız client-də render olunur — server-də `document` mövcud deyil.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const id = extractYouTubeId(url);
  const embed = id ? youTubeEmbedUrl(id, { autoplay: true }) : null;

  const node = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Trailer"}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute -top-10 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        {embed ? (
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
            <iframe
              src={embed}
              title={title ?? "Trailer"}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          // YouTube ID parse oluna bilmədi — istifadəçini xarici linkə yönləndiririk.
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <p className="text-sm text-zinc-300">Trailer-i bu səhifədə oynatmaq mümkün deyil.</p>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
              >
                <ExternalLink className="h-4 w-4" /> Xarici linkdə aç
              </a>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Trailer linki yoxdur.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
