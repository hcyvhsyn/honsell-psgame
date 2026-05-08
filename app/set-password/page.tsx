"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  );
}

type Status =
  | { kind: "loading" }
  | { kind: "valid"; email: string; name: string | null }
  | { kind: "invalid"; message: string }
  | { kind: "done" };

function SetPasswordInner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";

  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus({ kind: "invalid", message: "Token yoxdur" });
      return;
    }
    let cancelled = false;
    fetch(`/api/auth/set-password?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.ok) {
          setStatus({ kind: "valid", email: data.email, name: data.name ?? null });
        } else {
          setStatus({
            kind: "invalid",
            message: data.error ?? "Link etibarsızdır",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ kind: "invalid", message: "Şəbəkə xətası" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Şifrə ən azı 8 simvol olmalıdır");
      return;
    }
    if (password !== confirm) {
      setError("Şifrələr uyğun gəlmir");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Əməliyyat alınmadı");
      return;
    }
    setStatus({ kind: "done" });
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" height={28} />
        </div>

        {status.kind === "loading" && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Link yoxlanılır…</p>
          </div>
        )}

        {status.kind === "invalid" && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center">
            <h2 className="text-lg font-bold text-rose-200">Link etibarsızdır</h2>
            <p className="mt-2 text-sm text-rose-100/80">{status.message}</p>
            <p className="mt-4 text-sm text-zinc-400">
              <Link
                href="/login"
                className="font-medium text-indigo-400 hover:text-indigo-300"
              >
                Daxil ol səhifəsinə qayıt
              </Link>
            </p>
          </div>
        )}

        {status.kind === "done" && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
            <h2 className="text-lg font-bold text-emerald-200">Hazırdır!</h2>
            <p className="mt-2 text-sm text-emerald-100/80">
              Şifrən təyin olundu. Daxil ol səhifəsinə yönləndirilirsən…
            </p>
          </div>
        )}

        {status.kind === "valid" && (
          <>
            <h2 className="text-2xl font-bold">Şifrəni təyin et</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {status.name ? `${status.name}, ` : ""}
              <span className="font-mono text-zinc-300">{status.email}</span>{" "}
              hesabını aktivləşdirmək üçün şifrə yarat.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Yeni şifrə (≥ 8 simvol)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
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

              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Şifrəni təkrar daxil et"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
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
                {busy ? "Saxlanılır…" : <>Şifrəni təsdiqlə <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
