"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, Mail, X } from "lucide-react";
import { useCart, type ServiceBundleCartItem } from "@/lib/cart";
import { validateServiceBundleMemberDetails } from "@/lib/serviceBundleShared";

/**
 * Xidmət dəstinin BİR üzvünün müştəri məlumatlarını redaktə edir.
 *
 * `PlatformCartEditModal` ilə eyni işi görür, fərq: hədəf ayrıca səbət sətri
 * deyil, dəst sətrinin içindəki üzvdür və hansı xanaların göstərilməsi
 * `member.requirement`-dən gəlir (məhsulun adına baxılmır — tələb serverdə
 * hesablanıb və `/api/cart/refresh` ilə təzələnir).
 */
export default function ServiceBundleMemberEditModal({
  bundleId,
  bundleTitle,
  member,
  onClose,
}: {
  bundleId: string;
  bundleTitle: string;
  member: ServiceBundleCartItem;
  onClose: () => void;
}) {
  const { updateServiceBundleMember } = useCart();
  const req = member.requirement;
  const slots = req.kind === "ACCOUNTS" ? (req.accountSlots ?? 0) : 0;

  const [email, setEmail] = useState(member.details?.gmail ?? "");
  const [password, setPassword] = useState(member.details?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [accounts, setAccounts] = useState(() =>
    Array.from({ length: slots }, (_, i) => ({
      email: member.details?.accounts?.[i]?.email ?? "",
      password: member.details?.accounts?.[i]?.password ?? "",
    })),
  );
  const [showAccountPw, setShowAccountPw] = useState<boolean[]>(() =>
    Array.from({ length: slots }, () => false),
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function patchAccount(i: number, key: "email" | "password", value: string) {
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
    if (err) setErr(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const details =
      req.kind === "ACCOUNTS"
        ? { accounts: accounts.map((a) => ({ email: a.email.trim().toLowerCase(), password: a.password })) }
        : {
            gmail: email.trim().toLowerCase(),
            ...(req.kind === "EMAIL_PASSWORD" ? { password } : {}),
          };

    // Səbətdəki bloklama ilə EYNİ funksiya — iki yerdə fərqli qayda olsa
    // müştəri modalı bağlaya bilir, amma "Ödə" düyməsi susqun dayanır.
    const problem = validateServiceBundleMemberDetails(req, details);
    if (problem) {
      setErr(problem);
      return;
    }
    updateServiceBundleMember(bundleId, member.serviceProductId, details);
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
              {member.imageUrl ? (
                <Image
                  src={member.imageUrl}
                  alt={member.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white">{member.title}</p>
              <p className="mt-0.5 truncate text-sm text-zinc-400">{bundleTitle} dəsti</p>
              <p className="mt-1 text-sm tabular-nums text-fuchsia-300">
                {(member.bundleAznCents / 100).toFixed(2)} AZN
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
            Məlumatlar ödənişə qədər burada yenilənə bilər — serverə yalnız
            &ldquo;Ödə&rdquo; düyməsində göndəriləcək.
          </p>

          {req.kind === "ACCOUNTS" ? (
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
                {req.emailLabel ?? "Email"}
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
                    placeholder={req.allowAnyEmail ? "ad@example.com" : "seninhesabin@gmail.com"}
                    className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-12 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-fuchsia-500"
                  />
                </div>
              </label>

              {req.kind === "EMAIL_PASSWORD" ? (
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
              ) : null}
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
