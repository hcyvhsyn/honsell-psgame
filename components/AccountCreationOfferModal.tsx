"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import type { HesabAcmaProduct } from "@/components/HesabAcmaHomeCategoryCard";
import { useCart } from "@/lib/cart";
import { validateAccountCreationDetails } from "@/lib/accountCreationCart";
import { ACCOUNT_PASSWORD_RULES_AZ } from "@/lib/accountPasswordRules";

export default function AccountCreationOfferModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: HesabAcmaProduct;
}) {
  const router = useRouter();
  const { add } = useCart();
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const v = validateAccountCreationDetails({
      fullName: fullName.trim(),
      birthDate,
      email: email.trim(),
      password,
    });
    if (v) {
      setErr(v);
      return;
    }
    setBusy(true);
    try {
      add({
        id: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        finalAzn: product.priceAznCents / 100,
        productType: "ACCOUNT_CREATION",
        accountCreation: {
          fullName: fullName.trim(),
          birthDate,
          email: email.trim(),
          password,
        },
      });
      onClose();
      setFullName("");
      setBirthDate("");
      setEmail("");
      setPassword("");
      router.push("/cart");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ac-modal-title"
        className="max-h-[min(92vh,760px)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0b0d12]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-5 dark:border-white/10 sm:p-6">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-white/[0.04] dark:ring-white/10">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                Türkiyə PSN hesabı
              </p>
              <p id="ac-modal-title" className="mt-1 text-lg font-black text-zinc-950 dark:text-white">
                Məlumatları daxil edin
              </p>
              <p className="mt-1 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                {product.title} • {(product.priceAznCents / 100).toFixed(2)} AZN
              </p>
            </div>
          </div>
          <button




            type="button"
            aria-label="Bağla"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-5 p-5 sm:p-6" onSubmit={submit}>
          <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100">
            E-poçt və şifrə yeni açılacaq PSN hesabına təyin olunur. Başqa şəxsi hesablarınızda istifadə etdiyiniz şifrəni yazmayın.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                Ad və soyad
              </span>
              <input
                autoComplete="name"
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-600"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Məs.: Əli Əliyev"
              />
            </label>

            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                Doğum tarixi
              </span>
              <input
                type="date"
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-sky-700 dark:text-sky-300" />
              E-poçt (yeni PSN üçün)
            </span>
            <input
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hesab@gmail.com"
            />
            <span className="mt-2 block text-xs font-normal leading-5 text-zinc-500 dark:text-zinc-500">
              Bu ünvan başqa ölkə və ya başqa PlayStation Store hesabına bağlı olmamalıdır.
            </span>
          </label>

          <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-sky-700 dark:text-sky-300" />
              Yeni PSN şifrəsi
            </span>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                spellCheck={false}
                inputMode="text"
                minLength={8}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pr-12 font-mono text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 simvol"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.07] dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <span className="mt-2 block text-xs font-normal leading-5 text-zinc-500 dark:text-zinc-500">
              Bu şifrə sifariş icrası üçün adminə görünəcək və PSN hesabına qoyulacaq.
            </span>
          </label>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
              Şifrə qaydaları
            </p>
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
              {ACCOUNT_PASSWORD_RULES_AZ.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {err && (
            <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{err}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <ShoppingCart className="h-4 w-4" />
            {busy ? "Əlavə edilir..." : "Səbətə əlavə et"}
          </button>
        </form>
      </div>
    </div>
  );
}
