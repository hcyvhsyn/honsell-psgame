"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCheck, ShieldCheck, Trash2, X } from "lucide-react";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  isAllSelected: (ids: string[]) => boolean;
};

const SelectionContext = createContext<Ctx | null>(null);

export function UsersSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isAllSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected]
  );

  const value = useMemo(
    () => ({ selected, toggle, toggleAll, clear, isAllSelected }),
    [selected, toggle, toggleAll, clear, isAllSelected]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useUsersSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("UsersSelectionProvider missing");
  return ctx;
}

export function RowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useUsersSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={(e) => {
        e.stopPropagation();
        toggle(id);
      }}
      onClick={(e) => e.stopPropagation()}
      className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500"
    />
  );
}

export function HeaderCheckbox({ ids }: { ids: string[] }) {
  const { toggleAll, isAllSelected } = useUsersSelection();
  const checked = isAllSelected(ids);
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => toggleAll(ids)}
      className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500"
    />
  );
}

export function BulkActionBar() {
  const router = useRouter();
  const { selected, clear } = useUsersSelection();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"disable" | "enable" | "delete" | "verify" | null>(null);

  if (selected.size === 0) return null;

  function run(action: "disable" | "enable" | "verify" | "delete") {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userIds: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Əməliyyat alınmadı");
        return;
      }
      clear();
      setMode(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="sticky bottom-4 z-30 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-indigo-500/40 bg-zinc-950/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-200">
            {selected.size}
          </span>
          <span className="text-zinc-300">istifadəçi seçildi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BulkBtn icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={() => setMode("verify")} disabled={pending}>
            Verify
          </BulkBtn>
          <BulkBtn icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setMode("enable")} disabled={pending}>
            Aktiv et
          </BulkBtn>
          <BulkBtn icon={<Ban className="h-3.5 w-3.5" />} onClick={() => setMode("disable")} disabled={pending} tone="amber">
            Blokla
          </BulkBtn>
          <BulkBtn icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setMode("delete")} disabled={pending} tone="rose">
            Sil
          </BulkBtn>
          <button
            type="button"
            onClick={clear}
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            title="Seçimi təmizlə"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mode && (
        <ConfirmDialog
          mode={mode}
          count={selected.size}
          pending={pending}
          error={error}
          onCancel={() => setMode(null)}
          onConfirm={() => run(mode)}
        />
      )}
    </>
  );
}

function BulkBtn({
  icon,
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "amber" | "rose";
}) {
  const cls =
    tone === "rose"
      ? "text-rose-300 ring-rose-500/30 hover:bg-rose-500/10"
      : tone === "amber"
        ? "text-amber-300 ring-amber-500/30 hover:bg-amber-500/10"
        : "text-zinc-300 ring-zinc-800 hover:bg-zinc-900";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 transition disabled:opacity-50 ${cls}`}
    >
      {icon}
      {children}
    </button>
  );
}

function ConfirmDialog({
  mode,
  count,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  mode: "disable" | "enable" | "delete" | "verify";
  count: number;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const labels: Record<typeof mode, { title: string; desc: string; btn: string; tone: string }> = {
    disable: {
      title: `${count} istifadəçini bloklamaq?`,
      desc: "Seçilmiş istifadəçilər saytda hesablarına daxil ola bilməyəcəklər.",
      btn: "Blokla",
      tone: "amber",
    },
    enable: {
      title: `${count} istifadəçini aktiv etmək?`,
      desc: "Bloklanmış hesablar yenidən aktivləşəcək.",
      btn: "Aktiv et",
      tone: "emerald",
    },
    verify: {
      title: `${count} istifadəçini verify etmək?`,
      desc: "Seçilmiş hesabların emailVerified statusu true olacaq.",
      btn: "Verify",
      tone: "emerald",
    },
    delete: {
      title: `${count} istifadəçini silmək?`,
      desc: "Bu istifadəçilər və onların bütün tranzaksiya tarixçəsi silinəcək. Geri qaytarıla bilməz.",
      btn: "Sil",
      tone: "rose",
    },
  };
  const l = labels[mode];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => !pending && onCancel()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
      >
        <h3 className="text-base font-semibold text-zinc-100">{l.title}</h3>
        <p className="mt-2 text-sm text-zinc-400">{l.desc}</p>
        {error && (
          <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-900 disabled:opacity-50"
          >
            Ləğv et
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-md px-3 py-2 text-sm font-semibold ring-1 transition disabled:opacity-50 ${
              l.tone === "rose"
                ? "bg-rose-500/15 text-rose-200 ring-rose-500/40 hover:bg-rose-500/25"
                : l.tone === "amber"
                  ? "bg-amber-500/15 text-amber-200 ring-amber-500/40 hover:bg-amber-500/25"
                  : "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40 hover:bg-emerald-500/25"
            }`}
          >
            {pending ? "Gözləyin…" : l.btn}
          </button>
        </div>
      </div>
    </div>
  );
}
