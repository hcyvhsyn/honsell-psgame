"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, KeyRound, Eye, EyeOff, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";

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
  const [showPw, setShowPw] = useState(false);
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
    if (res.ok) { window.location.href = next; return; }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Daxil olmaq alınmadı.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Left — branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-zinc-900 to-zinc-950 px-12 py-10 lg:flex lg:w-1/2">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-fuchsia-700/15 blur-3xl" />

        {/* PS symbols background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
          <svg viewBox="0 0 400 400" className="h-full w-full" fill="none" stroke="white" strokeWidth="1">
            <circle cx="200" cy="200" r="150" />
            <path d="M200 80 L310 270 H90 Z" />
            <path d="M140 140 L260 260 M260 140 L140 260" />
            <rect x="130" y="130" width="140" height="140" rx="4" />
          </svg>
        </div>

        <Logo href="/" height={28} />

        <div className="relative">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Honsell PS Store</p>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-white">
            PlayStation<br />dünyasına<br />xoş gəldin.
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
            Ən sərfəli qiymətlərlə oyunlar, TRY balans gift kartları, PS Plus abunəliyi və hesab açılışı xidmətləri.
          </p>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
          {[
            { label: "Oyun", value: "5000+" },
            { label: "Müştəri", value: "2000+" },
            { label: "Cavab vaxtı", value: "<1 saat" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Logo href="/" height={28} />
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold">Yenidən xoş gəldin</h2>
          <p className="mt-1 text-sm text-zinc-400">Hesabınıza daxil olun.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                placeholder="E-poçt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type={showPw ? "text" : "password"}
                placeholder="Şifrə"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-10 text-sm placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy ? "Daxil olunur…" : <>Daxil ol <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Hesabınız yoxdur?{" "}
            <Link href="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
              Qeydiyyatdan keç
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
