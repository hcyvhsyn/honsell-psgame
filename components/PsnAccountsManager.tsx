"use client";

import { useState } from "react";
import {
  Star,
  Trash2,
  Plus,
  CheckCircle2,
  Mail,
  KeyRound,
  Tag,
  Pencil,
} from "lucide-react";

export type PsnAccountSummary = {
  id: string;
  label: string;
  psnEmail: string;
  psnPassword: string;
  isDefault: boolean;
};

export default function PsnAccountsManager({
  initial,
}: {
  initial: PsnAccountSummary[];
}) {
  const [accounts, setAccounts] = useState<PsnAccountSummary[]>(initial);
  const [showForm, setShowForm] = useState(initial.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/profile/accounts");
    const data = await res.json();
    if (data?.accounts) setAccounts(data.accounts);
  }

  async function setDefault(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/profile/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (!res.ok) setError("Əsas hesabı yeniləmək alınmadı.");
    await refresh();
    setBusy(null);
  }

  async function remove(id: string) {
    if (!confirm("Bu PSN hesabını silmək istəyirsən?")) return;
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/profile/accounts/${id}`, { method: "DELETE" });
    if (!res.ok) setError("Hesabı silmək alınmadı.");
    await refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center text-sm text-zinc-400">
          Hələ hesab əlavə edilməyib. Aşağıda əlavə et.
        </p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((acc) => {
            if (editingId === acc.id) {
              return (
                <li key={acc.id}>
                  <EditAccountForm
                    account={acc}
                    onCancel={() => setEditingId(null)}
                    onSaved={async () => {
                      setEditingId(null);
                      await refresh();
                    }}
                  />
                </li>
              );
            }
            return (
              <li
                key={acc.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{acc.label}</span>
                      {acc.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                          <Star className="h-3 w-3" /> Əsas
                        </span>
                      )}
                    </div>
                    <div className="grid gap-1 text-xs sm:grid-cols-2">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Mail className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{acc.psnEmail}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <KeyRound className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="font-mono">{acc.psnPassword}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={busy === acc.id}
                      onClick={() => setEditingId(acc.id)}
                      className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                      aria-label="Redaktə et"
                      title="Redaktə et"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!acc.isDefault && (
                      <button
                        type="button"
                        disabled={busy === acc.id}
                        onClick={() => setDefault(acc.id)}
                        className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:border-indigo-500/60 hover:text-white disabled:opacity-50"
                      >
                        Əsas et
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy === acc.id}
                      onClick={() => remove(acc.id)}
                      className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
                      aria-label="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {showForm ? (
        <AddAccountForm
          onAdded={async () => {
            setShowForm(false);
            await refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:border-indigo-500/60 hover:text-white"
        >
          <Plus className="h-4 w-4" /> Başqa hesab əlavə et
        </button>
      )}
    </div>
  );
}

function AddAccountForm({
  onAdded,
  onCancel,
}: {
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ label: "", psnEmail: "", psnPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      setOk(true);
      setTimeout(onAdded, 400);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Hesab əlavə etmək alınmadı.");
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
    >
      <h3 className="text-sm font-semibold">PSN hesabı əlavə et</h3>
      <Field
        icon={<Tag className="h-4 w-4" />}
        placeholder="Ad (məs. Əsas, Qardaş, EU)"
        value={form.label}
        onChange={(v) => setForm({ ...form, label: v })}
        required
      />
      <Field
        icon={<Mail className="h-4 w-4" />}
        type="email"
        placeholder="PSN e-poçtu"
        value={form.psnEmail}
        onChange={(v) => setForm({ ...form, psnEmail: v })}
        required
      />
      <Field
        icon={<KeyRound className="h-4 w-4" />}
        placeholder="PSN şifrəsi"
        value={form.psnPassword}
        onChange={(v) => setForm({ ...form, psnPassword: v })}
        required
      />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={busy || ok}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {ok ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Yadda saxlandı
            </>
          ) : busy ? (
            "Saxlanılır…"
          ) : (
            "Hesabı yadda saxla"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Ləğv et
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Yalnız bu hesaba daxil olub alınan oyunları çatdırmaq üçün istifadə olunur.
      </p>
    </form>
  );
}

function EditAccountForm({
  account,
  onCancel,
  onSaved,
}: {
  account: PsnAccountSummary;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    label: account.label,
    psnEmail: account.psnEmail,
    psnPassword: account.psnPassword,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/profile/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Yenilənmə alınmadı.");
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4"
    >
      <h3 className="text-sm font-semibold">Hesabı redaktə et</h3>
      <Field
        icon={<Tag className="h-4 w-4" />}
        placeholder="Ad"
        value={form.label}
        onChange={(v) => setForm({ ...form, label: v })}
        required
      />
      <Field
        icon={<Mail className="h-4 w-4" />}
        type="email"
        placeholder="PSN e-poçtu"
        value={form.psnEmail}
        onChange={(v) => setForm({ ...form, psnEmail: v })}
        required
      />
      <Field
        icon={<KeyRound className="h-4 w-4" />}
        placeholder="PSN şifrəsi"
        value={form.psnPassword}
        onChange={(v) => setForm({ ...form, psnPassword: v })}
        required
      />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy ? "Saxlanılır…" : "Yadda saxla"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Ləğv et
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}

function Field({
  icon,
  ...rest
}: {
  icon: React.ReactNode;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
        {icon}
      </span>
      <input
        type={rest.type ?? "text"}
        placeholder={rest.placeholder}
        value={rest.value}
        onChange={(e) => rest.onChange(e.target.value)}
        required={rest.required}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2 pl-10 pr-3 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}
