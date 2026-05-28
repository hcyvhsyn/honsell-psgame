"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  auth: "max-w-2xl",
  xl: "max-w-5xl",
} as const;

export default function Modal({
  open,
  onClose,
  children,
  size = "md",
  closeOnBackdrop = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof SIZE_CLASSES;
  closeOnBackdrop?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Lock background scroll (body + html). This is important on mobile Safari.
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    document.documentElement.style.overscrollBehavior = "contain";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
    >
      <div
        aria-hidden
        onClick={closeOnBackdrop ? onClose : undefined}
        className="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        className={`modal-panel relative max-h-[92vh] max-h-[92dvh] w-full overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 shadow-2xl shadow-black/60 ${SIZE_CLASSES[size]}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-[12px] border border-white/10 bg-white/[0.04] text-zinc-500 dark:text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-violet-300/30 hover:bg-white/[0.08] hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <X className="h-6 w-6" />
        </button>
        {children}
      </div>
      <style jsx>{`
        .modal-backdrop {
          animation: modal-fade 150ms ease-out;
        }
        .modal-panel {
          animation: modal-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes modal-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
