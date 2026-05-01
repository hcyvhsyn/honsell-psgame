"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";
import { validateAccountCreationDetails } from "@/lib/accountCreationCart";

export default function AccountCreationCartEditModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: CartItem;
  onClose: () => void;
}) {
  const { updateAccountCreation } = useCart();
  const ac = item.accountCreation;
  const [fullName, setFullName] = useState(ac?.fullName ?? "");
  const [birthDate, setBirthDate] = useState(ac?.birthDate ?? "");
  const [email, setEmail] = useState(ac?.email ?? "");
  const [password, setPassword] = useState(ac?.password ?? "");
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

  if (!open || item.productType !== "ACCOUNT_CREATION") return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const details = {
      fullName: fullName.trim(),
      birthDate,
      email: email.trim(),
      password,
    };
    const v = validateAccountCreationDetails(details);
    if (v) {
      setErr(v);
      return;
    }
    setBusy(true);
    try {
      updateAccountCreation(item.id, details);
      onClose();
    } finally {
      setBusy(false);
    }
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
        aria-labelledby="ac-cart-edit-title"
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
                  unoptimized
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p id="ac-cart-edit-title" className="font-semibold text-white">
                {item.title}
              </p>
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
            Məlumatlar ödənişə qədər burada yenilənə bilər — serverə yalnız “Ödə” düyməsində göndəriləcək.
          </p>

          <label className="block text-sm text-zinc-300">
            Ad və soyad
            <input
              autoComplete="name"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-fuchsia-500 focus:outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Məs.: Əli Əliyev"
            />
          </label>

          <label className="block text-sm text-zinc-300">
            Doğum tarixi
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-fuchsia-500 focus:outline-none"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>

          <label className="block text-sm text-zinc-300">
            E-poçt (yeni PSN üçün)
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-fuchsia-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hesab@gmail.com"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Bu ünvan başqa ölkə və ya növbəti PlayStation Store hesabına bağlı olmamalıdır.
            </span>
          </label>

          <label className="block text-sm text-zinc-300">
            Şifrə (ən azı 8 simvol, görünür)
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              minLength={8}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm tracking-wide text-white focus:border-fuchsia-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 simvol"
            />
          </label>

          {err && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>
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
              disabled={busy}
              className="flex-1 rounded-xl bg-fuchsia-600 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-60"
            >
              {busy ? "…" : "Yadda saxla"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
