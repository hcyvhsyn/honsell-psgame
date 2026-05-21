"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

type AccentKey = "indigo" | "sky" | "rose" | "zinc";

const ACCENTS: Record<AccentKey, { border: string; bg: string; badge: string; text: string }> = {
  indigo: {
    border: "border-indigo-500/30",
    bg: "bg-indigo-500/[0.05]",
    badge: "bg-indigo-500/15 text-indigo-200 ring-indigo-500/30",
    text: "text-indigo-300",
  },
  sky: {
    border: "border-sky-500/30",
    bg: "bg-sky-500/[0.05]",
    badge: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
    text: "text-sky-300",
  },
  rose: {
    border: "border-red-500/30",
    bg: "bg-red-500/[0.05]",
    badge: "bg-red-500/15 text-red-200 ring-red-500/30",
    text: "text-red-300",
  },
  zinc: {
    border: "border-zinc-700",
    bg: "bg-zinc-900/40",
    badge: "bg-zinc-800 text-zinc-300 ring-zinc-700",
    text: "text-zinc-300",
  },
};

export default function ProfileCredentialCard({
  accent = "zinc",
  topLabel,
  title,
  subtitle,
  emailLabel,
  email,
  password,
  deleteIdentity,
}: {
  accent?: AccentKey;
  topLabel: string;
  title: string;
  subtitle?: string;
  emailLabel: string;
  email: string;
  password: string | null;
  /** Verildikdə kart sağ üst guşədə silmə düyməsi göstərir — bu məlumatlar bu
   *  istifadəçinin sifarişlərindən təmizlənir. */
  deleteIdentity?: { platformKind: "LINKEDIN" | "YOUTUBE"; email: string };
}) {
  const a = ACCENTS[accent];
  const router = useRouter();
  const dialog = useDialog();
  const [revealPwd, setRevealPwd] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function copy(value: string, kind: "email" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1200);
    } catch {
      // clipboard may be unavailable in some contexts; silently ignore
    }
  }

  async function handleDelete() {
    if (!deleteIdentity) return;
    const brand = deleteIdentity.platformKind === "LINKEDIN" ? "LinkedIn" : "YouTube";
    const ok = await dialog.confirm({
      title: "Profili sil?",
      message: (
        <>
          <p>
            <span className="font-medium text-zinc-200">{deleteIdentity.email}</span>{" "}
            ünvanlı {brand} profil məlumatlarını sifarişlərindən sil.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Sifariş tarixçəsi qalır, yalnız email və şifrə təmizlənir.
          </p>
        </>
      ),
      confirmLabel: "Sil",
      cancelLabel: "Ləğv et",
      tone: "danger",
    });
    if (!ok) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/profile/profiles", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(deleteIdentity),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setDeleteError(typeof j?.error === "string" ? j.error : "Silinmədi.");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Şəbəkə xətası.");
      setDeleting(false);
    }
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${a.border} ${a.bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${a.badge}`}
          >
            {topLabel}
          </span>
          <p className="mt-2 truncate text-sm font-semibold text-white">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
        {deleteIdentity ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Profili sil"
            className="shrink-0 rounded-md p-1.5 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </div>

      {deleteError ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
          {deleteError}
        </p>
      ) : null}

      <div className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
        <CredentialRow
          label={emailLabel}
          value={email}
          accentTextClass={a.text}
          copied={copied === "email"}
          onCopy={() => copy(email, "email")}
        />
        <div className="h-px bg-zinc-800/70" />
        <CredentialRow
          label="Şifrə"
          value={password ?? ""}
          accentTextClass={a.text}
          mono
          masked={password != null && !revealPwd}
          placeholder={password == null ? "Saxlanılmayıb" : undefined}
          copied={copied === "password"}
          onCopy={password ? () => copy(password, "password") : undefined}
          rightAdornment={
            password != null ? (
              <button
                type="button"
                onClick={() => setRevealPwd((v) => !v)}
                aria-label={revealPwd ? "Şifrəni gizlət" : "Şifrəni göstər"}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
              >
                {revealPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  accentTextClass,
  mono,
  masked,
  placeholder,
  copied,
  onCopy,
  rightAdornment,
}: {
  label: string;
  value: string;
  accentTextClass: string;
  mono?: boolean;
  masked?: boolean;
  placeholder?: string;
  copied?: boolean;
  onCopy?: () => void;
  rightAdornment?: React.ReactNode;
}) {
  const display = placeholder ?? (masked ? "•".repeat(Math.min(value.length, 12)) : value);
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${accentTextClass}`}>
          {label}
        </p>
        <p
          className={`mt-0.5 truncate text-[13px] text-zinc-100 ${
            mono ? "font-mono tracking-wider" : "font-medium"
          } ${placeholder ? "italic text-zinc-500" : ""}`}
        >
          {display}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {rightAdornment}
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`${label} kopyala`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
