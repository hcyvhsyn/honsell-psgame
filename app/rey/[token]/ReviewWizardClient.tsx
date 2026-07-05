"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star, Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

type Step = "name" | "email" | "review" | "otp" | "password" | "done";

const REVIEW_MIN = 20;
const REVIEW_MAX = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_ORDER: Step[] = ["name", "email", "review", "otp"];

export default function ReviewWizardClient({
  token,
  productTitle,
}: {
  token: string;
  productTitle: string;
}) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setPasswordToken, setSetPasswordToken] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const shownStars = useMemo(() => hover ?? rating, [hover, rating]);
  const stepIndex = STEP_ORDER.indexOf(step);

  function goNameNext() {
    setError(null);
    if (name.trim().split(/\s+/).filter(Boolean).length < 2) {
      setError("Ad və Soyadınızı tam yazın.");
      return;
    }
    setStep("email");
  }

  function goEmailNext() {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Düzgün email ünvanı yazın.");
      return;
    }
    setStep("review");
  }

  async function sendOtp() {
    setError(null);
    if (reviewText.trim().length < REVIEW_MIN) {
      setError(`Rəy ən azı ${REVIEW_MIN} simvol olmalıdır.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/rey/${token}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          reviewText: reviewText.trim(),
          rating,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kod göndərilə bilmədi.");
        return;
      }
      setStep("otp");
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd edin.");
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/rey/${token}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          reviewText: reviewText.trim(),
          rating,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Kod yenidən göndərilə bilmədi.");
    } catch {
      setError("Şəbəkə xətası.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("6 rəqəmli kodu yazın.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/rey/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Təsdiq alınmadı.");
        return;
      }
      setReferralCode(data.referralCode ?? null);
      if (data.setPasswordToken) {
        setSetPasswordToken(data.setPasswordToken);
        setStep("password");
      } else {
        setStep("done");
      }
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd edin.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    setError(null);
    if (password.length < 8) {
      setError("Şifrə ən azı 8 simvol olmalıdır.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: setPasswordToken, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Şifrə təyin edilə bilmədi.");
        return;
      }
      setStep("done");
    } catch {
      setError("Şəbəkə xətası.");
    } finally {
      setBusy(false);
    }
  }

  // ── Done ──
  if (step === "done") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <div className="mb-3 flex items-center gap-2 text-emerald-200">
          <CheckCircle2 className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Təşəkkürlər!</h2>
        </div>
        <p className="text-sm text-zinc-300">
          Rəyin uğurla göndərildi və artıq saytda göstərilir. honsell.store hesabın da
          yaradıldı — indi daxil olmusan.
        </p>
        {referralCode && (
          <p className="mt-3 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
            Referal kodun: <span className="font-mono text-zinc-200">{referralCode}</span>
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/#reyler"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Rəylərə bax
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Ana səhifə
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      {/* Progress */}
      {step !== "password" && (
        <div className="mb-6 flex items-center gap-2">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                i <= stepIndex ? "bg-indigo-500" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
      )}

      <div className="mb-5 text-xs uppercase tracking-wider text-zinc-500">{productTitle}</div>

      {/* Step 1: Ad Soyad */}
      {step === "name" && (
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-500">1. Ad Soyad</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ad Soyad"
            autoFocus
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </label>
      )}

      {/* Step 2: Email */}
      {step === "email" && (
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-zinc-500">2. Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sən@mail.com"
            autoFocus
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <span className="mt-1 block text-[11px] text-zinc-500">
            Hesabın bu email ilə yaranacaq.
          </span>
        </label>
      )}

      {/* Step 3: Rəy */}
      {step === "review" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">3. Rəyin</div>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setRating(n)}
                aria-label={`${n} ulduz`}
                className="rounded p-1 transition hover:scale-110"
              >
                <Star
                  className={`h-7 w-7 ${
                    n <= shownStars
                      ? "fill-amber-400 text-amber-400"
                      : "fill-zinc-800 text-zinc-700"
                  }`}
                />
              </button>
            ))}
            <span className="ml-2 text-xs text-zinc-500">{shownStars}/5</span>
          </div>
          <textarea
            rows={5}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Təcrübən necə oldu? Çatdırılma, dəstək, qiymət — hər nə vacibdirsə..."
            maxLength={REVIEW_MAX}
            className="mt-3 w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <div className="mt-1 flex justify-end text-[10px] text-zinc-600">
            {reviewText.length}/{REVIEW_MAX} (min {REVIEW_MIN})
          </div>
        </div>
      )}

      {/* Step 4: OTP */}
      {step === "otp" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">
            4. WhatsApp təsdiq kodu
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            WhatsApp nömrənə 6 rəqəmli kod göndərdik. Kodu daxil et.
          </p>
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="______"
            autoFocus
            className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-center text-2xl tracking-[0.5em] text-zinc-100 placeholder:text-zinc-700 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={resendOtp}
            disabled={busy}
            className="mt-3 text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-50"
          >
            Kodu yenidən göndər
          </button>
        </div>
      )}

      {/* Step 5: Şifrə (optional) */}
      {step === "password" && (
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">
            Şifrə təyin et (istəyə bağlı)
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Rəyin göndərildi və hesabın yaradıldı ✅. İstəsən indi şifrə təyin et ki, sonra
            asan daxil olasan. Keçsən, sonra “Şifrəni unutdum” ilə də təyin edə bilərsən.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ən azı 8 simvol"
            autoFocus
            className="mt-3 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex items-center gap-2">
        {(step === "email" || step === "review") && (
          <button
            type="button"
            onClick={() => setStep(step === "email" ? "name" : "email")}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> Geri
          </button>
        )}

        {step === "name" && (
          <button
            type="button"
            onClick={goNameNext}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Davam et <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === "email" && (
          <button
            type="button"
            onClick={goEmailNext}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Davam et <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === "review" && (
          <button
            type="button"
            onClick={sendOtp}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Kodu göndər <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {step === "otp" && (
          <button
            type="button"
            onClick={verify}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Təsdiqlə
          </button>
        )}
        {step === "password" && (
          <>
            <button
              type="button"
              onClick={() => setStep("done")}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
            >
              Keç
            </button>
            <button
              type="button"
              onClick={savePassword}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Şifrəni yadda saxla
            </button>
          </>
        )}
      </div>
    </div>
  );
}
