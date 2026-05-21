"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Info, ShieldAlert, X } from "lucide-react";

type Tone = "default" | "danger" | "warning";

type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
};

type AlertOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  tone?: Tone;
};

type DialogState =
  | (ConfirmOptions & { kind: "confirm"; resolve: (v: boolean) => void })
  | (AlertOptions & { kind: "alert"; resolve: () => void });

type DialogCtx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
};

const Ctx = createContext<DialogCtx | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ kind: "confirm", ...opts, resolve });
      }),
    [],
  );

  const alertFn = useCallback(
    (opts: AlertOptions) =>
      new Promise<void>((resolve) => {
        setState({ kind: "alert", ...opts, resolve });
      }),
    [],
  );

  const closeWith = useCallback(
    (value: boolean) => {
      if (!state) return;
      if (state.kind === "confirm") state.resolve(value);
      else state.resolve();
      setState(null);
    },
    [state],
  );

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeWith(false);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        closeWith(true);
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => confirmBtnRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      window.clearTimeout(id);
    };
  }, [state, closeWith]);

  return (
    <Ctx.Provider value={{ confirm, alert: alertFn }}>
      {children}
      {state ? (
        <DialogShell state={state} confirmBtnRef={confirmBtnRef} onClose={closeWith} />
      ) : null}
    </Ctx.Provider>
  );
}

export function useDialog(): DialogCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}

const TONE_STYLES: Record<
  Tone,
  {
    ring: string;
    iconBg: string;
    iconText: string;
    Icon: typeof AlertTriangle;
    confirmBtn: string;
  }
> = {
  default: {
    ring: "ring-indigo-500/30",
    iconBg: "bg-indigo-500/15",
    iconText: "text-indigo-300",
    Icon: Info,
    confirmBtn:
      "bg-indigo-500 text-white hover:bg-indigo-400 focus-visible:ring-indigo-400/40",
  },
  warning: {
    ring: "ring-amber-500/30",
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-300",
    Icon: AlertTriangle,
    confirmBtn:
      "bg-amber-500 text-zinc-900 hover:bg-amber-400 focus-visible:ring-amber-400/40",
  },
  danger: {
    ring: "ring-rose-500/30",
    iconBg: "bg-rose-500/15",
    iconText: "text-rose-300",
    Icon: ShieldAlert,
    confirmBtn:
      "bg-rose-500 text-white hover:bg-rose-400 focus-visible:ring-rose-400/40",
  },
};

function DialogShell({
  state,
  confirmBtnRef,
  onClose,
}: {
  state: DialogState;
  confirmBtnRef: React.RefObject<HTMLButtonElement>;
  onClose: (value: boolean) => void;
}) {
  const tone: Tone = state.tone ?? "default";
  const t = TONE_STYLES[tone];
  const Icon = t.Icon;
  const isConfirm = state.kind === "confirm";

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={() => onClose(false)}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl ring-1 ${t.ring}`}
      >
        <button
          type="button"
          aria-label="Bağla"
          onClick={() => onClose(false)}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4 p-6 pr-12">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.iconBg}`}
          >
            <Icon className={`h-5 w-5 ${t.iconText}`} />
          </div>
          <div className="min-w-0">
            <h3 id="dialog-title" className="text-base font-semibold text-white">
              {state.title}
            </h3>
            {state.message ? (
              <div className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {state.message}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800/70 bg-zinc-900/40 px-5 py-3">
          {isConfirm ? (
            <button
              type="button"
              onClick={() => onClose(false)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40"
            >
              {state.cancelLabel ?? "Ləğv et"}
            </button>
          ) : null}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => onClose(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 ${t.confirmBtn}`}
          >
            {state.confirmLabel ?? (isConfirm ? "Təsdiq et" : "Anladım")}
          </button>
        </div>
      </div>
    </div>
  );
}
