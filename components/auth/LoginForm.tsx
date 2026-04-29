"use client";

import { useState } from "react";
import { Mail, KeyRound, Gamepad2 } from "lucide-react";

export default function LoginForm({
  next = "/",
  onSuccess,
  onSwitchToRegister,
  onForgotPassword,
}: {
  next?: string;
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
  onForgotPassword?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = next;
      }
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Daxil olmaq alınmadı.");
    setBusy(false);
  }

  return (
    <div className="p-7">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40">
          <Gamepad2 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-tight">Yenidən xoş gəldin</h2>
          <p className="text-xs text-zinc-400">Hesabına daxil ol və alış-verişə davam et.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Field
          icon={<Mail className="h-4 w-4" />}
          type="email"
          placeholder="E-poçt"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          icon={<KeyRound className="h-4 w-4" />}
          type="password"
          placeholder="Şifrə"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        <div className="-mt-1 flex justify-end">
          {onForgotPassword ? (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              Şifrəni unutmusan?
            </button>
          ) : (
            <a
              href="/forgot-password"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              Şifrəni unutmusan?
            </a>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy ? "Daxil olunur…" : "Daxil ol"}
        </button>

        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
      </form>

      <p className="mt-6 text-center text-sm text-zinc-400">
        Yeni istifadəçisən?{" "}
        {onSwitchToRegister ? (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-medium text-indigo-400 hover:text-indigo-300"
          >
            Hesab yarat
          </button>
        ) : (
          <a href="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
            Hesab yarat
          </a>
        )}
      </p>
    </div>
  );
}

function Field({
  icon,
  type,
  placeholder,
  value,
  onChange,
  required,
  autoComplete,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
        {icon}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-3 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}
