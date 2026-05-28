"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Info, Mail } from "lucide-react";
import { useCart, type EpicAccountCreationCartDetails } from "@/lib/cart";
import { validateEpicAccountDetails } from "@/lib/epicAccountCart";

/** The EPIC_ACCOUNT_CREATION ServiceProduct the modal adds to the cart. */
export type EpicAccountProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
};

export default function EpicAccountOfferModal({
  open,
  onClose,
  product,
  /** When set, after adding the account-creation item we navigate here (e.g. /cart). */
  redirectTo,
}: {
  open: boolean;
  onClose: () => void;
  product: EpicAccountProduct;
  redirectTo?: string;
}) {
  const router = useRouter();
  const { add } = useCart();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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
    const details: EpicAccountCreationCartDetails = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      email: email.trim(),
      password,
      displayName: displayName.trim(),
    };
    const v = validateEpicAccountDetails(details);
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
        productType: "EPIC_ACCOUNT_CREATION",
        epicAccountCreation: details,
      });
      onClose();
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
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
        aria-labelledby="epic-ac-title"
        className="max-h-[min(94vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-zinc-900 ring-1 ring-zinc-700">
              <Image
                src="/epic-white-logo.png"
                alt="Epic Games"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
              />
            </span>
            <div className="min-w-0">
              <p id="epic-ac-title" className="font-semibold text-zinc-950 dark:text-white">
                Türkiyə Epic Games hesabı aç
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-violet-700 dark:text-violet-300">
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

        {/* noValidate: native browser validation tooltips (e.g. the minLength
            balloon) are localized to the OS language and clash with our styled
            error box. validateEpicAccountDetails already covers every field in
            Azerbaijani, so we suppress the native UI and surface `err` instead. */}
        <form className="space-y-4 p-5" onSubmit={submit} noValidate data-no-toploader>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Epic Games oyununu almaq üçün Türkiyə Epic hesabı lazımdır. Hesabınız
            yoxdursa, aşağıdakı məlumatları daxil edin — hesabı sizin üçün biz açacağıq.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-zinc-700 dark:text-zinc-300">
              Ad
              <input
                autoComplete="given-name"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Əli"
              />
            </label>
            <label className="block text-sm text-zinc-700 dark:text-zinc-300">
              Soyad
              <input
                autoComplete="family-name"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Əliyev"
              />
            </label>
          </div>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Doğum tarixi
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            E-poçt
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hesab@gmail.com"
            />
          </label>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Şifrə (ən azı 8 simvol, görünür)
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              minLength={8}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm tracking-wide text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 simvol"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Şifrə Epic-in tələblərinə uyğun olmalıdır (böyük/kiçik hərf və rəqəm).
              Səhv olarsa sizinlə əlaqə saxlanacaq.
            </span>
          </label>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Görünən ad (display name)
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Oyunçu adı"
            />
            <span className="mt-1 block text-[11px] text-zinc-500">
              Görünən ad Epic-də unikaldır. Yazdığınız ad doludursa, ona yaxın bir
              ad təyin edə bilərik.
            </span>
          </label>

          <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] leading-relaxed text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Hesab açılarkən sizinlə əlaqə saxlanacaq: e-poçtunuza təsdiq kodu
              gələcək, onu bizə çatdırmalısınız.
            </span>
          </div>

          {err && (
            <p className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <Info className="h-4 w-4 shrink-0" />
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          >
            {busy ? "Əlavə edilir…" : "Səbətə əlavə et"}
          </button>
        </form>
      </div>
    </div>
  );
}
