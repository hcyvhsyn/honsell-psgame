"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Info, ShieldCheck } from "lucide-react";
import type { EpicOption } from "@/components/CartView";

/**
 * Mövcud Türkiyə Epic hesabını sifarişə bağlamaq üçün modal. Müştəri artıq
 * hesabı varsa (yeni açılışa ehtiyac yoxdursa) e-poçt + şifrə + görünən adını
 * daxil edir; hesab profilinə yazılır və dərhal səbətdə seçilə bilir.
 */
export default function EpicAccountLinkModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  /** Hesab uğurla bağlandıqda yaranan EpicOption-u qaytarır. */
  onAdded: (account: EpicOption) => void;
}) {
  const [epicEmail, setEpicEmail] = useState("");
  const [epicPassword, setEpicPassword] = useState("");
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

  // Modal hər açılışda təmiz başlasın.
  useEffect(() => {
    if (open) {
      setEpicEmail("");
      setEpicPassword("");
      setDisplayName("");
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const mail = epicEmail.trim();
    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setErr("Etibarlı e-poçt daxil edin.");
      return;
    }
    if (!epicPassword) {
      setErr("Şifrə daxil edin.");
      return;
    }
    // Görünən ad məcburidir (səbətdə hesabın etiketi olur); boşdursa
    // e-poçtun başlanğıcından götürürük.
    const dn = displayName.trim() || mail.split("@")[0];

    setBusy(true);
    try {
      const res = await fetch("/api/profile/epic-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          epicEmail: mail,
          epicPassword,
          displayName: dn,
          label: dn,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "Hesabı əlavə etmək alınmadı.");
        return;
      }
      const a = data.account;
      onAdded({
        id: a.id,
        label: a.label ?? dn,
        epicEmail: a.epicEmail ?? mail,
        displayName: a.displayName ?? dn,
        isDefault: !!a.isDefault,
      });
      onClose();
    } catch {
      setErr("Şəbəkə xətası. Yenidən cəhd et.");
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
        aria-labelledby="epic-link-title"
        className="max-h-[min(94vh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
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
              <p id="epic-link-title" className="font-semibold text-zinc-950 dark:text-white">
                Mövcud Epic hesabını əlavə et
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Türkiyə Epic hesabınızın məlumatlarını daxil edin.
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

        <form className="space-y-4 p-5" onSubmit={submit} noValidate data-no-toploader>
          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Epic e-poçt
            <input
              type="email"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={epicEmail}
              onChange={(e) => setEpicEmail(e.target.value)}
              placeholder="hesab@gmail.com"
            />
          </label>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Epic şifrə
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm tracking-wide text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={epicPassword}
              onChange={(e) => setEpicPassword(e.target.value)}
              placeholder="Hesabınızın şifrəsi"
            />
          </label>

          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Görünən ad (display name)
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-950 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Epic oyunçu adı (məcburi deyil)"
            />
          </label>

          <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] leading-relaxed text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Oyunu hesabınıza yükləyə bilməyimiz üçün məlumatlar lazımdır.
              Sifariş tamamlandıqdan sonra şifrənizi dəyişə bilərsiniz.
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
            {busy ? "Əlavə edilir…" : "Hesabı əlavə et"}
          </button>
        </form>
      </div>
    </div>
  );
}
