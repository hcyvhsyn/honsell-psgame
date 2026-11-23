"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, CircleDot, PlayCircle, X } from "lucide-react";
import type { ShowcaseGuide } from "@/lib/homeSubscriptionShowcase";
import type { VariantFeatureTone } from "@/lib/streamingVariants";
import { youTubeEmbedUrl } from "@/lib/youtubeUtils";

const TONE_ICON: Record<VariantFeatureTone, { Icon: typeof Check; cls: string }> = {
  good: { Icon: Check, cls: "text-emerald-500 dark:text-emerald-400" },
  bad: { Icon: X, cls: "text-rose-500 dark:text-rose-400" },
  warn: { Icon: AlertTriangle, cls: "text-amber-500 dark:text-amber-300" },
  neutral: { Icon: CircleDot, cls: "text-zinc-400" },
};

/**
 * Vitrindəki "Aralarındakı fərq nədir?" bölməsi + modal: YouTube videosu (admin linki varsa) və
 * plan müqayisəsi (həmişə). iframe yalnız modal açılanda qurulur — ana səhifə YouTube yükləmir.
 * Modal `document.body`-yə portal olunur; blur yoxdur (performans qaydası).
 */
export default function HomePlanGuide({ guide }: { guide: ShowcaseGuide }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hasVideo = Boolean(guide.videoId);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-6 flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-violet-400/60 sm:p-5"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
          <PlayCircle className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black text-white sm:text-lg">Aralarındakı fərq nədir?</span>
          <span className="mt-0.5 block text-sm font-medium text-zinc-400">
            {hasVideo
              ? "Planların fərqini qısa videoda izah edirik"
              : "Planların fərqi bir baxışda — hansı sənə uyğundur?"}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-violet-500 sm:inline-flex">
          {hasVideo ? "Videoya bax" : "Müqayisə et"}
        </span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            // z-[140]: AI düyməsi (130), tema açarı (110) və alt menyudan (70) yuxarı; Epoint widget-i (200) isə üstdə qalır.
            className="fixed inset-0 z-[140] flex items-end justify-center bg-black/80 sm:items-center sm:p-6"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-guide-title"
          >
            <div
              className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white sm:rounded-3xl sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 id="plan-guide-title" className="text-lg font-black leading-tight text-white sm:text-2xl">
                  {guide.title}
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Bağla"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-800 text-zinc-300 transition hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {guide.videoId && (
                <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
                  <iframe
                    src={youTubeEmbedUrl(guide.videoId, { autoplay: true })}
                    title={guide.title}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              )}

              <div className={`space-y-6 ${guide.videoId ? "mt-6" : ""}`}>
                {guide.groups.map((group) => (
                  <section key={group.title}>
                    <h3 className="text-base font-black text-white">{group.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{group.intro}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {group.plans.map((plan) => (
                        <div key={plan.name} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                          <p className="text-sm font-black text-white">{plan.name}</p>
                          <ul className="mt-2 space-y-1.5">
                            {plan.points.map((point) => {
                              const { Icon, cls } = TONE_ICON[point.tone];
                              return (
                                <li key={point.text} className="flex gap-2 text-xs leading-5 text-zinc-300">
                                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cls}`} aria-hidden />
                                  {point.text}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
