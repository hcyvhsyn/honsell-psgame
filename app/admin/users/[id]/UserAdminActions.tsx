"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Wallet2, Save } from "lucide-react";
import { useDialog } from "@/lib/dialogs";

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function parseAznToCents(v: string): number | null {
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export default function UserAdminActions({
  userId,
  email,
  walletBalance,
  cashbackBalanceCents,
  referralBalanceCents,
  referralCode,
  referredByCode,
}: {
  userId: string;
  email: string;
  walletBalance: number;
  cashbackBalanceCents: number;
  referralBalanceCents: number;
  referralCode: string;
  referredByCode: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dialog = useDialog();

  const initial = useMemo(
    () => ({
      wallet: centsToInput(walletBalance),
      cashback: centsToInput(cashbackBalanceCents),
      referral: centsToInput(referralBalanceCents),
      referralCode: String(referralCode ?? ""),
      referredByCode: String(referredByCode ?? ""),
    }),
    [walletBalance, cashbackBalanceCents, referralBalanceCents, referralCode, referredByCode]
  );

  const [wallet, setWallet] = useState(initial.wallet);
  const [cashback, setCashback] = useState(initial.cashback);
  const [referral, setReferral] = useState(initial.referral);
  const [refCode, setRefCode] = useState(initial.referralCode);
  const [referredBy, setReferredBy] = useState(initial.referredByCode);

  const dirty =
    wallet !== initial.wallet ||
    cashback !== initial.cashback ||
    referral !== initial.referral ||
    refCode !== initial.referralCode ||
    referredBy !== initial.referredByCode;

  function save() {
    setError(null);
    const walletCents = parseAznToCents(wallet);
    const cashbackCents = parseAznToCents(cashback);
    const referralCents = parseAznToCents(referral);
    if (walletCents == null || cashbackCents == null || referralCents == null) {
      setError("Balans formatı düzgün deyil. Məs: 12.50");
      return;
    }
    if (walletCents < 0 || cashbackCents < 0 || referralCents < 0) {
      setError("Balans mənfi ola bilməz.");
      return;
    }
    const nextReferralCode = refCode.trim().toUpperCase();
    const nextReferredByCode = referredBy.trim().toUpperCase();
    if (!nextReferralCode || !/^[A-Z0-9]{4,20}$/.test(nextReferralCode)) {
      setError("Referral kod formatı səhvdir (A-Z/0-9, 4–20 simvol).");
      return;
    }
    if (nextReferredByCode && !/^[A-Z0-9]{4,20}$/.test(nextReferredByCode)) {
      setError("Referrer kod formatı səhvdir (A-Z/0-9, 4–20 simvol) və ya boş buraxın.");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletBalance: walletCents,
          cashbackBalanceCents: cashbackCents,
          referralBalanceCents: referralCents,
          referralCode: nextReferralCode,
          referredByCode: nextReferredByCode || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Yadda saxlanmadı");
        return;
      }
      router.refresh();
    });
  }

  async function deleteUser() {
    setError(null);
    if (
      !(await dialog.confirm({
        title: "Müştərini sil?",
        message: (
          <span>
            <span className="font-mono">{email}</span>
            <br />
            Diqqət: bütün əməliyyat tarixçəsi (transactions) də silinəcək.
          </span>
        ),
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;

    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Silmə alınmadı");
        return;
      }
      router.push("/admin/users");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wallet2 className="h-4 w-4 text-zinc-400" />
          Balans və hesab idarəetməsi
        </h2>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-[11px] text-amber-300">Dəyişiklik var</span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-500/30 transition hover:bg-indigo-500/20 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {pending ? "Yadda saxlanır…" : "Yadda saxla"}
          </button>
        </div>
      </header>

      <div className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Cüzdan (AZN)" value={wallet} onChange={setWallet} />
          <Field label="Cashback (AZN)" value={cashback} onChange={setCashback} />
          <Field label="Referral (AZN)" value={referral} onChange={setReferral} />
          <Field label="Referral kodu" value={refCode} onChange={setRefCode} />
          <Field label="Referrer kodu (ixtiyari)" value={referredBy} onChange={setReferredBy} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <span className="text-[11px] text-zinc-500">
            Müştəri silinəndə bütün əməliyyat tarixçəsi də silinir. Bunun əvəzinə hesabı blokla.
          </span>
          <button
            type="button"
            onClick={deleteUser}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/30 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Müştərini sil
          </button>
        </div>

        {error && <div className="mt-3 text-xs text-rose-300">{error}</div>}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
        placeholder="0.00"
      />
    </label>
  );
}

