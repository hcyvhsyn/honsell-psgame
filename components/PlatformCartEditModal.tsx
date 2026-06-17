"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, Mail, X } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";

const PLATFORM_LABELS: Record<string, { title: string; emailLabel: string; emailPlaceholder: string }> = {
  LINKEDIN: {
    title: "LinkedIn hesab məlumatları",
    emailLabel: "LinkedIn email",
    emailPlaceholder: "ad@example.com",
  },
  YOUTUBE: {
    title: "YouTube (Gmail) hesab məlumatları",
    emailLabel: "Gmail ünvanı",
    emailPlaceholder: "seninhesabin@gmail.com",
  },
};

function labelsFor(platformKind?: string) {
  if (platformKind && PLATFORM_LABELS[platformKind]) return PLATFORM_LABELS[platformKind];
  return {
    title: "Hesab məlumatları",
    emailLabel: "Email",
    emailPlaceholder: "ad@example.com",
  };
}

export default function PlatformCartEditModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: CartItem;
  onClose: () => void;
}) {
  const { updateStreaming } = useCart();
  const s = item.streaming;
  const isMultiAccount = Boolean(s?.accounts?.length);
  const [email, setEmail] = useState(s?.gmail ?? "");
  const [password, setPassword] = useState(s?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [accounts, setAccounts] = useState(
    s?.accounts?.map((a) => ({ email: a.email, password: a.password })) ?? [],
  );
  const [showAccountPw, setShowAccountPw] = useState<boolean[]>(
    (s?.accounts ?? []).map(() => false),
  );

  const labels = labelsFor(s?.platformKind);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || item.productType !== "PLATFORM") return null;

  function patchAccount(i: number, key: "email" | "password", value: string) {
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
    if (err) setErr(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (isMultiAccount) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const cleaned: { email: string; password: string }[] = [];
      for (let i = 0; i < accounts.length; i++) {
        const clean = accounts[i].email.trim().toLowerCase();
        if (!clean || !emailRegex.test(clean)) {
          setErr(`${i + 1}-ci hesab üçün düzgün email daxil et.`);
          return;
        }
        if (!accounts[i].password || accounts[i].password.length < 4) {
          setErr(`${i + 1}-ci hesab üçün şifrə daxil et (ən az 4 simvol).`);
          return;
        }
        cleaned.push({ email: clean, password: accounts[i].password });
      }
      updateStreaming(item.id, { accounts: cleaned, platformKind: s?.platformKind });
      onClose();
      return;
    }

    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setErr("Düzgün email ünvanı daxil et.");
      return;
    }
    if (s?.platformKind === "YOUTUBE" && !/^[^\s@]+@gmail\.com$/.test(clean)) {
      setErr("YouTube üçün yalnız Gmail (@gmail.com) qəbul edilir.");
      return;
    }
    if (!password || password.length < 4) {
      setErr("Şifrəni daxil et (ən az 4 simvol).");
      return;
    }
    updateStreaming(item.id, {
      gmail: clean,
      password,
      platformKind: s?.platformKind,
    });
    onClose();
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[min(92vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-5">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white">{labels.title}</p>
              <p className="mt-0.5 truncate text-sm text-zinc-400">{item.title}</p>
              <p className="mt-1 text-sm tabular-nums text-fuchsia-300">
                {(item.finalAzn * item.qty).toFixed(2)} AZN
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Bağla"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={submit}>
          <p className="text-xs leading-relaxed text-zinc-500">
            Məlumatlar ödənişə qədər burada yenilənə bilər — serverə yalnız &ldquo;Ödə&rdquo; düyməsində göndəriləcək.
          </p>

          {isMultiAccount ? (
            accounts.map((acc, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
                  Hesab {i + 1}
                </p>
                <label className="block text-sm text-zinc-300">
                  Email
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fuchsia-300" />
                    <input
                      type="email"
                      autoComplete="off"
                      value={acc.email}
                      onChange={(e) => patchAccount(i, "email", e.target.value)}
                      placeholder="hesab@example.com"
                      className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-12 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-fuchsia-500"
                    />
                  </div>
                </label>
                <label className="mt-3 block text-sm text-zinc-300">
                  Şifrə
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fuchsia-300" />
                    <input
                      type={showAccountPw[i] ? "text" : "password"}
                      autoComplete="off"
                      value={acc.password}
                      onChange={(e) => patchAccount(i, "password", e.target.value)}
                      placeholder="Hesab şifrəsi"
                      className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-12 pr-12 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-fuchsia-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowAccountPw((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
                      }
                      className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                      aria-label={showAccountPw[i] ? "Şifrəni gizlət" : "Şifrəni göstər"}
                    >
                      {showAccountPw[i] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
              </div>
            ))
          ) : (
          <>
          <label className="block text-sm text-zinc-300">
            {labels.emailLabel}
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fuchsia-300" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (err) setErr(null);
                }}
                placeholder={labels.emailPlaceholder}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-12 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-fuchsia-500"
              />
            </div>
          </label>

          <label className="block text-sm text-zinc-300">
            Şifrə
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fuchsia-300" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="off"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (err) setErr(null);
                }}
                placeholder="Hesab şifrəsi"
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-12 pr-12 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-fuchsia-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          </>
          )}

          {err && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {err}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
            >
              Ləğv et
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-fuchsia-600 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500"
            >
              Yadda saxla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
