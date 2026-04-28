"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Copy,
  Check,
  Upload,
  Receipt as ReceiptIcon,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
} from "lucide-react";

type DepositRequest = {
  id: string;
  amountAznCents: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  receiptUrl: string | null;
  createdAt: string;
};

type DepositInfo = {
  depositCardNumber: string | null;
  depositCardHolder: string | null;
  requests: DepositRequest[];
};

export default function WalletDepositForm({ authed }: { authed: boolean }) {
  const [info, setInfo] = useState<DepositInfo | null>(null);
  const [amount, setAmount] = useState(20);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authed) return;
    fetch("/api/wallet/deposit-info")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, [authed]);

  if (!authed) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
        <p className="text-sm text-zinc-400">Cüzdanını doldurmaq üçün daxil ol.</p>
        <Link
          href="/login?next=/wallet"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Daxil ol <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  async function copyCard() {
    if (!info?.depositCardNumber) return;
    try {
      await navigator.clipboard.writeText(
        info.depositCardNumber.replace(/\s+/g, "")
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage({ ok: false, text: "Qəbz şəklini seç." });
      return;
    }
    setBusy(true);
    setMessage(null);

    const fd = new FormData();
    fd.append("amountAzn", String(amount));
    fd.append("receipt", file);

    const res = await fetch("/api/wallet/request-deposit", {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.ok) {
      setMessage({
        ok: true,
        text: "Sorğu göndərildi. Admin qəbzi yoxlayan kimi balansın artırılacaq.",
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Refresh requests list
      const fresh = await fetch("/api/wallet/deposit-info").then((r) => r.json());
      setInfo(fresh);
    } else {
      setMessage({ ok: false, text: data.error ?? "Göndərmə alınmadı." });
    }
  }

  const card = info?.depositCardNumber;
  const formattedCard = card?.replace(/(.{4})/g, "$1 ").trim() ?? "";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 via-zinc-900/60 to-zinc-950 p-6">
        <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300/80">
          <CreditCard className="h-4 w-4" /> Köçürmə kartı
        </div>

        {info === null ? (
          <div className="space-y-3">
            <div className="h-8 w-64 animate-pulse rounded bg-zinc-800/80" />
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-800/60" />
            <div className="h-8 w-44 animate-pulse rounded bg-zinc-800/60" />
          </div>
        ) : card ? (
          <>
            <div className="mb-3 select-all font-mono text-2xl font-semibold tracking-[0.25em] text-white">
              {formattedCard}
            </div>
            {info?.depositCardHolder && (
              <div className="mb-4 text-sm text-zinc-300">
                {info.depositCardHolder}
              </div>
            )}
            <button
              type="button"
              onClick={copyCard}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" /> Kopyalandı
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Kart nömrəsini kopyala
                </>
              )}
            </button>
            <p className="mt-4 text-xs text-zinc-400">
              1. Kart nömrəsini kopyala. 2. Banking tətbiqindən bu karta köçürmə
              et. 3. Aşağıda qəbzin şəklini yüklə. 4. Admin yoxladıqdan sonra
              balansın yenilənəcək.
            </p>
          </>
        ) : (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-500/30">
            Köçürmə kartı hələ təyin olunmayıb. Adminə müraciət et.
          </p>
        )}
      </div>

      <form
        onSubmit={submit}
        className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
      >
        <div>
          <label className="block text-sm font-medium text-zinc-200">
            Məbləğ (AZN)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {[10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  amount === preset
                    ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-200"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                {preset} AZN
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-200">
            Qəbz (PNG, JPEG, WEBP, PDF — max 5 MB)
          </label>
          <label className="mt-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-zinc-700 bg-zinc-950 px-3 py-3 text-sm hover:border-indigo-500/60">
            <span className="flex items-center gap-2 text-zinc-300">
              <Upload className="h-4 w-4 text-indigo-400" />
              {file ? file.name : "Şəkil və ya PDF seç"}
            </span>
            {file && (
              <span className="text-xs text-zinc-500">
                {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={busy || !card}
          className="inline-flex w-full items-center justify-center rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy ? "Göndərilir…" : `${amount} AZN üçün sorğu göndər`}
        </button>

        {message && (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              message.ok
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-red-500/10 text-red-300"
            }`}
          >
            {message.text}
          </p>
        )}
      </form>

      {info && info.requests.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
          <header className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3">
            <ReceiptIcon className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold">Sorğularım</h2>
          </header>
          <ul className="divide-y divide-zinc-800">
            {info.requests.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {(r.amountAznCents / 100).toFixed(2)} AZN
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(r.createdAt).toLocaleString("az-AZ")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.receiptUrl && (
                    <a
                      href={r.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Qəbzə bax →
                    </a>
                  )}
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: DepositRequest["status"] }) {
  if (status === "SUCCESS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="h-3 w-3" /> Təsdiqləndi
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-rose-500/30">
        <XCircle className="h-3 w-3" /> Rədd edildi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/30">
      <Clock className="h-3 w-3" /> Gözləyir
    </span>
  );
}

