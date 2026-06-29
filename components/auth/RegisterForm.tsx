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
  Megaphone,
  Phone,
  Search,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import { COUNTRY_CODES, type CountryCode } from "@/lib/countryCodes";
import { HEARD_ABOUT_OPTIONS } from "@/lib/heardAbout";
import { normalizeFullName, MIN_NAME_LENGTH, validateFullName } from "@/lib/nameFormat";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

type Step = "details" | "otp";
type RegisterFormVariant = "card" | "page";

const DEFAULT_COUNTRY =
  COUNTRY_CODES.find((country) => country.iso2 === "AZ") ?? COUNTRY_CODES[0];

export default function RegisterForm({
  onSuccess,
  onSwitchToLogin,
  variant = "card",
}: {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  variant?: RegisterFormVariant;
}) {
  const isPage = variant === "page";
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    referralCode: "",
    heardAboutSource: "",
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

    const firstName = normalizeFullName(form.firstName);
    const lastName = normalizeFullName(form.lastName);
    if (firstName.length < MIN_NAME_LENGTH) {
      setBusy(false);
      setError(`Ad ən azı ${MIN_NAME_LENGTH} simvol olmalıdır.`);
      return;
    }
    if (lastName.length < MIN_NAME_LENGTH) {
      setBusy(false);
      setError(`Soyad ən azı ${MIN_NAME_LENGTH} simvol olmalıdır.`);
      return;
    }
    const cleanName = `${firstName} ${lastName}`;
    const nameError = validateFullName(cleanName);
    if (nameError) {
      setBusy(false);
      setError(`${nameError}.`);
      return;
    }
    if (firstName !== form.firstName || lastName !== form.lastName) {
      setForm((f) => ({ ...f, firstName, lastName }));
    }

    if (!form.heardAboutSource) {
      setBusy(false);
      setError("Bizi haradan eşitdiyinizi seçin.");
      return;
    }

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
        name: cleanName,
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
      `${fullPhoneNumber()} nömrəsinə WhatsApp ilə 6 rəqəmli kod göndərdik. Kodun müddəti ${data.expiresInMinutes ?? 10} dəqiqəyə bitir.`,
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
    <div
      className={
        isPage
          ? "w-full"
          : "relative isolate overflow-hidden rounded-[20px] border border-violet-400/25 bg-white p-4 text-zinc-900 shadow-[0_22px_68px_-42px_rgba(124,58,237,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] dark:bg-[linear-gradient(145deg,rgba(17,18,32,0.98),rgba(7,8,17,0.99))] dark:text-zinc-100 dark:shadow-[0_22px_68px_-42px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5"
      }
    >
      {!isPage && (
        <>
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
        </>
      )}

      {step === "details" ? (
        <>
          {!isPage && (
            <>
              <header className="relative mb-4 flex items-center gap-3.5 pr-12">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border border-violet-300/30 bg-violet-500/15 text-violet-200 shadow-[0_0_26px_-14px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-16 sm:w-16">
                  <Gamepad2 className="h-7 w-7" strokeWidth={1.7} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
                    Hesab yarat
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Cüzdanı doldur, oyun al, referallardan qazan.
                  </p>
                </div>
              </header>

              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                <FeaturePill icon={<Zap className="h-5 w-5" />} label="Sürətli qeydiyyat" />
                <FeaturePill icon={<Gift className="h-5 w-5" />} label="Bonus qazan" />
                <FeaturePill icon={<ShieldCheck className="h-5 w-5" />} label="Təhlükəsiz hesab" />
              </div>
            </>
          )}

          <form onSubmit={submitDetails} className={isPage ? "space-y-3" : "space-y-2.5"}>
            <div className={isPage ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-2.5"}>
              <Field
                variant={variant}
                icon={<User className="h-5 w-5" />}
                type="text"
                placeholder="Ad"
                value={form.firstName}
                onChange={(v) => setForm({ ...form, firstName: v })}
                onBlur={() => setForm((f) => ({ ...f, firstName: normalizeFullName(f.firstName) }))}
                autoComplete="given-name"
                required
                minLength={MIN_NAME_LENGTH}
              />
              <Field
                variant={variant}
                icon={<User className="h-5 w-5" />}
                type="text"
                placeholder="Soyad"
                value={form.lastName}
                onChange={(v) => setForm({ ...form, lastName: v })}
                onBlur={() => setForm((f) => ({ ...f, lastName: normalizeFullName(f.lastName) }))}
                autoComplete="family-name"
                required
                minLength={MIN_NAME_LENGTH}
              />
            </div>
            <PhoneField
              variant={variant}
              country={country}
              onCountryChange={setCountry}
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />
            <Field
              variant={variant}
              icon={<Mail className="h-5 w-5" />}
              type="email"
              placeholder="E-poçt"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              autoComplete="email"
              required
            />
            <Field
              variant={variant}
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
                  onPointerDown={(e) => {
                    // Mobil Safari: label-in içindəki düymə tıkı input-a fokus
                    // ötürür və klik faktiki olaraq icra olunmur. Default-u
                    // qaldırırıq ki, fokus köçməsin və toggle hər zaman işləsin.
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((s) => !s);
                  }}
                  onClick={(e) => {
                    // pointerdown artıq toggle-u həll etdi; ikinci dəfə dəyiş­məsin.
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
                  className={
                    isPage
                      ? "absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white transition hover:bg-white/[0.06]"
                      : "absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-zinc-400 transition hover:text-zinc-700 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 dark:active:text-zinc-200"
                  }
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
              variant={variant}
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
            <SelectField
              variant={variant}
              icon={<Megaphone className="h-5 w-5" />}
              value={form.heardAboutSource}
              onChange={(v) => setForm({ ...form, heardAboutSource: v })}
              placeholder="Bizi haradan eşitdiniz?"
              options={HEARD_ABOUT_OPTIONS}
            />

            <div className={isPage ? "mt-3 flex justify-center" : "mt-2 flex justify-center"}>
              <TurnstileWidget onToken={setCaptchaToken} action="register" />
            </div>

            <button
              type="submit"
              disabled={busy}
              className={
                isPage
                  ? "mt-4 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#7a00ff] to-[#4b00a8] px-6 text-sm font-semibold text-white shadow-[0_20px_58px_-30px_rgba(122,0,255,0.95)] transition hover:from-[#8c20ff] hover:to-[#5c0bc0] disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-base"
                  : "mt-1.5 h-12 w-full rounded-[13px] bg-gradient-to-r from-violet-600 via-purple-500 to-violet-700 px-4 text-base font-black text-white shadow-[0_0_28px_-12px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:from-violet-500 hover:via-purple-400 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-lg"
              }
            >
              {busy ? "Kod göndərilir..." : "Təsdiq kodu göndər"}
            </button>

            {accountExists && (
              <div className="rounded-[22px] border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
                <p className="font-bold text-amber-200">Bu e-poçtla hesabınız var</p>
                <p className="mt-1 text-amber-100/80">
                  <span className="font-mono">{accountExists.email}</span> üçün qeydiyyat
                  tamamlanmayıb. Şifrəni yeniləyərək hesabınıza daxil olun.
                </p>
                <Link
                  href={`/forgot-password?email=${encodeURIComponent(accountExists.email)}`}
                  className="mt-3 inline-flex rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-zinc-950 transition hover:bg-amber-300"
                >
                  Şifrəni yenilə
                </Link>
              </div>
            )}

            {error && (
              <p className="rounded-[22px] border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
                {error}
              </p>
            )}
          </form>

          {!isPage && (
            <>
              <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
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

              <div className="mt-4 border-t border-zinc-200 pt-3 text-center text-xs text-zinc-500 dark:border-white/10">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-zinc-500" />
                  Məlumatların təhlükəsizliyi bizim prioritetimizdir.
                </span>
              </div>
            </>
          )}
        </>
      ) : (
        <OtpStep
          variant={variant}
          busy={busy}
          code={code}
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
    <div className="flex h-10 items-center justify-center gap-2 rounded-[11px] border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.045] px-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-12 sm:text-sm">
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
  variant = "card",
  ...rest
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  required?: boolean;
  minLength?: number;
  uppercase?: boolean;
  trailing?: React.ReactNode;
  autoComplete?: string;
  readOnly?: boolean;
  hint?: string;
  variant?: RegisterFormVariant;
}) {
  const isPage = variant === "page";

  return (
    <label className="relative block">
      <span
        className={
          isPage
            ? "hidden"
            : "pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-violet-300"
        }
      >
        {icon}
      </span>
      <input
        type={rest.type}
        placeholder={rest.placeholder}
        value={rest.value}
        onChange={(e) => rest.onChange(e.target.value)}
        onBlur={() => rest.onBlur?.()}
        required={rest.required}
        minLength={rest.minLength}
        autoComplete={rest.autoComplete}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        tabIndex={readOnly ? -1 : undefined}
        className={
          isPage
            ? `auth-page-input h-11 w-full rounded-full px-5 text-sm font-medium outline-none transition sm:h-12 sm:text-base ${
                trailing ? "pr-14" : ""
              } ${readOnly ? "cursor-not-allowed opacity-70" : ""}`
            : `h-12 w-full rounded-[13px] border border-violet-300/30 bg-zinc-100 pl-14 text-sm font-medium text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition placeholder:text-zinc-500 focus:border-violet-400/70 focus:bg-white dark:border-violet-300/20 dark:bg-black/20 dark:text-white dark:focus:border-violet-300/55 dark:focus:bg-black/30 sm:h-14 sm:pl-16 sm:text-base ${
                trailing ? "pr-14" : "pr-5"
              } ${uppercase ? "uppercase tracking-widest" : ""} ${
                readOnly
                  ? "cursor-not-allowed bg-zinc-200/60 text-zinc-600 focus:border-violet-300/30 dark:bg-zinc-900/60 dark:text-zinc-300 dark:focus:border-violet-300/20"
                  : ""
              }`
        }
      />
      {trailing}
      {hint && (
        <span className="mt-2 block pl-6 text-[11px] text-emerald-300/90">
          {hint}
        </span>
      )}
    </label>
  );
}

function SelectField({
  icon,
  value,
  onChange,
  placeholder,
  options,
  variant = "card",
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  variant?: RegisterFormVariant;
}) {
  const isPage = variant === "page";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
        className={
          isPage
            ? "auth-page-input relative flex h-11 w-full items-center rounded-full px-5 pr-12 text-left text-sm font-medium outline-none transition sm:h-12 sm:text-base"
            : "relative flex h-12 w-full items-center rounded-[13px] border border-violet-300/30 bg-zinc-100 pl-14 pr-12 text-left text-sm font-medium outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-violet-400/70 focus:bg-white dark:border-violet-300/20 dark:bg-black/20 dark:focus:border-violet-300/55 dark:focus:bg-black/30 sm:h-14 sm:pl-16 sm:text-base"
        }
      >
        <span
          className={
            isPage
              ? "hidden"
              : "pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-violet-300"
          }
        >
          {icon}
        </span>
        <span
          className={`truncate ${
            selected
              ? isPage
                ? "text-white"
                : "text-zinc-900 dark:text-white"
              : isPage
                ? "text-white/64"
                : "text-zinc-500"
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`pointer-events-none absolute ${isPage ? "right-4 h-4 w-4" : "right-6 h-5 w-5"} top-1/2 -translate-y-1/2 transition ${
            open
              ? "rotate-180 text-violet-300"
              : isPage
                ? "text-white/80"
                : "text-zinc-500"
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={
            isPage
              ? "absolute left-0 top-[calc(100%+0.55rem)] z-30 w-full overflow-hidden rounded-[22px] border border-white/15 bg-[#151516]/95 p-2 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9),0_0_50px_-30px_rgba(122,0,255,0.72)] backdrop-blur-xl"
              : "absolute left-0 top-[calc(100%+0.45rem)] z-30 w-full overflow-hidden rounded-[15px] border border-violet-300/30 bg-white/95 p-1.5 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.2),0_0_50px_-30px_rgba(168,85,247,0.45)] backdrop-blur-xl dark:border-violet-300/20 dark:bg-[#0b0c18]/95 dark:shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9),0_0_50px_-30px_rgba(168,85,247,0.95)]"
          }
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-[14px] px-3 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? isPage
                      ? "bg-violet-500/25 text-white"
                      : "bg-violet-500/15 text-violet-900 dark:bg-violet-500/20 dark:text-white"
                    : isPage
                      ? "text-white/72 hover:bg-white/[0.06] hover:text-white"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-violet-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhoneField({
  variant = "card",
  country,
  onCountryChange,
  value,
  onChange,
}: {
  variant?: RegisterFormVariant;
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  value: string;
  onChange: (v: string) => void;
}) {
  const isPage = variant === "page";

  return (
    <label className="relative block">
      <span
        className={
          isPage
            ? "hidden"
            : "pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 text-violet-300"
        }
      >
        <Phone className="h-5 w-5" />
      </span>
      <div
        className={
          isPage
            ? "auth-page-input relative flex h-11 items-center rounded-full px-2.5 pr-4 transition sm:h-12"
            : "relative flex h-12 items-center rounded-[13px] border border-violet-300/30 bg-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-violet-400/70 focus-within:bg-white dark:border-violet-300/20 dark:bg-black/20 dark:focus-within:border-violet-300/55 dark:focus-within:bg-black/30 sm:h-14"
        }
      >
        <CountryCodePicker variant={variant} value={country} onChange={onCountryChange} />
        <span className={isPage ? "mx-2 h-7 w-px shrink-0 bg-white/16" : "mx-2 h-6 w-px shrink-0 bg-zinc-300 dark:bg-white/10"} />
        <input
          type="tel"
          inputMode="tel"
          placeholder={isPage ? "WhatsApp nömrəniz" : "Bura WhatsApp nömrənizi yazın"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete="tel"
          className={
            isPage
              ? "auth-page-inner-input min-w-0 flex-1 bg-transparent py-2 pl-0 pr-1 text-sm font-medium text-white outline-none placeholder:text-white/64 sm:text-base"
              : "min-w-0 flex-1 bg-transparent py-2 pl-0 pr-4 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-white sm:text-base"
          }
        />
      </div>
    </label>
  );
}

function CountryCodePicker({
  variant = "card",
  value,
  onChange,
}: {
  variant?: RegisterFormVariant;
  value: CountryCode;
  onChange: (country: CountryCode) => void;
}) {
  const isPage = variant === "page";
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
    <div
      ref={rootRef}
      className={
        isPage
          ? "relative z-20 ml-1.5 shrink-0 sm:ml-2"
          : "relative z-20 ml-[50px] shrink-0 sm:ml-[56px]"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          isPage
            ? "group inline-flex h-8 min-w-[70px] items-center justify-center gap-1 rounded-full px-2 text-xs font-bold text-white transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-300/35 sm:h-9 sm:text-sm"
            : "group inline-flex h-9 min-w-[74px] items-center justify-center gap-1 rounded-[9px] px-1.5 text-sm font-bold text-zinc-900 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-300/35 dark:text-white dark:hover:bg-white/[0.06]"
        }
        aria-expanded={open}
        aria-label="Ölkə kodu seç"
      >
        <span className="tabular-nums">{value.code}</span>
        <ChevronDown
          className={`h-4 w-4 transition group-hover:text-violet-200 ${
            isPage ? "text-white/75" : "text-zinc-500"
          }`}
        />
      </button>

      {open && (
        <div
          className={
            isPage
              ? "absolute -left-3 top-[calc(100%+0.65rem)] z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[22px] border border-white/15 bg-[#151516]/95 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9),0_0_50px_-30px_rgba(122,0,255,0.72)] backdrop-blur-xl"
              : "absolute left-0 top-[calc(100%+0.55rem)] z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[15px] border border-violet-300/30 bg-white/95 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.2),0_0_50px_-30px_rgba(168,85,247,0.45)] backdrop-blur-xl dark:border-violet-300/20 dark:bg-[#0b0c18]/95 dark:shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9),0_0_50px_-30px_rgba(168,85,247,0.95)]"
          }
        >
          <div className={isPage ? "relative border-b border-white/10 p-2.5" : "relative border-b border-zinc-200 p-2.5 dark:border-white/10"}>
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ölkə və ya kod axtar..."
              className={
                isPage
                  ? "auth-page-dropdown-input h-10 w-full rounded-full pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/45"
                  : "h-9 w-full rounded-[10px] border border-zinc-200 bg-zinc-50 pl-8 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-violet-400/70 dark:border-white/10 dark:bg-black/25 dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-violet-300/45"
              }
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
                    ? isPage
                      ? "bg-violet-500/25 text-white"
                      : "bg-violet-500/15 text-violet-900 dark:bg-violet-500/20 dark:text-white"
                    : isPage
                      ? "text-white/72 hover:bg-white/[0.06] hover:text-white"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`}
              >
                <span
                  className={
                    isPage
                      ? "rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-1 text-center text-[11px] font-bold text-violet-200"
                      : "rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-center text-[11px] font-bold text-violet-700 dark:border-white/10 dark:bg-white/[0.045] dark:text-violet-200"
                  }
                >
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
              <p className={`px-3 py-5 text-center text-sm ${isPage ? "text-white/45" : "text-zinc-500"}`}>
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
  variant = "card",
  busy,
  code,
  error,
  info,
  resend,
  resendIn,
  setCode,
  submitOtp,
  onBack,
}: {
  variant?: RegisterFormVariant;
  busy: boolean;
  code: string;
  error: string | null;
  info: string | null;
  resend: () => void;
  resendIn: number;
  setCode: (value: string) => void;
  submitOtp: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  const isPage = variant === "page";

  return (
    <div className={isPage ? "mx-auto w-full max-w-[39rem]" : "mx-auto max-w-xl py-3"}>
      <div className={isPage ? "mb-5 text-center" : "mb-6 flex items-center gap-4"}>
        {!isPage && (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 shadow-[0_0_30px_-14px_rgba(52,211,153,0.9)]">
            <ShieldCheck className="h-8 w-8" />
          </span>
        )}
        <div>
          <h2
            className={
              isPage
                ? "text-2xl font-semibold tracking-normal text-white sm:text-3xl"
                : "text-3xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-4xl"
            }
          >
            Nömrəni təsdiq et
          </h2>
          <p
            className={
              isPage
                ? "mt-2 text-sm leading-relaxed text-white/48 sm:text-base"
                : "mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-base"
            }
          >
            WhatsApp ilə göndərilən 6 rəqəmli kodu daxil et.
          </p>
        </div>
      </div>

      <form onSubmit={submitOtp} className={isPage ? "space-y-3" : "space-y-4"}>
        <input
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          className={
            isPage
              ? "auth-page-input h-12 w-full rounded-full px-5 text-center text-xl font-semibold tracking-[0.48em] text-emerald-300 outline-none transition placeholder:text-white/35 sm:h-14 sm:text-2xl"
              : "h-16 w-full rounded-[14px] border border-violet-300/30 bg-zinc-100 text-center text-2xl font-black tracking-[0.55em] text-emerald-600 outline-none placeholder:text-zinc-400 focus:border-violet-400/70 dark:border-violet-300/20 dark:bg-black/20 dark:text-emerald-300 dark:placeholder:text-zinc-700 dark:focus:border-violet-300/55"
          }
        />

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className={
            isPage
              ? "h-12 w-full rounded-full bg-gradient-to-r from-[#7a00ff] to-[#4b00a8] px-6 text-sm font-semibold text-white shadow-[0_20px_58px_-30px_rgba(122,0,255,0.95)] transition hover:from-[#8c20ff] hover:to-[#5c0bc0] disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-base"
              : "h-14 w-full rounded-[14px] bg-gradient-to-r from-violet-600 via-purple-500 to-violet-700 text-lg font-black text-white shadow-[0_0_30px_-12px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:from-violet-500 hover:via-purple-400 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-55"
          }
        >
          {busy ? "Təsdiqlənir..." : "Təsdiq et və davam et"}
        </button>

        {info && (
          <p className="rounded-[22px] border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
            {info}
          </p>
        )}
        {error && (
          <p className="rounded-[22px] border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {error}
          </p>
        )}
      </form>

      <div className="mt-4 flex items-center justify-between gap-4 text-sm">
        <button
          type="button"
          onClick={onBack}
          className={
            isPage
              ? "font-medium text-white/50 transition hover:text-white"
              : "font-medium text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }
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
