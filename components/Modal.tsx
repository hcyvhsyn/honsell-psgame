"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
} as const;

export default function Modal({
  open,
  onClose,
  children,
  size = "md",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof SIZE_CLASSES;
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
    >
      <div
        aria-hidden
        onClick={closeOnBackdrop ? onClose : undefined}
        className="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        className={`modal-panel relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 sm:rounded-2xl ${SIZE_CLASSES[size]}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Bağla"
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
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
    </div>
  );
}
