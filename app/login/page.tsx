"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import AuthPageShell from "@/components/auth/AuthPageShell";

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
    if (res.ok) { window.location.href = next; return; }
    const data = await res.json().catch(() => ({}));
    if (res.status === 403 && data.needsVerification && data.email) {
      setNeedsReset({ email: data.email });
    } else {
      setError(data.error ?? "Daxil olmaq alınmadı.");
    }
    setBusy(false);
  }

  return (
    <AuthPageShell
      mode="login"
      title="Daxil ol"
      subtitle="Daxil olmaq üçün aşağıdakı xanaları doldurun"
    >
      <form onSubmit={submit} className="mx-auto w-full max-w-[39rem] space-y-3">
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="auth-page-input h-12 w-full rounded-full px-5 text-sm font-medium outline-none transition sm:h-14 sm:text-base"
        />

        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            placeholder="Şifrə"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="auth-page-input h-12 w-full rounded-full px-5 pr-14 text-sm font-medium outline-none transition sm:h-14 sm:text-base"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Şifrəni gizlət" : "Şifrəni göstər"}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white transition hover:bg-white/[0.06]"
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-white/55 transition hover:text-white sm:text-sm"
          >
            Şifrəni unutmusan?
          </Link>
        </div>

        {needsReset && (
          <div className="rounded-[22px] border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
            <p className="font-semibold text-amber-200">Hesabınız təsdiqlənməyib</p>
            <p className="mt-1 text-amber-100/80">
              <span className="font-mono">{needsReset.email}</span> üçün hesab
              tamamlanmayıb. Şifrəni yeniləyərək hesabınızı aktivləşdirin.
            </p>
            <Link
              href={`/forgot-password?email=${encodeURIComponent(needsReset.email)}`}
              className="mt-3 inline-flex rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300"
            >
              Şifrəni yenilə
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-[22px] border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#7a00ff] to-[#4b00a8] px-6 text-sm font-semibold text-white shadow-[0_20px_58px_-30px_rgba(122,0,255,0.95)] transition hover:from-[#8c20ff] hover:to-[#5c0bc0] disabled:cursor-not-allowed disabled:opacity-55 sm:h-14 sm:text-base"
        >
          {busy ? (
            "Daxil olunur..."
          ) : (
            <>
              Daxil ol <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </form>
    </AuthPageShell>
  );
}
