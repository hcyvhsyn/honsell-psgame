"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  Gamepad2,
  Gift,
  Hash,
  KeyRound,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import { COUNTRY_CODES, type CountryCode } from "@/lib/countryCodes";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

type Step = "details" | "otp";

const DEFAULT_COUNTRY =
  COUNTRY_CODES.find((country) => country.iso2 === "AZ") ?? COUNTRY_CODES[0];

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
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [code, setCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [accountExists, setAccountExists] = useState<{ email: string } | null>(
    null,
  );
  const [referralLocked, setReferralLocked] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && ref.trim()) {
        setForm((f) => ({ ...f, referralCode: ref.trim().toUpperCase() }));
        setReferralLocked(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function fullPhoneNumber() {
    const raw = form.phone.trim();
    if (raw.startsWith("+")) {
      return `+${raw.replace(/\D/g, "")}`;
    }
    const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
    return `${country.code}${digits}`;
  }

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    setAccountExists(null);

    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    if (turnstileEnabled && !captchaToken) {
      setBusy(false);
      setError("Zəhmət olmasa captcha-nı tamamla.");
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        phone: fullPhoneNumber(),
        captchaToken,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      if (res.status === 409 && data.needsPasswordReset && data.email) {
        setAccountExists({ email: data.email });
        return;
      }
      setError(data.error ?? "Qeydiyyat alınmadı.");
      return;
    }
    setStep("otp");
    setInfo(
      `${form.email} ünvanına 6 rəqəmli kod göndərdik. Kodun müddəti ${data.expiresInMinutes ?? 10} dəqiqəyə bitir.`,
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
    <div className="relative isolate overflow-hidden rounded-[20px] border border-violet-400/25 bg-[linear-gradient(145deg,rgba(17,18,32,0.98),rgba(7,8,17,0.99))] p-4 text-zinc-100 shadow-[0_22px_68px_-42px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_12%,rgba(124,58,237,0.26),transparent_32%),radial-gradient(circle_at_16%_0%,rgba(168,85,247,0.14),transparent_28%)]" />
      <div className="pointer-events-none absolute right-0 top-0 -z-10 hidden h-36 w-[46%] overflow-hidden sm:block">
        <Image
          src="/ps-controller.png"
          alt=""
          fill
          priority
          sizes="520px"
          className="object-cover object-right-top opacity-55 saturate-125 [mask-image:linear-gradient(to_left,black_12%,rgba(0,0,0,0.78)_54%,transparent_96%)]"
        />
      </div>

      {step === "details" ? (
        <>
          <header className="relative mb-4 flex items-center gap-3.5 pr-12">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border border-violet-300/30 bg-violet-500/15 text-violet-200 shadow-[0_0_26px_-14px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-16 sm:w-16">
              <Gamepad2 className="h-7 w-7" strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Hesab yarat
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Cüzdanı doldur, oyun al, referallardan qazan.
              </p>
            </div>
          </header>

          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <FeaturePill icon={<Zap className="h-5 w-5" />} label="Sürətli qeydiyyat" />
            <FeaturePill icon={<Gift className="h-5 w-5" />} label="Bonus qazan" />
            <FeaturePill icon={<ShieldCheck className="h-5 w-5" />} label="Təhlükəsiz hesab" />
          </div>

          <form onSubmit={submitDetails} className="space-y-2.5">
            <Field
              icon={<User className="h-5 w-5" />}
              type="text"
              placeholder="Ad Soyad"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              autoComplete="name"
              required
            />
            <PhoneField
              country={country}
              onCountryChange={setCountry}
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />
            <Field
              icon={<Mail className="h-5 w-5" />}
              type="email"
              placeholder="E-poçt"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              autoComplete="email"
              required
            />
            <Field
              icon={<KeyRound className="h-5 w-5" />}
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
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-200"
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
            <Field
              icon={<Hash className="h-5 w-5" />}
              type="text"
              placeholder="Referal kodu (məcburi deyil)"
              value={form.referralCode}
              onChange={(v) => setForm({ ...form, referralCode: v.toUpperCase() })}
              uppercase
              readOnly={referralLocked}
              hint={
                referralLocked
                  ? "Dəvət linki ilə gəldiniz — referal kodu sabitləndi."
                  : undefined
              }
            />

            <div className="mt-2 flex justify-center">
              <TurnstileWidget onToken={setCaptchaToken} action="register" />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-1.5 h-12 w-full rounded-[13px] bg-gradient-to-r from-violet-600 via-purple-500 to-violet-700 px-4 text-base font-black text-white shadow-[0_0_28px_-12px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:from-violet-500 hover:via-purple-400 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-lg"
            >
              {busy ? "Kod göndərilir..." : "Təsdiq kodu göndər"}
            </button>

            {accountExists && (
              <div className="rounded-[14px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <p className="font-bold text-amber-200">Bu e-poçtla hesabınız var</p>
                <p className="mt-1 text-amber-100/80">
                  <span className="font-mono">{accountExists.email}</span> üçün qeydiyyat
                  tamamlanmayıb. Şifrəni yeniləyərək hesabınıza daxil olun.
                </p>
                <Link
                  href={`/forgot-password?email=${encodeURIComponent(accountExists.email)}`}
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

          <p className="mt-4 text-center text-sm text-zinc-400">
            Hesabın artıq var?{" "}
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

          <div className="mt-4 border-t border-white/10 pt-3 text-center text-xs text-zinc-500">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-zinc-500" />
              Məlumatların təhlükəsizliyi bizim prioritetimizdir.
            </span>
          </div>
        </>
      ) : (
        <OtpStep
          busy={busy}
          code={code}
          email={form.email}
          error={error}
          info={info}
          resend={resend}
          resendIn={resendIn}
          setCode={setCode}
          submitOtp={submitOtp}
          onBack={() => {
            setStep("details");
            setError(null);
            setInfo(null);
            setCode("");
          }}
        />
      )}
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
    <div className="flex h-10 items-center justify-center gap-2 rounded-[11px] border border-white/10 bg-white/[0.045] px-2.5 text-xs font-semibold text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-12 sm:text-sm">
      <span className="text-violet-300">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function Field({
  icon,
  trailing,
  uppercase,
  readOnly,
  hint,
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
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-violet-300">
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
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        tabIndex={readOnly ? -1 : undefined}
        className={`h-12 w-full rounded-[13px] border border-violet-300/20 bg-black/20 pl-14 text-sm font-medium text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition placeholder:text-zinc-500 focus:border-violet-300/55 focus:bg-black/30 sm:h-14 sm:pl-16 sm:text-base ${
          trailing ? "pr-14" : "pr-5"
        } ${uppercase ? "uppercase tracking-widest" : ""} ${
          readOnly
            ? "cursor-not-allowed bg-zinc-900/60 text-zinc-300 focus:border-violet-300/20"
            : ""
        }`}
      />
      {trailing}
      {hint && (
        <span className="mt-1.5 block pl-1 text-[11px] text-emerald-300/90">
          {hint}
        </span>
      )}
    </label>
  );
}

function PhoneField({
  country,
  onCountryChange,
  value,
  onChange,
}: {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-violet-300">
        <Phone className="h-5 w-5" />
      </span>
      <div className="relative flex h-12 items-center rounded-[13px] border border-violet-300/20 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-violet-300/55 focus-within:bg-black/30 sm:h-14">
        <CountryCodePicker value={country} onChange={onCountryChange} />
        <span className="mx-2 h-6 w-px shrink-0 bg-white/10" />
        <input
          type="tel"
          inputMode="tel"
          placeholder="Bura WhatsApp nömrənizi yazın"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete="tel"
          className="min-w-0 flex-1 bg-transparent py-2 pl-0 pr-4 text-sm font-medium text-white outline-none placeholder:text-zinc-500 sm:text-base"
        />
      </div>
    </label>
  );
}

function CountryCodePicker({
  value,
  onChange,
}: {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter((country) => {
      return (
        country.name.toLowerCase().includes(q) ||
        country.code.includes(q) ||
        country.iso2.toLowerCase().includes(q) ||
        country.keywords?.toLowerCase().includes(q)
      );
    });
  }, [query]);

  return (
    <div ref={rootRef} className="relative z-20 ml-[50px] shrink-0 sm:ml-[56px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex h-9 min-w-[74px] items-center justify-center gap-1 rounded-[9px] px-1.5 text-sm font-bold text-white transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-300/35"
        aria-expanded={open}
        aria-label="Ölkə kodu seç"
      >
        <span className="tabular-nums">{value.code}</span>
        <ChevronDown className="h-4 w-4 text-zinc-500 transition group-hover:text-violet-200" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.55rem)] z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[15px] border border-violet-300/20 bg-[#0b0c18]/95 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9),0_0_50px_-30px_rgba(168,85,247,0.95)] backdrop-blur-xl">
          <div className="relative border-b border-white/10 p-2.5">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ölkə və ya kod axtar..."
              className="h-9 w-full rounded-[10px] border border-white/10 bg-black/25 pl-8 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-300/45"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.map((country) => (
              <button
                type="button"
                key={`${country.iso2}-${country.code}`}
                onClick={() => {
                  onChange(country);
                  setQuery("");
                  setOpen(false);
                }}
                className={`grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm transition ${
                  country.iso2 === value.iso2 && country.code === value.code
                    ? "bg-violet-500/20 text-white"
                    : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className="rounded-md border border-white/10 bg-white/[0.045] px-1.5 py-1 text-center text-[11px] font-bold text-violet-200">
                  {country.iso2}
                </span>
                <span className="truncate">{country.name}</span>
                <span className="inline-flex items-center gap-2 font-mono text-xs text-violet-300">
                  {country.code}
                  {country.iso2 === value.iso2 && country.code === value.code && (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-5 text-center text-sm text-zinc-500">
                Nəticə tapılmadı
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OtpStep({
  busy,
  code,
  email,
  error,
  info,
  resend,
  resendIn,
  setCode,
  submitOtp,
  onBack,
}: {
  busy: boolean;
  code: string;
  email: string;
  error: string | null;
  info: string | null;
  resend: () => void;
  resendIn: number;
  setCode: (value: string) => void;
  submitOtp: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-3">
      <div className="mb-6 flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 shadow-[0_0_30px_-14px_rgba(52,211,153,0.9)]">
          <ShieldCheck className="h-8 w-8" />
        </span>
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            E-poçtu təsdiq et
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400 sm:text-base">
            <span className="text-zinc-200">{email}</span> ünvanına göndərilən 6
            rəqəmli kodu daxil et.
          </p>
        </div>
      </div>

      <form onSubmit={submitOtp} className="space-y-4">
        <input
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          className="h-16 w-full rounded-[14px] border border-violet-300/20 bg-black/20 text-center text-2xl font-black tracking-[0.55em] text-emerald-300 outline-none placeholder:text-zinc-700 focus:border-violet-300/55"
        />

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="h-14 w-full rounded-[14px] bg-gradient-to-r from-violet-600 via-purple-500 to-violet-700 text-lg font-black text-white shadow-[0_0_30px_-12px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:from-violet-500 hover:via-purple-400 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {busy ? "Təsdiqlənir..." : "Təsdiq et və davam et"}
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

      <div className="mt-6 flex items-center justify-between gap-4 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-zinc-400 transition hover:text-zinc-200"
        >
          Məlumatları dəyiş
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={resendIn > 0 || busy}
          className="font-bold text-violet-300 transition hover:text-violet-200 disabled:text-zinc-600"
        >
          {resendIn > 0 ? `${resendIn}s sonra göndər` : "Kodu yenidən göndər"}
        </button>
      </div>
    </div>
  );
}
