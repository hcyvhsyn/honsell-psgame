"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Filter, RotateCcw, Search } from "lucide-react";

type FilterState = {
  q: string;
  status: string;
  role: string;
  hasOrders: string;
  walletMin: string;
  walletMax: string;
  from: string;
  to: string;
};

function emptyState(sp: URLSearchParams): FilterState {
  return {
    q: sp.get("q") ?? "",
    status: sp.get("status") ?? "",
    role: sp.get("role") ?? "",
    hasOrders: sp.get("hasOrders") ?? "",
    walletMin: sp.get("walletMin") ?? "",
    walletMax: sp.get("walletMax") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
  };
}

export default function UsersFiltersBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FilterState>(() => emptyState(sp));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setState(emptyState(sp));
  }, [sp]);

  const activeCount = [
    state.status,
    state.role,
    state.hasOrders,
    state.walletMin,
    state.walletMax,
    state.from,
    state.to,
  ].filter(Boolean).length;

  function apply(next: FilterState) {
    const params = new URLSearchParams(sp.toString());
    const set = (k: string, v: string) => {
      if (v) params.set(k, v);
      else params.delete(k);
    };
    set("q", next.q);
    set("status", next.status);
    set("role", next.role);
    set("hasOrders", next.hasOrders);
    set("walletMin", next.walletMin);
    set("walletMax", next.walletMax);
    set("from", next.from);
    set("to", next.to);
    params.delete("page");
    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`);
    });
  }

  function reset() {
    apply({
      q: "",
      status: "",
      role: "",
      hasOrders: "",
      walletMin: "",
      walletMax: "",
      from: "",
      to: "",
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            apply(state);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            value={state.q}
            onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
            placeholder="Email, ad, telefon, referral kod…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </form>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
            activeCount > 0
              ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
              : "border-zinc-800 text-zinc-300 hover:bg-zinc-900"
          }`}
        >
          <Filter className="h-4 w-4" />
          Filtrlər
          {activeCount > 0 && (
            <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Sıfırla
          </button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status">
            <select
              value={state.status}
              onChange={(e) => setState((s) => ({ ...s, status: e.target.value }))}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Hamısı</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="disabled">Bloklanmış</option>
            </select>
          </Field>

          <Field label="Rol">
            <select
              value={state.role}
              onChange={(e) => setState((s) => ({ ...s, role: e.target.value }))}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Hamısı</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </Field>

          <Field label="Sifariş">
            <select
              value={state.hasOrders}
              onChange={(e) => setState((s) => ({ ...s, hasOrders: e.target.value }))}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Hamısı</option>
              <option value="yes">Sifariş verib</option>
              <option value="no">Heç sifariş verməyib</option>
            </select>
          </Field>

          <Field label="Cüzdan (AZN)">
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                placeholder="min"
                value={state.walletMin}
                onChange={(e) => setState((s) => ({ ...s, walletMin: e.target.value }))}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-zinc-600">—</span>
              <input
                inputMode="decimal"
                placeholder="max"
                value={state.walletMax}
                onChange={(e) => setState((s) => ({ ...s, walletMax: e.target.value }))}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </Field>

          <Field label="Qeydiyyat (başlanğıc)">
            <input
              type="date"
              value={state.from}
              onChange={(e) => setState((s) => ({ ...s, from: e.target.value }))}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </Field>

          <Field label="Qeydiyyat (son)">
            <input
              type="date"
              value={state.to}
              onChange={(e) => setState((s) => ({ ...s, to: e.target.value }))}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </Field>

          <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Təmizlə
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => apply(state)}
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {pending ? "Tətbiq olunur…" : "Tətbiq et"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
