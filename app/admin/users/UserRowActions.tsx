"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check, Pencil, Trash2, AlertTriangle, X, MessageCircle, Send, Ban, ShieldCheck } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

export function CopyPhoneButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Kopyalandı" : "Kopyala"}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition hover:bg-admin-chip2 hover:text-zinc-900"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function UserRowActions({
  userId,
  email,
  phone,
  name,
  role,
  disabled,
}: {
  userId: string;
  email: string;
  phone: string | null;
  name: string | null;
  role?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function openDialog(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setOpen(true);
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Silmə alınmadı");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {phone && (
          <WhatsAppButton userId={userId} phone={phone} name={name} email={email} />
        )}
        {role !== "ADMIN" && (
          <DisableButton userId={userId} disabled={disabled} />
        )}
        <Link
          href={`/admin/users/${userId}`}
          title="Redaktə et"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 ring-1 ring-admin-line transition hover:bg-violet-500/10 hover:text-violet-700 hover:ring-violet-500/30"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={openDialog}
          disabled={pending}
          title="Sil"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 ring-1 ring-admin-line transition hover:bg-rose-500/10 hover:text-rose-700 hover:ring-rose-500/30 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-xl border border-admin-line bg-admin-card p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => !pending && setOpen(false)}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-admin-chip hover:text-zinc-900"
              aria-label="Bağla"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/30">
                <AlertTriangle className="h-5 w-5 text-rose-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-zinc-900">
                  Müştərini silmək?
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  <span className="font-mono text-zinc-800">{email}</span>{" "}
                  istifadəçisi və onun bütün əməliyyat tarixçəsi (transactions)
                  silinəcək. Bu əməliyyat geri qaytarıla bilməz.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-admin-line transition hover:bg-admin-chip disabled:opacity-50"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-500/40 transition hover:bg-rose-500/25 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {pending ? "Silinir…" : "Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DisableButton({
  userId,
  disabled,
}: {
  userId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dialog = useDialog();
  const isDisabled = !!disabled;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const verb = isDisabled ? "aktiv etmək" : "bloklamaq";
    if (
      !(await dialog.confirm({
        title: isDisabled ? "İstifadəçini aktiv et?" : "İstifadəçini blokla?",
        message: `Bu istifadəçini ${verb} istədiyinizə əminsiniz?`,
        confirmLabel: isDisabled ? "Aktiv et" : "Blokla",
        tone: isDisabled ? "default" : "danger",
      }))
    )
      return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disable: !isDisabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        void dialog.alert({
          title: "Əməliyyat alınmadı",
          message: data.error ?? "Əməliyyat alınmadı",
          tone: "danger",
        });
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={isDisabled ? "Aktiv et" : "Blokla"}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 transition disabled:opacity-50 ${
        isDisabled
          ? "text-emerald-700 ring-emerald-500/30 hover:bg-emerald-500/10"
          : "text-zinc-600 ring-admin-line hover:bg-amber-500/10 hover:text-amber-700 hover:ring-amber-500/30"
      }`}
    >
      {isDisabled ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
    </button>
  );
}

function WhatsAppButton({
  userId,
  phone,
  name,
  email,
}: {
  userId: string;
  phone: string;
  name: string | null;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, sending]);

  function openDialog(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setSent(false);
    setOpen(true);
  }

  function closeDialog() {
    if (sending) return;
    setOpen(false);
    setText("");
    setError(null);
    setSent(false);
  }

  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Mesaj boş ola bilməz.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Mesaj göndərilmədi");
        return;
      }
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setText("");
        setSent(false);
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şəbəkə xətası");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        title="WhatsApp-dan yaz"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 ring-1 ring-admin-line transition hover:bg-emerald-500/10 hover:text-emerald-700 hover:ring-emerald-500/30"
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeDialog}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-xl border border-admin-line bg-admin-card p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={closeDialog}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-admin-chip hover:text-zinc-900"
              aria-label="Bağla"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <MessageCircle className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-zinc-900">
                  WhatsApp mesajı
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  <span className="text-zinc-800">{name ?? email}</span>{" "}
                  <span className="font-mono text-xs text-zinc-500">({phone})</span>
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Mesaj
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending || sent}
                rows={6}
                maxLength={4000}
                placeholder="Salam, Honsell PS Store-dan yazırıq…"
                className="w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
              <div className="mt-1 text-right text-[10px] text-zinc-500">
                {text.length} / 4000
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}
            {sent && (
              <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                Mesaj göndərildi.
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                disabled={sending}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-admin-line transition hover:bg-admin-chip disabled:opacity-50"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || sent || !text.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-500/40 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? "Göndərilir…" : sent ? "Göndərildi" : "Göndər"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
