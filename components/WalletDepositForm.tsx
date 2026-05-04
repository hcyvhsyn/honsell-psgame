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
import { getSupabaseBrowser } from "@/lib/supabase-browser";

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
  const [amount, setAmount] = useState("20");
  const amountNum = Number(amount.replace(",", "."));
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
    if (!Number.isFinite(amountNum) || amountNum < 1) {
      setMessage({ ok: false, text: "Məbləğ ən azı 1 AZN olmalıdır." });
      return;
    }
    if (!file) {
      setMessage({ ok: false, text: "Qəbz şəklini seç." });
      return;
    }
    if (file.size === 0) {
      setMessage({ ok: false, text: "Boş fayl seçilib." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ ok: false, text: "Fayl çox böyükdür (max 5 MB)." });
      return;
    }
    setBusy(true);
    setMessage(null);

    // 1) Create a signed upload URL on our server (small JSON → no 413)
    const init = await fetch("/api/wallet/receipt-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type }),
    });
    const initData = await init.json().catch(() => ({}));
    if (!init.ok) {
      setBusy(false);
      setMessage({ ok: false, text: initData.error ?? "Upload hazırlanmadı." });
      return;
    }

    // 2) Upload directly to Supabase (bypasses Vercel body limit)
    try {
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(initData.bucket)
        .uploadToSignedUrl(initData.path, initData.token, file);
      if (upErr) {
        setBusy(false);
        setMessage({ ok: false, text: `Upload alınmadı: ${upErr.message}` });
        return;
      }
    } catch {
      setBusy(false);
      setMessage({ ok: false, text: "Upload alınmadı." });
      return;
    }

    // 3) Create deposit request (small JSON)
    const res = await fetch("/api/wallet/request-deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountAzn: amountNum, receiptPath: initData.path }),
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
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(",", ".");
              if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) {
                setAmount(v);
              }
            }}
            placeholder="0.00"
            className="mt-1.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {[10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  amountNum === preset
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
          {busy
            ? "Göndərilir…"
            : `${Number.isFinite(amountNum) && amountNum > 0 ? amountNum.toFixed(2) : "0.00"} AZN üçün sorğu göndər`}
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

      {info && (
        <DepositHistory requests={info.requests} />
      )}
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
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/60 via-zinc-900/30 to-zinc-950">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30">
            <ReceiptIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Köçürmə tarixçəsi</h2>
            <p className="text-[11px] text-zinc-500">
              Bütün balans yükləmə sorğuların və admin cavabları
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          {counts.pending > 0 && (
            <CountChip
              tone="amber"
              icon={<Clock className="h-3 w-3" />}
              count={counts.pending}
              label="gözləyir"
            />
          )}
          {counts.success > 0 && (
            <CountChip
              tone="emerald"
              icon={<CheckCircle2 className="h-3 w-3" />}
              count={counts.success}
              label="təsdiqləndi"
            />
          )}
          {counts.failed > 0 && (
            <CountChip
              tone="rose"
              icon={<XCircle className="h-3 w-3" />}
              count={counts.failed}
              label="rədd"
            />
          )}
        </div>
      </header>

      {requests.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <ReceiptIcon className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-3 text-sm text-zinc-400">Hələ sorğu göndərməmisən.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Yuxarıdan ilk sorğunu göndər — admin cavabı burada görünəcək.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800">
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
    req.status === "SUCCESS"
      ? "emerald"
      : req.status === "FAILED"
        ? "rose"
        : "amber";

  const Icon =
    req.status === "SUCCESS"
      ? CheckCircle2
      : req.status === "FAILED"
        ? XCircle
        : Clock;

  const heading =
    req.status === "SUCCESS"
      ? "Təsdiqləndi — balansın artırıldı"
      : req.status === "FAILED"
        ? "Rədd edildi"
        : "Admin yoxlayır";

  const detail =
    req.status === "SUCCESS"
      ? "Köçürmə təsdiqləndi və balansın yeniləndi."
      : req.status === "FAILED"
        ? "Qəbz təsdiqlənmədi. Düzgün məbləğdə yenidən köçürmə et və qəbzi yenidən yüklə."
        : "Admin qəbzini yoxlayır. Adətən bir neçə dəqiqədən bir saatadək çəkir.";

  const toneClasses = {
    amber: {
      iconBg: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
      bar: "from-amber-500 to-orange-400",
      pill: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    },
    emerald: {
      iconBg: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
      bar: "from-emerald-500 to-teal-400",
      pill: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    },
    rose: {
      iconBg: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
      bar: "from-rose-500 to-pink-500",
      pill: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    },
  }[tone];

  return (
    <li className="relative flex gap-4 px-5 py-4">
      <div className={`absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b ${toneClasses.bar}`} />

      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ${toneClasses.iconBg}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold tabular-nums text-white">
            {(req.amountAznCents / 100).toFixed(2)} AZN
          </span>
          <span className="text-[11px] text-zinc-500">
            {new Date(req.createdAt).toLocaleString("az-AZ", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-sm text-zinc-200">{heading}</p>
        <p className="text-xs text-zinc-500">{detail}</p>

        {req.receiptUrl && (
          <a
            href={req.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300"
          >
            Yüklədiyim qəbzə bax →
          </a>
        )}
      </div>

      <span
        className={`hidden h-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 sm:inline-flex ${toneClasses.pill}`}
      >
        <Icon className="h-3 w-3" />
        {req.status === "SUCCESS"
          ? "Təsdiqləndi"
          : req.status === "FAILED"
            ? "Rədd edildi"
            : "Gözləyir"}
      </span>
    </li>
  );
}

function CountChip({
  tone,
  icon,
  count,
  label,
}: {
  tone: "amber" | "emerald" | "rose";
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
      : tone === "emerald"
        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
        : "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${cls}`}
    >
      {icon}
      <span className="font-bold tabular-nums">{count}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

