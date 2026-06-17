"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, UserPlus, X } from "lucide-react";

export default function CreateUserButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  function close() {
    setOpen(false);
    setError(null);
    setSuccess(null);
    setEmail("");
    setName("");
    setPhone("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          phone: phone.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Yaradılmadı");
        return;
      }
      setSuccess(
        `İstifadəçi yaradıldı və şifrə təyin etmə linki ${data.email}-ə göndərildi (link ${data.expiresInHours} saat etibarlıdır).`
      );
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
      >
        <UserPlus className="h-4 w-4" />
        Yeni istifadəçi
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !pending && close()}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-xl border border-admin-line bg-admin-card p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => !pending && close()}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-admin-chip hover:text-zinc-900"
              aria-label="Bağla"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-500/10 ring-1 ring-violet-500/30">
                <UserPlus className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Yeni istifadəçi yarat
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  İstifadəçiyə şifrə təyin etmək və hesabı təsdiqləmək üçün email
                  göndəriləcək.
                </p>
              </div>
            </div>

            {success ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-md bg-admin-chip py-2 text-sm font-medium text-zinc-800 hover:bg-admin-chip2"
                >
                  Bağla
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    E-poçt *
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full rounded-md border border-admin-line bg-admin-card py-2 pl-9 pr-3 text-sm placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Ad Soyad *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Telefon (opsional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+994…"
                    className="w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-admin-line transition hover:bg-admin-chip disabled:opacity-50"
                  >
                    Ləğv et
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    {pending ? "Yaradılır…" : "Yarat və email göndər"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
