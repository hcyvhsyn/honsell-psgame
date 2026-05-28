"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Receipt as ReceiptIcon,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import EpointWidgetModal from "./EpointWidgetModal";
import { fmtDateTime } from "@/lib/format";

/**
 * Apple Pay / Google Pay düyməsinin görünməsi.
 * Epoint hesabımızda `/api/1/token/widget` endpoint-inə icazə verildikdən sonra
 * `NEXT_PUBLIC_EPOINT_WIDGET_ENABLED=1` qoyun.
 */
const EPOINT_WIDGET_ENABLED =
  process.env.NEXT_PUBLIC_EPOINT_WIDGET_ENABLED === "1";

type DepositRequest = {
  id: string;
  amountAznCents: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
};

type DepositInfo = {
  requests: DepositRequest[];
};

export default function WalletDepositForm({ authed }: { authed: boolean }) {
  const [info, setInfo] = useState<DepositInfo | null>(null);
  const [amount, setAmount] = useState("20");
  const amountNum = Number(amount.replace(",", "."));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [widget, setWidget] = useState<{
    url: string;
    successUrl: string;
    errorUrl: string;
    brand: "apple" | "google";
  } | null>(null);

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

  async function startEpointDeposit() {
    if (!Number.isFinite(amountNum) || amountNum < 0.01) {
      setMessage({ ok: false, text: "Məbləğ ən azı 0.01 AZN olmalıdır." });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountAzn: amountNum }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || typeof data.redirectUrl !== "string") {
        setMessage({ ok: false, text: data.error ?? "Epoint ödənişi başlamadı." });
        setBusy(false);
        return;
      }

      window.location.href = data.redirectUrl;
    } catch {
      setMessage({ ok: false, text: "Epoint ödənişi başlamadı." });
      setBusy(false);
    }
  }

  async function startWidgetDeposit(brand: "apple" | "google") {
    if (!Number.isFinite(amountNum) || amountNum < 0.01) {
      setMessage({ ok: false, text: "Məbləğ ən azı 0.01 AZN olmalıdır." });
      return;
    }

    const label = brand === "apple" ? "Apple Pay" : "Google Pay";

    setBusy(true);
    setMessage(null);

    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountAzn: amountNum, mode: "widget" }),
      });
      const data = await res.json().catch(() => ({}));

      if (
        !res.ok ||
        typeof data.widgetUrl !== "string" ||
        typeof data.successUrl !== "string" ||
        typeof data.errorUrl !== "string"
      ) {
        setMessage({ ok: false, text: data.error ?? `${label} açıla bilmədi.` });
        setBusy(false);
        return;
      }

      setWidget({
        url: data.widgetUrl,
        successUrl: data.successUrl,
        errorUrl: data.errorUrl,
        brand,
      });
    } catch {
      setMessage({ ok: false, text: `${label} açıla bilmədi.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 via-zinc-900/70 to-zinc-950 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
          <h2 className="text-sm font-semibold text-white">Balansı kartla artır</h2>
        </div>

        <label className="block text-sm font-medium text-zinc-200">Məbləğ (AZN)</label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const v = e.target.value.replace(",", ".");
            if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v);
          }}
          placeholder="0.00"
          className="mt-1.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {[10, 25, 50, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                amountNum === preset
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {preset} AZN
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={startEpointDeposit}
          disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" />
          {busy
            ? "Epoint açılır..."
            : `${Number.isFinite(amountNum) && amountNum > 0 ? amountNum.toFixed(2) : "0.00"} AZN balans artır`}
        </button>

        {EPOINT_WIDGET_ENABLED ? (
          <>
            <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
              <span className="h-px flex-1 bg-zinc-800" />
              <span>və ya</span>
              <span className="h-px flex-1 bg-zinc-800" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => startWidgetDeposit("apple")}
                disabled={busy}
                aria-label="Apple Pay ilə ödə"
                className="inline-flex h-12 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
              >
                <Image
                  src="/apple-pay.png"
                  alt="Apple Pay"
                  width={96}
                  height={40}
                  className="h-10 w-auto object-contain"
                  priority={false}
                />
              </button>
              <button
                type="button"
                onClick={() => startWidgetDeposit("google")}
                disabled={busy}
                aria-label="Google Pay ilə ödə"
                className="inline-flex h-12 w-full items-center justify-center rounded-md border border-zinc-700 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
              >
                <Image
                  src="/google-pay.webp"
                  alt="Google Pay"
                  width={64}
                  height={28}
                  className="h-7 w-auto object-contain"
                  priority={false}
                />
              </button>
            </div>
          </>
        ) : null}

        {message && (
          <p
            className={`mt-4 rounded-md px-3 py-2 text-sm ${
              message.ok
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-red-500/10 text-red-300"
            }`}
          >
            {message.text}
          </p>
        )}
      </section>

      {info ? <DepositHistory requests={info.requests} /> : null}

      {widget ? (
        <EpointWidgetModal
          widgetUrl={widget.url}
          successUrl={widget.successUrl}
          errorUrl={widget.errorUrl}
          title={widget.brand === "apple" ? "Apple Pay" : "Google Pay"}
          onClose={() => setWidget(null)}
        />
      ) : null}
    </div>
  );
}

function DepositHistory({ requests }: { requests: DepositRequest[] }) {
  const counts = {
    pending: requests.filter((r) => r.status === "PENDING").length,
    success: requests.filter((r) => r.status === "SUCCESS").length,
    failed: requests.filter((r) => r.status === "FAILED").length,
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <ReceiptIcon className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-semibold">Balans yükləmə tarixçəsi</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {counts.success > 0 ? (
            <CountChip tone="emerald" count={counts.success} />
          ) : null}
          {counts.pending > 0 ? (
            <CountChip tone="amber" count={counts.pending} />
          ) : null}
          {counts.failed > 0 ? (
            <CountChip tone="rose" count={counts.failed} />
          ) : null}
        </div>
      </header>

      {requests.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-zinc-500">Hələ balans artırma əməliyyatın yoxdur.</p>
        </div>
      ) : (
        <ul className="max-h-[300px] divide-y divide-zinc-800/70 overflow-y-auto">
          {requests.map((r) => (
            <DepositRow key={r.id} req={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DepositRow({ req }: { req: DepositRequest }) {
  const tone =
    req.status === "SUCCESS" ? "emerald" : req.status === "FAILED" ? "rose" : "amber";
  const Icon =
    req.status === "SUCCESS" ? CheckCircle2 : req.status === "FAILED" ? XCircle : Clock;

  const toneClasses = {
    amber: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    rose: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  }[tone];

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ${toneClasses}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
        {(req.amountAznCents / 100).toFixed(2)} ₼
      </span>
      <span className="flex-1 truncate text-[11px] text-zinc-500">
        {fmtDateTime(req.createdAt)}
      </span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${toneClasses}`}>
        {req.status === "SUCCESS" ? "Təsdiqləndi" : req.status === "FAILED" ? "Uğursuz" : "Gözləyir"}
      </span>
    </li>
  );
}

function CountChip({
  tone,
  count,
}: {
  tone: "amber" | "emerald" | "rose";
  count: number;
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
      : tone === "emerald"
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1 ${cls}`}>
      {count}
    </span>
  );
}
