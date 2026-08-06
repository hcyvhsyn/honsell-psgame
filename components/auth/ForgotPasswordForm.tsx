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
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

type Step = "email" | "reset";

/** Kodun hansı kanalla gələcəyi — müştəri özü seçir. */
type Channel = "email" | "whatsapp";

/**
 * `card`  — modal içində (AppModals): öz çərçivəsi, başlığı və PS-controller
 *           fonu ilə müstəqil kart kimi görünür.
 * `page`  — /forgot-password səhifəsində: çərçivə YOXDUR, çünki AuthPageShell
 *           artıq fon, logo, tab-lar və başlığı verir. Login/register ilə eyni
 *           `auth-page-input` sahələri və gradient pill düymələri işlədilir.
 *
 * RegisterForm-dakı eyni qəsdli variant nümunəsi ilə üst-üstə düşür.
 */
export type ForgotPasswordFormVariant = "card" | "page";

export default function ForgotPasswordForm({
  onSuccess,
  onSwitchToLogin,
  initialEmail = "",
  variant = "card",
}: {
  /** Called when the password reset succeeds. */
  onSuccess?: (email: string) => void;
  /** Renders the back to login link as a button instead of a page link. */
  onSwitchToLogin?: () => void;
  initialEmail?: string;
  variant?: ForgotPasswordFormVariant;
}) {
  const isPage = variant === "page";
  const [step, setStep] = useState<Step>("email");
  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");

  /**
   * Serverə göndərilən identifikator. Kanal `email` olanda yalnız `email`,
   * `whatsapp` olanda yalnız `phone` göndərilir — server hansı sahəyə baxacağını
   * `channel`-dan bilir (bax lib/authIdentifier.ts → readIdentifier).
   */
  function identifierPayload() {
    return channel === "whatsapp"
      ? { channel: "whatsapp" as const, phone }
      : { channel: "email" as const, email };
  }

  /** İstifadəçiyə göstərilən hədəf — kodu nerede axtaracağını bilsin. */
  const destination = channel === "whatsapp" ? phone : email;

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
      body: JSON.stringify({ ...identifierPayload(), captchaToken }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Sorğu alınmadı.");
      return;
    }

    setStep("reset");
    setInfo(
      `${destination} ünvanına 6 rəqəmli kod göndərildi. Kodun müddəti ${
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
      body: JSON.stringify({ ...identifierPayload(), code, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Şifrə yenilənmədi.");
      return;
    }

    if (onSuccess) {
      onSuccess(email || destination);
    } else {
      window.location.href = "/login";
    }
  }

  return (
    <div
      className={
        isPage
          ? "mx-auto w-full max-w-[39rem]"
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
              sizes="420px"
              className="object-cover object-right-top opacity-55 saturate-125 [mask-image:linear-gradient(to_left,black_12%,rgba(0,0,0,0.78)_54%,transparent_96%)]"
            />
          </div>
        </>
      )}

      {step === "email" ? (
        <EmailStep
          isPage={isPage}
          busy={busy}
          channel={channel}
          email={email}
          phone={phone}
          error={error}
          onChannelChange={(c) => {
            setChannel(c);
            setError(null);
          }}
          onEmailChange={setEmail}
          onPhoneChange={setPhone}
          onSubmit={requestCode}
          onCaptchaToken={setCaptchaToken}
          onSwitchToLogin={onSwitchToLogin}
        />
      ) : (
        <ResetStep
          isPage={isPage}
          busy={busy}
          channel={channel}
          code={code}
          destination={destination}
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
  isPage,
  busy,
  channel,
  email,
  phone,
  error,
  onChannelChange,
  onEmailChange,
  onPhoneChange,
  onSubmit,
  onCaptchaToken,
  onSwitchToLogin,
}: {
  isPage: boolean;
  busy: boolean;
  channel: Channel;
  email: string;
  phone: string;
  error: string | null;
  onChannelChange: (value: Channel) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onCaptchaToken: (token: string) => void;
  onSwitchToLogin?: () => void;
}) {
  return (
    <>
      {/* Səhifə variantında başlıq və alt-başlıq AuthPageShell-dən gəlir —
          burda təkrar başlıq/pill sırası göstərmək login-dən fərqli görünürdü. */}
      {!isPage && (
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
        </>
      )}

      <form onSubmit={onSubmit} className={isPage ? "space-y-3" : "space-y-2.5"}>
        {/* Kanal seçimi — kod HƏMİŞƏ seçilən yolla gəlir, fallback yoxdur.
            Əvvəl forma "e-poçta göndərək" yazırdı, kod isə WhatsApp-a düşürdü. */}
        <div className="grid grid-cols-2 gap-2">
          <ChannelButton
            isPage={isPage}
            active={channel === "email"}
            onClick={() => onChannelChange("email")}
            icon={<Mail className="h-4 w-4" />}
            label="E-poçt"
          />
          <ChannelButton
            isPage={isPage}
            active={channel === "whatsapp"}
            onClick={() => onChannelChange("whatsapp")}
            icon={<MessageCircle className="h-4 w-4" />}
            label="WhatsApp"
          />
        </div>

        {channel === "email" ? (
          <Field
            isPage={isPage}
            icon={<Mail className="h-5 w-5" />}
            type="email"
            placeholder={isPage ? "E-mail" : "E-poçt"}
            value={email}
            onChange={onEmailChange}
            autoComplete="email"
            required
          />
        ) : (
          <Field
            isPage={isPage}
            icon={<Phone className="h-5 w-5" />}
            type="tel"
            placeholder="+994 50 123 45 67"
            value={phone}
            onChange={onPhoneChange}
            autoComplete="tel"
            required
          />
        )}

        <p className={`text-xs ${isPage ? "text-white/48" : "text-zinc-500"}`}>
          {channel === "email"
            ? "6 rəqəmli kod e-poçt ünvanına göndərilir."
            : "6 rəqəmli kod hesaba bağlı WhatsApp nömrəsinə göndərilir. Nömrəni ölkə kodu ilə yaz."}
        </p>

        <div className="flex justify-center pt-1">
          <TurnstileWidget onToken={onCaptchaToken} action="forgot-password" />
        </div>

        <SubmitButton isPage={isPage} disabled={busy}>
          {busy ? (
            "Göndərilir..."
          ) : (
            <>
              Kod göndər <ArrowRight className="h-5 w-5" />
            </>
          )}
        </SubmitButton>

        {error && <Alert isPage={isPage} tone="error">{error}</Alert>}
      </form>

      {/* Səhifədə login/register keçidini AuthPageShell-in tab-ları verir. */}
      {!isPage && (
        <>
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
      )}
    </>
  );
}

function ResetStep({
  isPage,
  busy,
  channel,
  code,
  destination,
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
  isPage: boolean;
  busy: boolean;
  channel: Channel;
  code: string;
  destination: string;
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
      {isPage ? (
        // Shell başlığı statikdir, ona görə 2-ci mərhələni burda qısa sətirlə
        // bildiririk — böyük ikonlu başlıq login/register-də yoxdur.
        <p className="mb-4 text-center text-sm text-white/64">
          <span className="font-semibold text-white">{destination}</span>{" "}
          {channel === "whatsapp" ? "nömrəsinə WhatsApp ilə" : "ünvanına e-poçt ilə"} gələn
          6 rəqəmli kodu və yeni şifrəni daxil et.
        </p>
      ) : (
        <>
          <AuthHeader
            icon={<ShieldCheck className="h-7 w-7" strokeWidth={1.7} />}
            title="Yeni şifrə təyin et"
            description={
              <>
                <span className="text-zinc-700 dark:text-zinc-200">{destination}</span>{" "}
                {channel === "whatsapp" ? "nömrəsinə WhatsApp ilə" : "ünvanına e-poçt ilə"}{" "}
                gələn kodu və yeni şifrəni daxil et.
              </>
            }
          />

          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <FeaturePill icon={<ShieldCheck className="h-5 w-5" />} label="6 rəqəmli kod" />
            <FeaturePill icon={<KeyRound className="h-5 w-5" />} label="Yeni şifrə" />
            <FeaturePill icon={<RefreshCw className="h-5 w-5" />} label="Yenidən göndər" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className={isPage ? "space-y-3" : "space-y-2.5"}>
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
          className={
            isPage
              ? "auth-page-input h-12 w-full rounded-full text-center text-2xl font-black tracking-[0.5em] outline-none transition sm:h-14"
              : "h-14 w-full rounded-[13px] border border-violet-300/30 bg-zinc-100 text-center text-2xl font-black tracking-[0.55em] text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none placeholder:text-zinc-400 focus:border-violet-400/70 focus:bg-white dark:border-violet-300/20 dark:bg-black/20 dark:text-emerald-300 dark:placeholder:text-zinc-700 dark:focus:border-violet-300/55 dark:focus:bg-black/30"
          }
        />

        <Field
          isPage={isPage}
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
              className={
                isPage
                  ? "absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white transition hover:bg-white/[0.06]"
                  : "absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              }
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          }
        />

        <SubmitButton
          isPage={isPage}
          disabled={busy || code.length !== 6 || password.length < 8}
        >
          {busy ? "Yenilənir..." : "Şifrəni yenilə"}
        </SubmitButton>

        {info && <Alert isPage={isPage} tone="info">{info}</Alert>}
        {error && <Alert isPage={isPage} tone="error">{error}</Alert>}
      </form>

      <div className="mt-4 flex items-center justify-between gap-4 text-sm">
        <button
          type="button"
          onClick={onBack}
          className={
            isPage
              ? "inline-flex items-center gap-1.5 font-medium text-white/55 transition hover:text-white"
              : "inline-flex items-center gap-1.5 font-medium text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }
        >
          <ArrowLeft className="h-4 w-4" />
          {channel === "whatsapp" ? "Nömrəni dəyiş" : "E-poçtu dəyiş"}
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

      {!isPage && <FooterNote text="Yeni şifrə ən azı 8 simvoldan ibarət olmalıdır." />}
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
  isPage,
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
  isPage: boolean;
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
      {/* Login/register sahələrində aparıcı ikon YOXDUR — page variantında da
          göstərmirik, yoxsa eyni forma iki cür görünür. */}
      {!isPage && (
        <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-violet-300">
          {icon}
        </span>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={
          isPage
            ? `auth-page-input h-12 w-full rounded-full px-5 text-sm font-medium outline-none transition sm:h-14 sm:text-base ${
                trailing ? "pr-14" : ""
              }`
            : `h-12 w-full rounded-[13px] border border-violet-300/30 bg-zinc-100 pl-14 text-sm font-medium text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-zinc-500 focus:border-violet-400/70 focus:bg-white dark:border-violet-300/20 dark:bg-black/20 dark:text-white dark:focus:border-violet-300/55 dark:focus:bg-black/30 sm:h-14 sm:pl-16 sm:text-base ${
                trailing ? "pr-14" : "pr-5"
              }`
        }
      />
      {trailing}
    </label>
  );
}

/** Kanal seçimi düyməsi (e-poçt / WhatsApp). */
function ChannelButton({
  isPage,
  active,
  onClick,
  icon,
  label,
}: {
  isPage: boolean;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 text-sm font-semibold transition";
  if (isPage) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`${base} h-11 rounded-full border sm:h-12 ${
          active
            ? "border-transparent bg-gradient-to-r from-[#7a00ff] to-[#4b00a8] text-white shadow-[0_18px_46px_-26px_rgba(122,0,255,0.95)]"
            : "border-[#6a08d8] text-white hover:border-[#8128ff] hover:bg-white/[0.03]"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} h-11 rounded-[13px] border ${
        active
          ? "border-violet-400/70 bg-violet-500/15 text-violet-100"
          : "border-zinc-200 text-zinc-600 hover:border-violet-300/50 dark:border-white/10 dark:text-zinc-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Göndər düyməsi — page variantında login səhifəsindəki gradient pill. */
function SubmitButton({
  isPage,
  disabled,
  children,
}: {
  isPage: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={
        isPage
          ? "mt-4 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#7a00ff] to-[#4b00a8] px-6 text-sm font-semibold text-white shadow-[0_20px_58px_-30px_rgba(122,0,255,0.95)] transition hover:from-[#8c20ff] hover:to-[#5c0bc0] disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-base"
          : "mt-1.5 flex h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-gradient-to-r from-violet-600 via-purple-500 to-violet-700 px-4 text-base font-black text-white shadow-[0_0_28px_-12px_rgba(168,85,247,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:from-violet-500 hover:via-purple-400 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-lg"
      }
    >
      {children}
    </button>
  );
}

/** Xəta/məlumat qutusu — page variantında login-dəki `rounded-[22px]` üslubu. */
function Alert({
  isPage,
  tone,
  children,
}: {
  isPage: boolean;
  tone: "error" | "info";
  children: React.ReactNode;
}) {
  const error = tone === "error";
  if (isPage) {
    return (
      <div
        className={`rounded-[22px] border px-5 py-4 text-sm ${
          error
            ? "border-rose-400/25 bg-rose-500/10 text-rose-200"
            : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
        }`}
      >
        {children}
      </div>
    );
  }
  return (
    <p
      className={`rounded-[14px] border px-4 py-3 text-sm ${
        error
          ? "border-red-400/20 bg-red-500/10 text-red-200"
          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      }`}
    >
      {children}
    </p>
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
