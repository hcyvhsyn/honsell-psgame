"use client";

import { useEffect, useState } from "react";
import {
  Gamepad2,
  User,
  Mail,
  KeyRound,
  Hash,
  ShieldCheck,
  Phone,
  Eye,
  EyeOff,
} from "lucide-react";

type Step = "details" | "otp";

export default function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}: {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}) {
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    referralCode: "",
  });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Qeydiyyat alınmadı.");
      return;
    }
    setStep("otp");
    setInfo(
      `${form.email} ünvanına 6 rəqəmli kod göndərdik. Kodun müddəti ${data.expiresInMinutes ?? 10} dəqiqəyə bitir.`
    );
    setResendIn(30);
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, code }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = "/profile";
      }
      return;
    }
    setBusy(false);
    setError(data.error ?? "Təsdiq alınmadı.");
  }

  async function resend() {
    if (resendIn > 0 || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setInfo("Yeni kod göndərildi.");
      setResendIn(30);
    } else {
      setError(data.error ?? "Kodu yenidən göndərmək alınmadı.");
    }
  }

  return (
    <div className="p-7">
      {step === "details" ? (
        <>
          <div className="mb-6 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/40">
              <Gamepad2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold leading-tight">Hesab yarat</h2>
              <p className="text-xs text-zinc-400">
                Cüzdanı doldur, oyun al, referallardan qazan.
              </p>
            </div>
          </div>

          <form onSubmit={submitDetails} className="space-y-3">
            <Field
              icon={<User className="h-4 w-4" />}
              type="text"
              placeholder="Ad Soyad"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              autoComplete="name"
              required
            />
            <Field
              icon={<Phone className="h-4 w-4" />}
              type="tel"
              placeholder="Telefon nömrəsi"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              autoComplete="tel"
              required
            />
            <Field
              icon={<Mail className="h-4 w-4" />}
              type="email"
              placeholder="E-poçt"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              autoComplete="email"
              required
            />
            <Field
              icon={<KeyRound className="h-4 w-4" />}
              type={showPassword ? "text" : "password"}
              placeholder="Şifrə (ən azı 8 simvol)"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              autoComplete="new-password"
              required
              minLength={8}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Field
              icon={<Hash className="h-4 w-4" />}
              type="text"
              placeholder="Referal kodu (məcburi deyil)"
              value={form.referralCode}
              onChange={(v) => setForm({ ...form, referralCode: v.toUpperCase() })}
              uppercase
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy ? "Kod göndərilir…" : "Təsdiq kodu göndər"}
            </button>

            {error && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Hesabın artıq var?{" "}
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
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold leading-tight">E-poçtu təsdiq et</h2>
              <p className="text-xs text-zinc-400">
                <span className="text-zinc-200">{form.email}</span> ünvanına göndərilən 6 rəqəmli
                kodu daxil et.
              </p>
            </div>
          </div>

          <form onSubmit={submitOtp} className="mt-6 space-y-3">
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-3 text-center text-2xl font-semibold tracking-[0.6em] text-emerald-300 placeholder:text-zinc-700 focus:border-indigo-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy ? "Təsdiqlənir…" : "Təsdiq et və davam et"}
            </button>

            {info && (
              <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {info}
              </p>
            )}
            {error && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
            )}
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("details");
                setError(null);
                setInfo(null);
                setCode("");
              }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              ← Məlumatları dəyiş
            </button>
            <button
              type="button"
              onClick={resend}
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

function Field({
  icon,
  trailing,
  uppercase,
  ...rest
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  uppercase?: boolean;
  trailing?: React.ReactNode;
  autoComplete?: string;
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
        minLength={rest.minLength}
        autoComplete={rest.autoComplete}
        className={`w-full rounded-md border border-zinc-800 bg-zinc-950 py-2.5 pl-10 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none ${
          trailing ? "pr-10" : "pr-3"
        } ${uppercase ? "uppercase tracking-widest" : ""}`}
      />
      {trailing}
    </label>
  );
}
