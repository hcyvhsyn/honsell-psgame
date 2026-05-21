"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Gamepad2,
  Gift,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReset, setNeedsReset] = useState<{ email: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNeedsReset(null);

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
    if (res.status === 403 && data.needsVerification && data.email) {
      setNeedsReset({ email: data.email });
    } else {
      setError(data.error ?? "Daxil olmaq alınmadı.");
    }
    setBusy(false);
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[20px] border border-violet-400/25 bg-white dark:bg-[linear-gradient(145deg,rgba(17,18,32,0.98),rgba(7,8,17,0.99))] p-4 text-zinc-900 dark:text-zinc-100 shadow-[0_22px_68px_-42px_rgba(124,58,237,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] dark:shadow-[0_22px_68px_-42px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_12%,rgba(124,58,237,0.26),transparent_32%),radial-gradient(circle_at_16%_0%,rgba(168,85,247,0.14),transparent_28%)]" />
      <div className="pointer-events-none absolute right-0 top-0 -z-10 hidden h-36 w-[46%] overflow-hidden sm:block">
        <Image
          src="/ps-controller.png"
          alt=""
          fill
          priority
          sizes="420px"
          className="object-cover object-right-top opacity-55 saturate-125 [mask-image:linear-gradient(to_left,black_12%,rgba(0,0,0,0.78)_54%,transparent_96%)]"
        />
      </div>

      <header className="relative mb-4 flex items-center gap-3.5 pr-12">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border border-violet-300/30 bg-violet-500/15 text-violet-200 shadow-[0_0_26px_-14px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-16 sm:w-16">
          <Gamepad2 className="h-7 w-7" strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
            Daxil ol
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Hesabına qayıt və alış-verişə davam et.
          </p>
        </div>
      </header>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <FeaturePill icon={<Zap className="h-5 w-5" />} label="Sürətli giriş" />
        <FeaturePill icon={<Gift className="h-5 w-5" />} label="Bonusların hazırdır" />
        <FeaturePill icon={<ShieldCheck className="h-5 w-5" />} label="Təhlükəsiz hesab" />
      </div>

      <form onSubmit={submit} className="space-y-2.5">
        <Field
          icon={<Mail className="h-5 w-5" />}
          type="email"
          placeholder="E-poçt"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          icon={<KeyRound className="h-5 w-5" />}
          type={showPassword ? "text" : "password"}
          placeholder="Şifrə"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-200"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          }
        />

        <div className="-mt-0.5 flex justify-end">
          {onForgotPassword ? (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-bold text-violet-300 transition hover:text-violet-200"
            >
              Şifrəni unutmusan?
            </button>
          ) : (
            <Link
              href="/forgot-password"
              className="text-xs font-bold text-violet-300 transition hover:text-violet-200"
            >
              Şifrəni unutmusan?
            </Link>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-1.5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-gradient-to-r from-violet-600 via-purple-500 to-violet-700 px-4 text-base font-black text-white shadow-[0_0_28px_-12px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:from-violet-500 hover:via-purple-400 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-lg"
        >
          {busy ? (
            "Daxil olunur..."
          ) : (
            <>
              Daxil ol <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        {needsReset && (
          <div className="rounded-[14px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-bold text-amber-200">Hesabınız təsdiqlənməyib</p>
            <p className="mt-1 text-amber-100/80">
              <span className="font-mono">{needsReset.email}</span> üçün hesab
              tamamlanmayıb. Şifrəni yeniləyərək hesabınızı aktivləşdirin.
            </p>
            <Link
              href={`/forgot-password?email=${encodeURIComponent(needsReset.email)}`}
              className="mt-3 inline-flex rounded-[10px] bg-amber-400 px-3 py-2 text-xs font-black text-zinc-950 transition hover:bg-amber-300"
            >
              Şifrəni yenilə
            </Link>
          </div>
        )}

        {error && (
          <p className="rounded-[14px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Yeni istifadəçisən?{" "}
        {onSwitchToRegister ? (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-black text-violet-300 transition hover:text-violet-200"
          >
            Hesab yarat
          </button>
        ) : (
          <Link
            href="/register"
            className="font-black text-violet-300 transition hover:text-violet-200"
          >
            Hesab yarat
          </Link>
        )}
      </p>

      <div className="mt-4 border-t border-zinc-200 dark:border-white/10 pt-3 text-center text-xs text-zinc-500">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300/80" />
          Endirimlər, balans və sifarişlərin səni gözləyir.
        </span>
      </div>
    </div>
  );
}

function FeaturePill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex h-10 items-center justify-center gap-2 rounded-[11px] border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.045] px-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-12 sm:text-sm">
      <span className="text-violet-300">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function Field({
  icon,
  trailing,
  type,
  placeholder,
  value,
  onChange,
  required,
  autoComplete,
}: {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-violet-300">
        {icon}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className={`h-12 w-full rounded-[13px] border border-violet-300/30 dark:border-violet-300/20 bg-zinc-100 dark:bg-black/20 pl-14 text-sm font-medium text-zinc-900 dark:text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition placeholder:text-zinc-500 focus:border-violet-400/70 dark:focus:border-violet-300/55 focus:bg-white dark:focus:bg-black/30 sm:h-14 sm:pl-16 sm:text-base ${
          trailing ? "pr-14" : "pr-5"
        }`}
      />
      {trailing}
    </label>
  );
}
