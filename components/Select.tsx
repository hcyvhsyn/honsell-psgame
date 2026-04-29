"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string };

export default function Select({
  value,
  onChange,
  options,
  icon,
  placeholder = "Seç…",
  ariaLabel,
  invalid,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  icon?: React.ReactNode;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opt = options[active];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, active, onChange]);

  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      setActive(i >= 0 ? i : 0);
    }
  }, [open, options, value]);

  const triggerBorder = invalid
    ? "border-red-500/60 focus:border-red-500/80"
    : open
      ? "border-indigo-500/60 ring-2 ring-indigo-500/20"
      : "border-zinc-800 hover:border-zinc-700";

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-md border bg-zinc-950 py-2 pl-3 pr-2 text-sm transition ${triggerBorder}`}
      >
        {icon && <span className="text-zinc-500">{icon}</span>}
        <span
          className={`flex-1 truncate text-left ${
            selected ? "text-zinc-100" : "text-zinc-500"
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 z-30 mt-1.5 origin-top overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/95 p-1 shadow-2xl shadow-black/60 ring-1 ring-black/40 backdrop-blur"
          style={{ animation: "select-in 140ms ease-out" }}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isActive = i === active;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-indigo-500/15 text-indigo-100"
                    : isActive
                      ? "bg-zinc-800/70 text-zinc-100"
                      : "text-zinc-300"
                }`}
              >
                <span className="flex flex-col">
                  <span>{o.label}</span>
                  {o.hint && (
                    <span className="text-[11px] text-zinc-500">{o.hint}</span>
                  )}
                </span>
                {isSelected ? (
                  <Check className="h-4 w-4 text-indigo-300" />
                ) : (
                  <span className="h-4 w-4" />
                )}
              </button>
            );
          })}
          <style jsx>{`
            @keyframes select-in {
              from {
                opacity: 0;
                transform: translateY(-4px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
