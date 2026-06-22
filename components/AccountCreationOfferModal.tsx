"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
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
        className="max-h-[min(92vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
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
              <p id="ac-modal-title" className="font-semibold text-zinc-950 dark:text-white">
                {product.title}
              </p>
              <p className="mt-1 text-sm tabular-nums text-fuchsia-700 dark:text-fuchsia-300">
                {(product.priceAznCents / 100).toFixed(2)} AZN
              </p>
            </div>
          </div>
          <button




            type="button"
            aria-label="Bağla"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={submit}>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-500">
            Türkiyə PSN hesabı üçün tələb olunan məlumatları daxil edin. Hesab aktivləşdikdə bu e-poçt və şifrədən istifadə
            olunacaq; e-poçt başqa ölkə və ya növbəti PS Store-da istifadə olunmamalıdır.
          </p>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Ad və soyad
            <input
              autoComplete="name"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-fuchsia-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Məs.: Əli Əliyev"
            />
          </label>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Doğum tarixi
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-fuchsia-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            E-poçt (yeni PSN üçün)
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-fuchsia-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hesab@gmail.com"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Bu ünvan başqa ölkə və ya növbəti PlayStation Store hesabına bağlı olmamalıdır.
            </span>
          </label>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Şifrə (ən azı 8 simvol, görünür)
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              minLength={8}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm tracking-wide text-zinc-950 focus:border-fuchsia-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 simvol"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Eyni şifrə sifariş məlumatlarında admin tərəfindən görünür — PSN-də də bu şifrə təyin olunacaq.
            </span>
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-zinc-500">
              {ACCOUNT_PASSWORD_RULES_AZ.map((rule) => (
                <li key={rule} className="flex gap-1.5">
                  <span className="text-zinc-400 dark:text-zinc-600">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </label>

          {err && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{err}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-fuchsia-600 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-60"
          >
            {busy ? "Əlavə edilir…" : "Səbətə əlavə et"}
          </button>
        </form>
      </div>
    </div>
  );
}
