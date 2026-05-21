"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

type Step = "email" | "reset";

export default function ForgotPasswordForm({
  onSuccess,
  onSwitchToLogin,
  initialEmail = "",
}: {
  /** Called when the password reset succeeds. */
  onSuccess?: (email: string) => void;
  /** Renders the back to login link as a button instead of a page link. */
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
  const [captchaToken, setCaptchaToken] = useState("");

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

    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    if (turnstileEnabled && !captchaToken) {
      setBusy(false);
      setError("Zəhmət olmasa captcha-nı tamamla.");
      return;
    }

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, captchaToken }),
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
      } dəqiqəyə bitir.`,
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

    if (onSuccess) {
      onSuccess(email);
    } else {
      window.location.href = "/login";
    }
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

      {step === "email" ? (
        <EmailStep
          busy={busy}
          email={email}
          error={error}
          onEmailChange={setEmail}
          onSubmit={requestCode}
          onCaptchaToken={setCaptchaToken}
          onSwitchToLogin={onSwitchToLogin}
        />
      ) : (
        <ResetStep
          busy={busy}
          code={code}
          email={email}
          error={error}
          info={info}
          password={password}
          resendIn={resendIn}
          showPassword={showPassword}
          onBack={() => {
            setStep("email");
            setError(null);
            setInfo(null);
            setCode("");
            setPassword("");
          }}
          onCodeChange={setCode}
          onPasswordChange={setPassword}
          onResend={() => requestCode()}
          onShowPasswordChange={setShowPassword}
          onSubmit={submitReset}
        />
      )}
    </div>
  );
}

function EmailStep({
  busy,
  email,
  error,
  onEmailChange,
  onSubmit,
  onCaptchaToken,
  onSwitchToLogin,
}: {
  busy: boolean;
  email: string;
  error: string | null;
  onEmailChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onCaptchaToken: (token: string) => void;
  onSwitchToLogin?: () => void;
}) {
  return (
    <>
      <AuthHeader
        icon={<KeyRound className="h-7 w-7" strokeWidth={1.7} />}
        title="Şifrəni unutmusan?"
        description="E-poçtunu daxil et, hesabını bərpa etmək üçün kod göndərək."
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <FeaturePill icon={<Mail className="h-5 w-5" />} label="Kod e-poçta gəlir" />
        <FeaturePill icon={<Zap className="h-5 w-5" />} label="Sürətli bərpa" />
        <FeaturePill icon={<ShieldCheck className="h-5 w-5" />} label="Təhlükəsiz proses" />
      </div>

      <form onSubmit={onSubmit} className="space-y-2.5">
        <Field
          icon={<Mail className="h-5 w-5" />}
          type="email"
          placeholder="E-poçt"
          value={email}
          onChange={onEmailChange}
          autoComplete="email"
          required
        />

        <div className="flex justify-center pt-1">
          <TurnstileWidget onToken={onCaptchaToken} action="forgot-password" />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-1.5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-gradient-to-r from-violet-600 via-purple-500 to-violet-700 px-4 text-base font-black text-white shadow-[0_0_28px_-12px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:from-violet-500 hover:via-purple-400 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-lg"
        >
          {busy ? (
            "Göndərilir..."
          ) : (
            <>
              Kod göndər <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        {error && (
          <p className="rounded-[14px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
      </form>

      <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Yadına düşdü?{" "}
        {onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-black text-violet-300 transition hover:text-violet-200"
          >
            Daxil ol
          </button>
        ) : (
          <Link
            href="/login"
            className="font-black text-violet-300 transition hover:text-violet-200"
          >
            Daxil ol
          </Link>
        )}
      </p>

      <FooterNote text="Kod qısa müddət üçün aktivdir və yalnız sənin hesabına bağlıdır." />
    </>
  );
}

function ResetStep({
  busy,
  code,
  email,
  error,
  info,
  password,
  resendIn,
  showPassword,
  onBack,
  onCodeChange,
  onPasswordChange,
  onResend,
  onShowPasswordChange,
  onSubmit,
}: {
  busy: boolean;
  code: string;
  email: string;
  error: string | null;
  info: string | null;
  password: string;
  resendIn: number;
  showPassword: boolean;
  onBack: () => void;
  onCodeChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onResend: () => void;
  onShowPasswordChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <AuthHeader
        icon={<ShieldCheck className="h-7 w-7" strokeWidth={1.7} />}
        title="Yeni şifrə təyin et"
        description={
          <>
            <span className="text-zinc-700 dark:text-zinc-200">{email}</span> ünvanına gələn kodu
            və yeni şifrəni daxil et.
          </>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <FeaturePill icon={<ShieldCheck className="h-5 w-5" />} label="6 rəqəmli kod" />
        <FeaturePill icon={<KeyRound className="h-5 w-5" />} label="Yeni şifrə" />
        <FeaturePill icon={<RefreshCw className="h-5 w-5" />} label="Yenidən göndər" />
      </div>

      <form onSubmit={onSubmit} className="space-y-2.5">
        <input
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          required
          value={code}
          onChange={(e) =>
            onCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="••••••"
          className="h-14 w-full rounded-[13px] border border-violet-300/30 dark:border-violet-300/20 bg-zinc-100 dark:bg-black/20 text-center text-2xl font-black tracking-[0.55em] text-emerald-600 dark:text-emerald-300 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-zinc-400 dark:placeholder:text-zinc-700 focus:border-violet-400/70 dark:focus:border-violet-300/55 focus:bg-white dark:focus:bg-black/30"
        />

        <Field
          icon={<KeyRound className="h-5 w-5" />}
          type={showPassword ? "text" : "password"}
          placeholder="Yeni şifrə (ən azı 8 simvol)"
          value={password}
          onChange={onPasswordChange}
          autoComplete="new-password"
          required
          minLength={8}
          trailing={
            <button
              type="button"
              onClick={() => onShowPasswordChange(!showPassword)}
              aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
              tabIndex={-1}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          }
        />

        <button
          type="submit"
          disabled={busy || code.length !== 6 || password.length < 8}
          className="mt-1.5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-gradient-to-r from-violet-600 via-purple-500 to-violet-700 px-4 text-base font-black text-white shadow-[0_0_28px_-12px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:from-violet-500 hover:via-purple-400 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-lg"
        >
          {busy ? "Yenilənir..." : "Şifrəni yenilə"}
        </button>

        {info && (
          <p className="rounded-[14px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {info}
          </p>
        )}
        {error && (
          <p className="rounded-[14px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
      </form>

      <div className="mt-4 flex items-center justify-between gap-4 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-medium text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          E-poçtu dəyiş
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0 || busy}
          className="font-bold text-violet-300 transition hover:text-violet-200 disabled:text-zinc-600"
        >
          {resendIn > 0 ? `${resendIn}s sonra göndər` : "Kodu yenidən göndər"}
        </button>
      </div>

      <FooterNote text="Yeni şifrə ən azı 8 simvoldan ibarət olmalıdır." />
    </>
  );
}

function AuthHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <header className="relative mb-4 flex items-center gap-3.5 pr-12">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border border-violet-300/30 bg-violet-500/15 text-violet-200 shadow-[0_0_26px_-14px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-16 sm:w-16">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </header>
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
  minLength,
  autoComplete,
}: {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
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
        minLength={minLength}
        autoComplete={autoComplete}
        className={`h-12 w-full rounded-[13px] border border-violet-300/30 dark:border-violet-300/20 bg-zinc-100 dark:bg-black/20 pl-14 text-sm font-medium text-zinc-900 dark:text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition placeholder:text-zinc-500 focus:border-violet-400/70 dark:focus:border-violet-300/55 focus:bg-white dark:focus:bg-black/30 sm:h-14 sm:pl-16 sm:text-base ${
          trailing ? "pr-14" : "pr-5"
        }`}
      />
      {trailing}
    </label>
  );
}

function FooterNote({ text }: { text: string }) {
  return (
    <div className="mt-4 border-t border-zinc-200 dark:border-white/10 pt-3 text-center text-xs text-zinc-500">
      <span className="inline-flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-300/80" />
        {text}
      </span>
    </div>
  );
}
