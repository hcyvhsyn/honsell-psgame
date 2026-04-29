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
  Gamepad2,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import Select from "./Select";

export type PsnAccountSummary = {
  id: string;
  label: string;
  psnEmail: string;
  psnPassword: string;
  psModel: string;
  isDefault: boolean;
};

const PS_MODEL_OPTIONS = [
  { value: "PS5", label: "PlayStation 5" },
  { value: "PS4", label: "PlayStation 4" },
];

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
              <li key={acc.id}>
                <AccountCard
                  account={acc}
                  busy={busy === acc.id}
                  onEdit={() => setEditingId(acc.id)}
                  onSetDefault={() => setDefault(acc.id)}
                  onRemove={() => remove(acc.id)}
                />
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

function PsModelBadge({ model }: { model: string }) {
  const isPS5 = model === "PS5";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        isPS5
          ? "bg-sky-500/15 text-sky-300 ring-sky-500/30"
          : "bg-zinc-700/40 text-zinc-300 ring-zinc-600/30"
      }`}
    >
      {model}
    </span>
  );
}

function AccountCard({
  account,
  busy,
  onEdit,
  onSetDefault,
  onRemove,
}: {
  account: PsnAccountSummary;
  busy: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onRemove: () => void;
}) {
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  async function copy(field: "email" | "password", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  }

  const isPS5 = account.psModel === "PS5";

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition ${
        account.isDefault
          ? "border-indigo-500/40 from-indigo-950/40 via-zinc-900/40 to-zinc-950"
          : "border-zinc-800 from-zinc-900/60 via-zinc-900/30 to-zinc-950 hover:border-zinc-700"
      }`}
    >
      {account.isDefault && (
        <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-indigo-500/15 blur-2xl" />
      )}

      <div className="relative flex items-start gap-4">
        {/* Console mark */}
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 ${
            isPS5
              ? "bg-sky-500/15 text-sky-300 ring-sky-500/30"
              : "bg-zinc-800/80 text-zinc-300 ring-zinc-700/60"
          }`}
        >
          <Gamepad2 className="h-6 w-6" />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-white">
              {account.label}
            </h3>
            <PsModelBadge model={account.psModel} />
            {account.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200 ring-1 ring-indigo-500/40">
                <Star className="h-3 w-3 fill-indigo-300 text-indigo-300" /> Əsas
              </span>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <CopyRow
              icon={<Mail className="h-3.5 w-3.5" />}
              label="E-poçt"
              value={account.psnEmail}
              copied={copied === "email"}
              onCopy={() => copy("email", account.psnEmail)}
            />
            <CopyRow
              icon={<KeyRound className="h-3.5 w-3.5" />}
              label="Şifrə"
              value={showPwd ? account.psnPassword : "••••••••••"}
              mono
              copied={copied === "password"}
              onCopy={() => copy("password", account.psnPassword)}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Şifrəni gizlət" : "Şifrəni göstər"}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  {showPwd ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              }
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onEdit}
              className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
              aria-label="Redaktə et"
              title="Redaktə et"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
              aria-label="Sil"
              title="Sil"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {!account.isDefault && (
            <button
              type="button"
              disabled={busy}
              onClick={onSetDefault}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-indigo-500/60 hover:text-white disabled:opacity-50"
            >
              <Star className="h-3 w-3" /> Əsas et
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyRow({
  icon,
  label,
  value,
  mono,
  trailing,
  copied,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  trailing?: React.ReactNode;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-2.5 py-1.5">
      <span className="text-zinc-500">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span
          className={`truncate text-xs text-zinc-200 ${mono ? "font-mono tracking-wide" : ""}`}
        >
          {value}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {trailing}
        <button
          type="button"
          onClick={onCopy}
          aria-label="Kopyala"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
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
  const [form, setForm] = useState({
    label: "",
    psnEmail: "",
    psnPassword: "",
    psModel: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModelError, setShowModelError] = useState(false);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.psModel) {
      setShowModelError(true);
      return;
    }
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

      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
          <Gamepad2 className="h-3.5 w-3.5" /> PlayStation modeli
          <span className="text-rose-400">*</span>
        </label>
        <Select
          icon={<Gamepad2 className="h-4 w-4" />}
          value={form.psModel}
          onChange={(v) => {
            setForm({ ...form, psModel: v });
            setShowModelError(false);
          }}
          options={PS_MODEL_OPTIONS}
          placeholder="PS4 və ya PS5 seç"
          ariaLabel="PlayStation modeli"
          invalid={showModelError}
        />
        {showModelError && (
          <p className="mt-1 text-xs text-rose-400">
            Konsol modelini seçmək tələb olunur.
          </p>
        )}
      </div>

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
    psModel: account.psModel,
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

      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
          <Gamepad2 className="h-3.5 w-3.5" /> PlayStation modeli
        </label>
        <Select
          icon={<Gamepad2 className="h-4 w-4" />}
          value={form.psModel}
          onChange={(v) => setForm({ ...form, psModel: v })}
          options={PS_MODEL_OPTIONS}
          placeholder="PS4 və ya PS5 seç"
          ariaLabel="PlayStation modeli"
        />
      </div>

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
