"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Trash2, Mail, KeyRound, User, Eye, EyeOff, Copy, CheckCircle2 } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

export type EpicAccountSummary = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  epicEmail: string;
  epicPassword: string;
  displayName: string;
  isDefault: boolean;
};

export default function EpicAccountsManager({
  initial,
}: {
  initial: EpicAccountSummary[];
}) {
  const [accounts, setAccounts] = useState<EpicAccountSummary[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const dialog = useDialog();

  async function refresh() {
    const res = await fetch("/api/profile/epic-accounts");
    const data = await res.json();
    if (data?.accounts) setAccounts(data.accounts);
  }

  async function setDefault(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/profile/epic-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (!res.ok) setError("Əsas hesabı yeniləmək alınmadı.");
    await refresh();
    setBusy(null);
  }

  async function remove(id: string) {
    const acc = accounts.find((a) => a.id === id);
    const ok = await dialog.confirm({
      title: "Epic hesabını sil?",
      message: acc ? `“${acc.label}” hesabı siyahıdan silinəcək.` : "Hesab silinəcək.",
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(id);
    const res = await fetch(`/api/profile/epic-accounts/${id}`, { method: "DELETE" });
    if (!res.ok) setError("Hesabı silmək alınmadı.");
    await refresh();
    setBusy(null);
  }

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
    } catch {
      /* ignore */
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-center text-xs text-zinc-500">
        Hələ Epic hesabınız yoxdur. Epic oyunu alarkən hesab açılışını seçsəniz,
        hesab burada görünəcək.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {accounts.map((a) => {
        const show = !!revealed[a.id];
        return (
          <div
            key={a.id}
            className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-zinc-900 ring-1 ring-zinc-700">
                  <Image src="/epic-white-logo.png" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                </span>
                {a.label}
              </span>
              {a.isDefault ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
                  <Star className="h-3 w-3 fill-amber-300" /> Əsas
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setDefault(a.id)}
                  disabled={busy === a.id}
                  className="text-[11px] font-medium text-zinc-400 transition hover:text-amber-300 disabled:opacity-50"
                >
                  Əsas et
                </button>
              )}
            </div>

            <dl className="mt-3 space-y-1.5 text-xs">
              <Row icon={<User className="h-3.5 w-3.5" />} label="Görünən ad" value={a.displayName} onCopy={() => copy(`${a.id}-dn`, a.displayName)} copied={copied === `${a.id}-dn`} />
              <Row icon={<Mail className="h-3.5 w-3.5" />} label="E-poçt" value={a.epicEmail} onCopy={() => copy(`${a.id}-em`, a.epicEmail)} copied={copied === `${a.id}-em`} />
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-zinc-500">
                  <KeyRound className="h-3.5 w-3.5" /> Şifrə
                </span>
                <span className="flex items-center gap-1.5">
                  <code className="font-mono text-zinc-200">{show ? a.epicPassword : "••••••••"}</code>
                  <button type="button" onClick={() => setRevealed((r) => ({ ...r, [a.id]: !show }))} className="text-zinc-500 hover:text-zinc-200" aria-label="Şifrəni göstər">
                    {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => copy(`${a.id}-pw`, a.epicPassword)} className="text-zinc-500 hover:text-zinc-200" aria-label="Şifrəni kopyala">
                    {copied === `${a.id}-pw` ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </span>
              </div>
            </dl>

            <div className="mt-3 flex justify-end border-t border-zinc-800/70 pt-2">
              <button
                type="button"
                onClick={() => remove(a.id)}
                disabled={busy === a.id}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 transition hover:text-rose-300 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Sil
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onCopy,
  copied,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-zinc-500">{icon} {label}</span>
      <span className="flex items-center gap-1.5">
        <span className="truncate text-zinc-200">{value || "—"}</span>
        {value ? (
          <button type="button" onClick={onCopy} className="text-zinc-500 hover:text-zinc-200" aria-label={`${label} kopyala`}>
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </span>
    </div>
  );
}
