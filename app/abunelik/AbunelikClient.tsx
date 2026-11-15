"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Eye, EyeOff, Loader2, LogOut, RefreshCw } from "lucide-react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

type Option = { months: number; priceAzn: number; newEndDate: string };
type Item = {
  ref: string;
  kind: "SLOT" | "FAMILY" | "SI" | "NI" | "PS" | "STREAMING" | "LINKEDIN";
  category: string;
  title: string;
  subtitle: string | null;
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "PENDING";
  endDate: string | null;
  daysLeft: number | null;
  credentials: { email?: string; password?: string; profile?: string; pin?: string; plan?: string } | null;
  renewal: { mode: "INSTANT" | "ASYNC" | "MANUAL"; options: Option[] } | null;
  blockedReason: string | null;
};
type Renewal = {
  id: string;
  paymentTransactionId: string;
  orderCode: string;
  ref: string;
  title: string;
  months: number;
  amountAznCents: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  crmStatus: string | null;
  resultEndDate: string | null;
  createdAt: string;
};
type ListData = {
  phone: string;
  customerName: string | null;
  firstName: string | null;
  items: Item[];
  renewals: Renewal[];
  account: { name: string | null; email: string } | null;
};

const card = "rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#111116] sm:p-5";
const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-white/10 dark:bg-zinc-900";
const primaryBtn =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60";

/** dd.mm.yyyy (Asia/Baku, UTC+4). `toLocaleDateString("az-AZ")` brauzerdən asılı olaraq ISO formatı verir. */
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const d = new Date(t + 4 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function monthsLabel(m: number) {
  return m === 12 ? "1 il" : `${m} ay`;
}

function statusBadge(item: Item): { text: string; cls: string } {
  const d = item.daysLeft;
  if (item.status === "PENDING") return { text: "Hazırlanır", cls: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" };
  if (item.status === "EXPIRED")
    return {
      text: d != null && d < 0 ? `${Math.abs(d)} gün əvvəl bitib` : "Bitib",
      cls: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
    };
  if (item.status === "EXPIRING")
    return {
      text: d === 0 ? "Bu gün bitir" : `${d} gün qalıb`,
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    };
  return {
    text: d != null ? `Aktiv · ${d} gün qalıb` : "Aktiv",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  };
}

const MODE_NOTE: Record<string, string> = {
  INSTANT: "Ödənişdən dərhal sonra uzanır, təsdiq WhatsApp-a gəlir.",
  ASYNC: "Ödənişdən sonra hesabınız provayderdə yenilənir — adətən 24 saat ərzində, təsdiq WhatsApp-a gəlir.",
  MANUAL: "Ödənişdən sonra 24 saat ərzində yenilənir, təsdiq WhatsApp-a gəlir.",
};

const BLOCKED_NOTE: Record<string, string> = {
  OPEN_RENEWAL: "Yeniləmə emal olunur…",
  PENDING: "Hazırlanır — hazır olan kimi WhatsApp-a xəbər gələcək.",
  NO_PRICE: "Bu abunəliyi yeniləmək üçün bizə WhatsApp-da yazın.",
  NOT_RENEWABLE: "Bu abunəliyi yeniləmək üçün bizə WhatsApp-da yazın.",
};

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-white/5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="truncate font-mono text-sm">{shown ? value : "••••••••"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {secret && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/10"
            aria-label={shown ? "Gizlət" : "Göstər"}
          >
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/10"
          aria-label="Kopyala"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SubscriptionCard({
  item,
  openRenewal,
  onPay,
  paying,
}: {
  item: Item;
  openRenewal: Renewal | null;
  onPay: (item: Item, option: Option) => void;
  paying: boolean;
}) {
  const options = useMemo(() => item.renewal?.options ?? [], [item.renewal?.options]);
  const [selected, setSelected] = useState<number | null>(options[0]?.months ?? null);
  const [showCreds, setShowCreds] = useState(false);
  useEffect(() => {
    if (selected != null && !options.some((o) => o.months === selected)) setSelected(options[0]?.months ?? null);
  }, [options, selected]);
  const option = options.find((o) => o.months === selected) ?? null;
  const badge = statusBadge(item);
  const creds = item.credentials;
  const hasCreds = !!creds && Object.values(creds).some(Boolean);
  const blocked = openRenewal ? "OPEN_RENEWAL" : item.blockedReason;
  const canRenew = !blocked && options.length > 0;

  return (
    <article className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-tight">{item.title}</h3>
          {item.subtitle && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{item.subtitle}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>{badge.text}</span>
      </div>
      {item.endDate && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Bitmə tarixi: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{fmtDate(item.endDate)}</span>
        </p>
      )}

      {hasCreds && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCreds((v) => !v)}
            className="text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300"
          >
            {showCreds ? "Giriş məlumatlarını gizlət" : "Giriş məlumatlarını göstər"}
          </button>
          {showCreds && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {creds!.email && <CopyField label="E-poçt" value={creds!.email} />}
              {creds!.password && <CopyField label="Şifrə" value={creds!.password} secret />}
              {creds!.profile && <CopyField label="Profil" value={creds!.profile} />}
              {creds!.pin && <CopyField label="PIN" value={creds!.pin} secret />}
              {creds!.plan && <CopyField label="Plan" value={creds!.plan} />}
              {item.kind === "SLOT" && !creds!.password && (
                <p className="text-xs text-zinc-500 sm:col-span-2">Yeni şifrə yeniləmədən sonra WhatsApp-a göndəriləcək.</p>
              )}
            </div>
          )}
        </div>
      )}

      {item.renewal && (
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-white/5">
          {openRenewal ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Yeniləmə emal olunur ({openRenewal.orderCode})
            </p>
          ) : canRenew ? (
            <>
              <p className="mb-2 text-sm font-semibold">Yenilə</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {options.map((o) => {
                  const active = o.months === selected;
                  return (
                    <button
                      key={o.months}
                      type="button"
                      onClick={() => setSelected(o.months)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-violet-600 bg-violet-50 ring-1 ring-violet-600 dark:bg-violet-500/10"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-white/10"
                      }`}
                    >
                      <span className="block text-sm font-bold">{monthsLabel(o.months)}</span>
                      <span className="block text-sm">{o.priceAzn.toFixed(2)} ₼</span>
                      <span className="block text-[11px] text-zinc-500">→ {fmtDate(o.newEndDate)}</span>
                    </button>
                  );
                })}
              </div>
              {item.renewal.mode && <p className="mt-2 text-xs text-zinc-500">{MODE_NOTE[item.renewal.mode]}</p>}
              <button
                type="button"
                disabled={!option || paying}
                onClick={() => option && onPay(item, option)}
                className={`${primaryBtn} mt-3`}
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {option ? `${option.priceAzn.toFixed(2)} ₼ kartla ödə` : "Müddət seçin"}
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-500">{BLOCKED_NOTE[blocked ?? "NOT_RENEWABLE"] ?? BLOCKED_NOTE.NOT_RENEWABLE}</p>
          )}
        </div>
      )}
    </article>
  );
}

export default function AbunelikClient({ initialVerified }: { initialVerified: boolean }) {
  const [phase, setPhase] = useState<"phone" | "code" | "list">(initialVerified ? "list" : "phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [accountState, setAccountState] = useState<"session" | "linked" | "none" | "ambiguous" | null>(null);

  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(false);
  const [payingRef, setPayingRef] = useState<string | null>(null);
  const [needAccount, setNeedAccount] = useState<{ item: Item; option: Option } | null>(null);
  const [accName, setAccName] = useState("");
  const [accEmail, setAccEmail] = useState("");
  const [accError, setAccError] = useState<string | null>(null);
  const [accLoginUrl, setAccLoginUrl] = useState<string | null>(null);
  const [payBanner, setPayBanner] = useState<{ kind: "ok" | "err" | "done"; text: string; txId?: string } | null>(null);
  const pollRef = useRef(0);

  // Ödənişdən qayıdış: ?odenis=ugurlu|xeta&o=<txId>
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const odenis = sp.get("odenis");
    const tx = sp.get("o") || undefined;
    if (odenis === "ugurlu") setPayBanner({ kind: "ok", text: "Ödəniş qəbul edildi — yeniləmə emal olunur…", txId: tx });
    else if (odenis === "xeta") setPayBanner({ kind: "err", text: "Ödəniş alınmadı. Kartdan pul tutulmayıbsa yenidən cəhd edin." });
    if (odenis) window.history.replaceState(null, "", "/abunelik");
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/abunelik/subscriptions", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        setPhase("phone");
        setData(null);
        return null;
      }
      if (!res.ok) {
        setError(json?.error || "Abunəliklər yüklənmədi.");
        return null;
      }
      setError(null);
      setData(json as ListData);
      return json as ListData;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (phase === "list") void load();
  }, [phase, load]);

  // Ödənişdən sonra nəticəni izlə (5 san., ən çox 12 dəfə)
  useEffect(() => {
    if (phase !== "list" || payBanner?.kind !== "ok" || !payBanner.txId) return;
    pollRef.current = 0;
    const iv = setInterval(async () => {
      pollRef.current += 1;
      const d = await load(true);
      const r = d?.renewals.find((x) => x.paymentTransactionId === payBanner.txId);
      if (r && r.status !== "PENDING") {
        clearInterval(iv);
        setPayBanner(
          r.status === "SUCCESS"
            ? { kind: "done", text: `${r.title} yeniləndi${r.resultEndDate ? ` — yeni bitmə tarixi ${fmtDate(r.resultEndDate)}` : ""}. Təsdiq WhatsApp-a göndərildi.` }
            : { kind: "err", text: "Yeniləmə alınmadı — komandamız sizinlə əlaqə saxlayacaq, ödəniş geri qaytarılacaq." },
        );
      } else if (r && pollRef.current >= 3 && r.crmStatus && r.crmStatus !== "PROCESSING") {
        clearInterval(iv);
        setPayBanner({ kind: "done", text: "Ödəniş qəbul edildi. Yeniləmə hazır olan kimi WhatsApp-a təsdiq gələcək." });
      } else if (pollRef.current >= 12) {
        clearInterval(iv);
        setPayBanner({ kind: "done", text: "Ödəniş qəbul edildi. Yeniləmə hazır olan kimi WhatsApp-a təsdiq gələcək." });
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [phase, payBanner?.kind, payBanner?.txId, load]);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/abunelik/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, turnstileToken: captcha }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "Kod göndərilmədi.");
        if (json?.retryAfterSeconds) setResendIn(json.retryAfterSeconds);
        return;
      }
      setResendIn(json?.resendInSeconds ?? 45);
      setInfo("Nömrə sistemimizdə qeydiyyatdadırsa, WhatsApp-a 6 rəqəmli kod göndərildi.");
      setPhase("code");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/abunelik/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "Kod yanlışdır.");
        return;
      }
      setAccountState(json?.account ?? null);
      setInfo(null);
      setCode("");
      setPhase("list");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/abunelik/logout", { method: "POST" }).catch(() => {});
    setData(null);
    setPhase("phone");
  };

  const startPayment = useCallback(
    async (item: Item, option: Option) => {
      setPayingRef(item.ref);
      setError(null);
      try {
        const res = await fetch("/api/abunelik/renew", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref: item.ref, months: option.months, expectedPriceAzn: option.priceAzn }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.redirectUrl) {
          window.location.href = json.redirectUrl;
          return;
        }
        if (json?.code === "NEEDS_ACCOUNT") {
          setAccName(data?.customerName ?? "");
          setAccError(null);
          setAccLoginUrl(null);
          setNeedAccount({ item, option });
          return;
        }
        if (json?.code === "PHONE_SESSION") {
          setPhase("phone");
          return;
        }
        setError(json?.error || "Ödəniş başlamadı. Yenidən cəhd edin.");
        if (json?.code === "PRICE_CHANGED" || json?.code === "OPEN_RENEWAL" || json?.code === "MONTHS_UNAVAILABLE") {
          void load(true);
        }
      } finally {
        setPayingRef(null);
      }
    },
    [data?.customerName, load],
  );

  const createAccount = async () => {
    if (!needAccount) return;
    setBusy(true);
    setAccError(null);
    try {
      const res = await fetch("/api/abunelik/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: accName, email: accEmail }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setAccError(json?.error || "Hesab yaradılmadı.");
        setAccLoginUrl(json?.loginUrl ?? null);
        return;
      }
      const pending = needAccount;
      setNeedAccount(null);
      await startPayment(pending.item, pending.option);
    } finally {
      setBusy(false);
    }
  };

  const openByRef = useMemo(() => {
    const m = new Map<string, Renewal>();
    for (const r of data?.renewals ?? []) if (r.status === "PENDING" && !m.has(r.ref)) m.set(r.ref, r);
    return m;
  }, [data?.renewals]);

  // ── Giriş ekranları ──
  if (phase !== "list") {
    return (
      <div className={`${card} mx-auto max-w-md`}>
        <h1 className="text-xl font-bold">Abunəliklərim</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Netflix, Spotify, YouTube, PS Plus abunəliklərinizi görün, giriş məlumatlarınıza baxın və onlayn yeniləyin.
        </p>
        {phase === "phone" ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <label className="block text-sm font-semibold" htmlFor="abunelik-phone">
              WhatsApp nömrəniz
            </label>
            <input
              id="abunelik-phone"
              className={input}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="050 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <TurnstileWidget onToken={setCaptcha} action="abunelik" />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 9} className={primaryBtn}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Kod göndər
            </button>
            <p className="text-xs text-zinc-500">Kod bizimlə yazışdığınız WhatsApp nömrəsinə gələcək.</p>
          </form>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode();
            }}
          >
            {info && <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800 dark:bg-violet-500/10 dark:text-violet-200">{info}</p>}
            <label className="block text-sm font-semibold" htmlFor="abunelik-code">
              6 rəqəmli kod
            </label>
            <input
              id="abunelik-code"
              className={`${input} text-center font-mono text-2xl tracking-[0.4em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Daxil ol
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="font-semibold text-zinc-600 hover:underline dark:text-zinc-300"
                onClick={() => {
                  setPhase("phone");
                  setError(null);
                }}
              >
                Nömrəni dəyiş
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                onClick={() => void sendCode()}
                className="font-semibold text-violet-700 hover:underline disabled:text-zinc-400 disabled:no-underline dark:text-violet-300"
              >
                {resendIn > 0 ? `Yenidən göndər (${resendIn})` : "Kodu yenidən göndər"}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ── Siyahı ──
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data?.firstName ? `Salam, ${data.firstName}` : "Abunəliklərim"}</h1>
          {data?.phone && <p className="text-sm text-zinc-500">{data.phone}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-semibold dark:border-white/10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Yenilə
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-semibold dark:border-white/10"
          >
            <LogOut className="h-4 w-4" /> Çıxış
          </button>
        </div>
      </div>

      {payBanner && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            payBanner.kind === "err"
              ? "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
          }`}
        >
          {payBanner.kind === "ok" && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
          {payBanner.text}
        </div>
      )}
      {accountState === "ambiguous" && !data?.account && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Bu nömrəyə bir neçə sayt hesabı bağlıdır. Ödəniş üçün{" "}
          <Link href="/login?next=/abunelik" className="font-bold underline">
            hesabınıza daxil olun
          </Link>
          .
        </p>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

      {loading && !data ? (
        <div className={`${card} flex items-center justify-center gap-2 py-10 text-sm text-zinc-500`}>
          <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
        </div>
      ) : data && data.items.length === 0 ? (
        <div className={`${card} text-center`}>
          <p className="font-semibold">Aktiv abunəlik tapılmadı</p>
          <p className="mt-1 text-sm text-zinc-500">
            Yeni abunəlik üçün{" "}
            <Link href="/streaming/netflix" className="font-semibold text-violet-700 underline dark:text-violet-300">
              Netflix
            </Link>{" "}
            və ya{" "}
            <Link href="/music" className="font-semibold text-violet-700 underline dark:text-violet-300">
              Spotify
            </Link>{" "}
            səhifəsinə baxın.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((item) => (
            <SubscriptionCard
              key={item.ref}
              item={item}
              openRenewal={openByRef.get(item.ref) ?? null}
              onPay={startPayment}
              paying={payingRef === item.ref}
            />
          ))}
        </div>
      )}

      {data?.account && (
        <p className="text-center text-xs text-zinc-500">
          Ödənişlər <span className="font-semibold">{data.account.email}</span> hesabına yazılır ·{" "}
          <Link href="/profile/orders" className="underline">
            Sifarişlər
          </Link>
        </p>
      )}

      {needAccount && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className={`${card} w-full max-w-md`}>
            <h2 className="text-lg font-bold">Ödəniş üçün hesab</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Qəbz və sifariş tarixçəsi üçün adınızı və e-poçtunuzu yazın. Şifrə təyin etmə linki e-poçtunuza gələcək.
            </p>
            <div className="mt-4 space-y-3">
              <input className={input} placeholder="Ad Soyad" value={accName} onChange={(e) => setAccName(e.target.value)} autoComplete="name" />
              <input
                className={input}
                type="email"
                placeholder="E-poçt"
                value={accEmail}
                onChange={(e) => setAccEmail(e.target.value)}
                autoComplete="email"
              />
              {accError && (
                <p className="text-sm text-rose-600">
                  {accError}{" "}
                  {accLoginUrl && (
                    <Link href={accLoginUrl} className="font-bold underline">
                      Daxil ol
                    </Link>
                  )}
                </p>
              )}
              <button type="button" disabled={busy} onClick={() => void createAccount()} className={primaryBtn}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Davam et və ödə
              </button>
              <div className="flex items-center justify-between text-sm">
                <Link href="/login?next=/abunelik" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
                  Hesabım var
                </Link>
                <button type="button" onClick={() => setNeedAccount(null)} className="font-semibold text-zinc-500 hover:underline">
                  Ləğv et
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
