"use client";

import { useEffect, useState } from "react";
import { Mail, KeyRound, ShieldCheck, Eye, EyeOff } from "lucide-react";

type Step = "email" | "reset";

export default function ForgotPasswordForm({
  onSuccess,
  onSwitchToLogin,
  initialEmail = "",
}: {
  /** Called when the password reset succeeds. */
  onSuccess?: (email: string) => void;
  /** Renders the “back to login” link as a button instead of a page link. */
  onSwitchToLogin?: () => void;
  initialEmail?: string;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Sorğu alınmadı.");
      return;
    }
    setStep("reset");
    setInfo(
      `${email} ünvanına 6 rəqəmli kod göndərildi. Kodun müddəti ${
        data.expiresInMinutes ?? 10
      } dəqiqəyə bitir.`
    );
    setResendIn(30);
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Şifrə yenilənmədi.");
      return;
    }

    if (onSuccess) onSuccess(email);
    else window.location.href = "/login";
  }

  return (
    <div className="p-7">
      {step === "email" ? (
        <>
          <div className="mb-6 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold leading-tight">
                Şifrəni unutmusan?
              </h2>
              <p className="text-xs text-zinc-400">
                E-poçtunu daxil et — sənə 6 rəqəmli kod göndərək.
              </p>
            </div>
          </div>

          <form onSubmit={requestCode} className="space-y-3">
            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                placeholder="E-poçt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-3 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy ? "Göndərilir…" : "Kod göndər"}
            </button>

            {error && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Yadına düşdü?{" "}
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-medium text-indigo-400 hover:text-indigo-300"
              >
                Daxil ol
              </button>
            ) : (
              <a href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
                Daxil ol
              </a>
            )}
          </p>
        </>
      ) : (
        <>
          <div className="mb-6 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold leading-tight">
                Yeni şifrə təyin et
              </h2>
              <p className="text-xs text-zinc-400">
                <span className="text-zinc-200">{email}</span> ünvanına gələn
                kodu və yeni şifrəni daxil et.
              </p>
            </div>
          </div>

          <form onSubmit={submitReset} className="space-y-3">
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              required
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="••••••"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-3 text-center text-2xl font-semibold tracking-[0.6em] text-emerald-300 placeholder:text-zinc-700 focus:border-indigo-500 focus:outline-none"
            />

            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <KeyRound className="h-4 w-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Yeni şifrə (ən azı 8 simvol)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-10 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </label>

            <button
              type="submit"
              disabled={busy || code.length !== 6 || password.length < 8}
              className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy ? "Yenilənir…" : "Şifrəni yenilə"}
            </button>

            {info && (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {info}
              </p>
            )}
            {error && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
                setInfo(null);
                setCode("");
                setPassword("");
              }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              ← E-poçtu dəyiş
            </button>
            <button
              type="button"
              onClick={() => requestCode()}
              disabled={resendIn > 0 || busy}
              className="text-indigo-400 hover:text-indigo-300 disabled:text-zinc-600"
            >
              {resendIn > 0 ? `${resendIn}s sonra göndər` : "Kodu yenidən göndər"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
