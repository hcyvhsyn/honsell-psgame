"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Gamepad2, Mail, KeyRound } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const search = useSearchParams();
  const next = search.get("next") || "/";

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
      window.location.href = next;
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Daxil olmaq alınmadı.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40">
            <Gamepad2 className="h-4 w-4" />
          </span>
          <span className="text-lg font-semibold">Honsell PS Store</span>
        </Link>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7 shadow-xl shadow-black/30">
          <h1 className="text-xl font-semibold">Yenidən xoş gəldin</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Alış-verişə davam etmək üçün daxil ol.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <Field
              icon={<Mail className="h-4 w-4" />}
              type="email"
              placeholder="E-poçt"
              value={email}
              onChange={setEmail}
              required
            />
            <Field
              icon={<KeyRound className="h-4 w-4" />}
              type="password"
              placeholder="Şifrə"
              value={password}
              onChange={setPassword}
              required
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy ? "Daxil olunur…" : "Daxil ol"}
            </button>

            {error && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Yeni istifadəçisən?{" "}
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300">
              Hesab yarat
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  icon,
  ...rest
}: {
  icon: React.ReactNode;
  type: string;
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
        type={rest.type}
        placeholder={rest.placeholder}
        value={rest.value}
        onChange={(e) => rest.onChange(e.target.value)}
        required={rest.required}
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-3 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}
