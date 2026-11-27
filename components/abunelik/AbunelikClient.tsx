"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, ChevronDown, Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw } from "lucide-react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { renewalCharge } from "@/lib/abunelik/charge";
import { CART_SERVICE_FEE_PCT } from "@/lib/cartServiceFee";
import { DaysLeft, SubBrandIcon, subBrandOf, type DaysTone } from "@/components/profile/subscriptionUi";

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
};

// Kart qabığı navbar-ın çərçivə + bənövşəyi kölgəsidir (globals.css `honsell-glow-card`, 2026-11 —
// əvvəl `border-white/5` idi və kart fonda itirdi). Fon/çərçivə üçün buraya `bg-*`/`border-*` YAZMA.
const card = "honsell-glow-card rounded-3xl p-4 sm:p-5";
const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-white/10 dark:bg-zinc-900";
const primaryBtn =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3.5 text-sm font-black text-white shadow-[0_14px_34px_-16px_rgba(124,58,237,0.9)] transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60";

/** dd.mm.yyyy (Asia/Baku, UTC+4). `toLocaleDateString("az-AZ")` brauzerdən asılı olaraq ISO formatı verir. */
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const d = new Date(t + 4 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

const fmtCents = (c: number) => `${(c / 100).toFixed(2)}\u00a0₼`;

function monthsLabel(m: number) {
  return m === 12 ? "1 il" : `${m} ay`;
}

/** Kartın sağındakı iri göstərici (CRM statusu + qalan gün). */
function daysOf(item: Item): { value: string | null; label: string; tone: DaysTone } {
  const d = item.daysLeft;
  if (item.status === "PENDING") return { value: null, label: "Hazırlanır", tone: "wait" };
  if (item.status === "EXPIRED")
    return d != null && d < 0
      ? { value: String(Math.abs(d)), label: "gün əvvəl bitib", tone: "over" }
      : { value: null, label: "Bitib", tone: "over" };
  if (d === 0) return { value: null, label: "Bu gün bitir", tone: "soon" };
  if (d == null) return { value: null, label: "Aktiv", tone: "ok" };
  return { value: String(d), label: "gün qalıb", tone: item.status === "EXPIRING" ? "soon" : "ok" };
}

/** CRM `subtitle`-ı tək başına anlaşılmırdı ("Rasulovaasmer.") — nə olduğunu yazırıq. */
const SUBTITLE_LABEL: Partial<Record<Item["kind"], string>> = {
  SLOT: "Otaq",
  FAMILY: "Üzv",
  PS: "Hesab",
};

/** Ödəniş düyməsinin altındakı bir sətir (təsdiqin WhatsApp-a gəldiyi ödənişdən sonra banner-da yazılır). */
const MODE_NOTE: Record<string, string> = {
  INSTANT: "dərhal uzanır",
  ASYNC: "24 saat ərzində uzanır",
  MANUAL: "24 saat ərzində uzanır",
};

/** 1 aylığa nisbətən qənaət (%) — mağaza vitrini ilə eyni hesab; 1 aylıq yoxdursa göstərilmir. */
function savingPct(options: Option[], o: Option): number {
  const one = options.find((x) => x.months === 1);
  if (!one || o.months <= 1) return 0;
  const full = one.priceAzn * o.months;
  return full > 0 ? Math.max(0, Math.round((1 - o.priceAzn / full) * 100)) : 0;
}

const BLOCKED_NOTE: Record<string, string> = {
  OPEN_RENEWAL: "Uzadılır…",
  PENDING: "Hazırlanır — hazır olan kimi WhatsApp-a xəbər gələcək.",
  NO_PRICE: "Bu abunəliyi yeniləmək üçün bizə WhatsApp-da yaz.",
  NOT_RENEWABLE: "Bu abunəliyi yeniləmək üçün bizə WhatsApp-da yaz.",
};

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-100 px-3 py-2 dark:bg-white/[0.06]">
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="truncate font-mono text-sm font-semibold text-zinc-900 dark:text-white">{shown ? value : "••••••••"}</p>
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
  // Server (/api/abunelik/renew) eyni funksiya ilə hesablayır — düymədəki məbləğ kartdan tutulanla üst-üstə düşür.
  const charge = option ? renewalCharge(option.priceAzn) : null;
  const creds = item.credentials;
  const hasCreds = !!creds && Object.values(creds).some(Boolean);
  const blocked = openRenewal ? "OPEN_RENEWAL" : item.blockedReason;
  const canRenew = !blocked && options.length > 0;
  const subtitleLabel = SUBTITLE_LABEL[item.kind];

  return (
    <article className={card}>
      <div className="flex items-start gap-3">
        <SubBrandIcon brand={subBrandOf(item.title, item.category)} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black leading-tight text-zinc-900 dark:text-white sm:text-lg">{item.title}</h3>
          {item.subtitle && (
            <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
              {subtitleLabel ? `${subtitleLabel}: ` : ""}
              {item.subtitle}
            </p>
          )}
          {item.endDate && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
              {item.status === "EXPIRED" ? "Bitib" : "Bitir"}:
              <span className="font-bold text-zinc-900 dark:text-white">{fmtDate(item.endDate)}</span>
            </p>
          )}
        </div>
        <DaysLeft {...daysOf(item)} />
      </div>

      {hasCreds && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowCreds((v) => !v)}
            aria-expanded={showCreds}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-800 transition hover:border-violet-400/60 dark:border-white/10 dark:text-zinc-100"
          >
            <KeyRound className="h-4 w-4 text-violet-600 dark:text-violet-300" aria-hidden />
            Giriş məlumatları
            <ChevronDown className={`h-4 w-4 transition ${showCreds ? "rotate-180" : ""}`} aria-hidden />
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
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-white/10">
          {openRenewal ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Uzadılır… ({openRenewal.orderCode})
            </p>
          ) : canRenew ? (
            <>
              {/* "Uzat" — "Yenilə" siyahını yeniləyən düymə ilə qarışırdı. */}
              <p className="text-sm font-black text-zinc-900 dark:text-white">Uzat</p>
              <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {options.map((o) => {
                  const active = o.months === selected;
                  const saving = savingPct(options, o);
                  return (
                    <button
                      key={o.months}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(o.months)}
                      className={`relative rounded-xl border px-2 py-2.5 text-center transition ${
                        active
                          ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500"
                          : "border-zinc-200 hover:border-violet-400/50 dark:border-white/10"
                      }`}
                    >
                      {saving > 0 && (
                        <span className="absolute -top-2 right-1.5 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-white">
                          −{saving}%
                        </span>
                      )}
                      <span className="block text-sm font-black text-zinc-900 dark:text-white">{monthsLabel(o.months)}</span>
                      <span className="mt-0.5 block text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
                        {o.priceAzn.toFixed(2)} ₼
                      </span>
                    </button>
                  );
                })}
              </div>
              {option && (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Yeni bitmə tarixi: <span className="font-bold text-zinc-900 dark:text-white">{fmtDate(option.newEndDate)}</span>
                </p>
              )}
              <button
                type="button"
                disabled={!option || paying}
                onClick={() => option && onPay(item, option)}
                className={`${primaryBtn} mt-3`}
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {charge ? `${fmtCents(charge.chargeCents)} kartla ödə` : "Müddət seç"}
              </button>
              {/* Xidmət haqqı ödənişdən ƏVVƏL görünməlidir (CLAUDE.md) — 3 sətirlik cədvəl əvəzinə bir sətir. */}
              {charge && (
                <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  {fmtCents(charge.priceCents)} + {fmtCents(charge.serviceFeeCents)} xidmət haqqı ({CART_SERVICE_FEE_PCT}%)
                  {item.renewal.mode ? ` · ${MODE_NOTE[item.renewal.mode]}` : ""}
                </p>
              )}
              {charge && charge.topUpCents > 0 && (
                <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  Kartdan minimum {fmtCents(charge.chargeCents)} tutulur — {fmtCents(charge.topUpCents)} balansına qayıdır.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {BLOCKED_NOTE[blocked ?? "NOT_RENEWABLE"] ?? BLOCKED_NOTE.NOT_RENEWABLE}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * `mode="profile"` — /profile/abunelikler: daxil olmuş istifadəçinin CRM abunəlikləri; nömrəsi təsdiqlənməyibsə
 *   (və ya müddəti keçibsə) əvvəlcə WhatsApp kodu ilə ÖZ hesabına bağlayır (`attach`).
 * `mode="login"` — /abunelik: nömrə + WhatsApp kodu ilə sayta giriş, sonra profilə keçid. Data göstərmir.
 */
export default function AbunelikClient({
  mode,
  initialVerified,
  defaultPhone = "",
}: {
  mode: "profile" | "login";
  initialVerified: boolean;
  defaultPhone?: string;
}) {
  const isProfile = mode === "profile";
  const [phase, setPhase] = useState<"phone" | "code" | "list">(isProfile && initialVerified ? "list" : "phone");
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [ambiguous, setAmbiguous] = useState(false);

  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(false);
  const [payingRef, setPayingRef] = useState<string | null>(null);
  const [payBanner, setPayBanner] = useState<{ kind: "ok" | "err" | "done"; text: string; txId?: string } | null>(null);
  const pollRef = useRef(0);

  // Ödənişdən qayıdış: ?odenis=ugurlu|xeta&o=<txId>
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const odenis = sp.get("odenis");
    const tx = sp.get("o") || undefined;
    if (odenis === "ugurlu") setPayBanner({ kind: "ok", text: "Ödəniş qəbul edildi — yeniləmə emal olunur…", txId: tx });
    else if (odenis === "xeta") setPayBanner({ kind: "err", text: "Ödəniş alınmadı. Kartdan pul tutulmayıbsa yenidən cəhd et." });
    // WhatsApp birbaşa giriş linkindən qayıdış (/abunelik/giris)
    if (sp.get("link") === "kohne") setError("Giriş linkinin vaxtı keçib. Nömrəni yazıb WhatsApp kodu ilə daxil ol.");
    if (sp.get("giris") === "coxlu") setAmbiguous(true);
    if (odenis || sp.get("link") || sp.get("giris")) window.history.replaceState(null, "", window.location.pathname);
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
        body: JSON.stringify({ phone, code, attach: isProfile }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "Kod yanlışdır.");
        return;
      }
      if (!isProfile) {
        // Sayta daxil olundu → hər şey profildədir
        window.location.href = typeof json?.redirect === "string" ? json.redirect : "/profile/abunelikler";
        return;
      }
      setInfo(null);
      setCode("");
      setPhase("list");
    } finally {
      setBusy(false);
    }
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
        if (json?.code === "PHONE_UNVERIFIED") {
          setPhase("phone");
          return;
        }
        setError(json?.error || "Ödəniş başlamadı. Yenidən cəhd et.");
        if (json?.code === "PRICE_CHANGED" || json?.code === "OPEN_RENEWAL" || json?.code === "MONTHS_UNAVAILABLE") {
          void load(true);
        }
      } finally {
        setPayingRef(null);
      }
    },
    [load],
  );

  const openByRef = useMemo(() => {
    const m = new Map<string, Renewal>();
    for (const r of data?.renewals ?? []) if (r.status === "PENDING" && !m.has(r.ref)) m.set(r.ref, r);
    return m;
  }, [data?.renewals]);

  // ── Giriş ekranları ──
  if (phase !== "list") {
    return (
      // Profildə bu, "Abunəliklərim" səhifəsinin bölməsidir (h2, tam en); /abunelik girişində mərkəzi kart (h1).
      <div className={isProfile ? `${card} max-w-xl` : `${card} mx-auto max-w-md`}>
        {isProfile ? (
          <h2 className="text-lg font-bold">WhatsApp ilə aldığın abunəliklər</h2>
        ) : (
          <h1 className="text-xl font-bold">Nömrə ilə daxil ol</h1>
        )}
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {isProfile
            ? "Görmək və uzatmaq üçün WhatsApp nömrəni kodla təsdiqlə."
            : "WhatsApp nömrənə gələn kodla honsell.site hesabına daxil ol — abunəliklərin, giriş məlumatların və onlayn yeniləmə profilindədir."}
        </p>
        {!isProfile && ambiguous && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Bu nömrəyə bir neçə hesab bağlıdır.{" "}
            <Link href="/login?next=/profile/abunelikler" className="font-bold underline">
              E-poçt və şifrə ilə daxil ol
            </Link>
            , sonra profildə nömrəni təsdiqlə.
          </p>
        )}
        {phase === "phone" ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
          >
            <label className="block text-sm font-semibold" htmlFor="abunelik-phone">
              WhatsApp nömrən
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
            <p className="text-xs text-zinc-500">Kod bizimlə yazışdığın WhatsApp nömrəsinə gələcək.</p>
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
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {isProfile ? "Təsdiqlə" : "Daxil ol"}
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
      {/* Profildə ayrıca başlıq yoxdur — kartlar səhifənin "Abunəliklərim" siyahısının davamıdır. */}
      {isProfile ? (
        <h2 className="sr-only">WhatsApp ilə aldığın abunəliklər</h2>
      ) : (
        <h1 className="text-2xl font-bold">{data?.firstName ? `Salam, ${data.firstName}` : "Abunəliklərim"}</h1>
      )}

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
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

      {loading && !data ? (
        <div className={`${card} flex items-center justify-center gap-2 py-10 text-sm text-zinc-500`}>
          <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
        </div>
      ) : data && data.items.length === 0 ? (
        <div className={`${card} text-center`}>
          <p className="font-black text-zinc-900 dark:text-white">WhatsApp ilə aldığın abunəlik yoxdur</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link
              href="/streaming/netflix"
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-800 transition hover:border-violet-400/60 dark:border-white/10 dark:text-zinc-100"
            >
              Netflix
            </Link>
            <Link
              href="/music/spotify-premium"
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-800 transition hover:border-violet-400/60 dark:border-white/10 dark:text-zinc-100"
            >
              Spotify
            </Link>
          </div>
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

      {/* Nömrə + siyahını təzələ + nömrəni dəyiş — əvvəl başlıqda iki düymə idi ("Yenilə" uzatma ilə qarışırdı). */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          WhatsApp nömrən: <span className="font-bold text-zinc-800 dark:text-zinc-200">{data?.phone ?? "—"}</span>
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Siyahını təzələ"
            title="Siyahını təzələ"
            className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPhase("phone");
            }}
            className="rounded-full px-3 py-2 font-bold text-violet-700 transition hover:bg-violet-500/10 dark:text-violet-300"
          >
            Nömrəni dəyiş
          </button>
        </span>
      </div>
    </div>
  );
}
