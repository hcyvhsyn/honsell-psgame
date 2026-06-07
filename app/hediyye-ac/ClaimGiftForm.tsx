"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Gamepad2,
  Gift,
  KeyRound,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  PRODUCT_GIFT_CODE_LENGTH,
  formatProductGiftCode,
  normalizeProductGiftCode,
} from "@/lib/productGiftShared";

type PsnOpt = { id: string; label: string; psnEmail: string; isDefault: boolean };
type EpicOpt = { id: string; label: string; epicEmail: string; displayName: string; isDefault: boolean };

type GiftPreview = {
  productKind: string;
  kindLabel: string;
  store: string | null;
  title: string;
  imageUrl: string | null;
  amountAzn: number;
  message: string | null;
  needsAccount: "PSN" | "EPIC" | null;
};

const REASON_TEXT: Record<string, string> = {
  INVALID_FORMAT: "Kod formatı yanlışdır. 11 simvollu kodu yoxlayın.",
  NOT_FOUND: "Belə bir hədiyyə kodu tapılmadı.",
  ALREADY_CLAIMED: "Bu hədiyyə artıq açılıb.",
  EXPIRED: "Bu hədiyyə kodunun vaxtı bitib.",
  NO_PSN_ACCOUNT: "Hədiyyəni almaq üçün PlayStation hesabı əlavə etməlisiniz.",
  NO_EPIC_ACCOUNT: "Hədiyyəni almaq üçün Epic (Türkiyə) hesabı əlavə etməlisiniz.",
  SELECT_PSN: "Zəhmət olmasa PlayStation hesabını seçin.",
  SELECT_EPIC: "Zəhmət olmasa Epic hesabını seçin.",
  UNAUTHORIZED: "Hədiyyəni açmaq üçün hesabınıza daxil olun.",
  ERROR: "Xəta baş verdi. Yenidən cəhd edin.",
};

export default function ClaimGiftForm({
  initialCode,
  psnAccounts,
  epicAccounts,
}: {
  initialCode: string;
  psnAccounts: PsnOpt[];
  epicAccounts: EpicOpt[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(formatProductGiftCode(normalizeProductGiftCode(initialCode)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GiftPreview | null>(null);
  const [claimed, setClaimed] = useState<{ title: string } | null>(null);
  const [showBurst, setShowBurst] = useState(false);

  const normalized = normalizeProductGiftCode(code);
  const isComplete = normalized.length === PRODUCT_GIFT_CODE_LENGTH;
  const progressPercent = Math.round((normalized.length / PRODUCT_GIFT_CODE_LENGTH) * 100);
  const codeSlots = Array.from(
    { length: PRODUCT_GIFT_CODE_LENGTH },
    (_, index) => normalized[index] ?? "",
  );

  const [psnId, setPsnId] = useState(
    psnAccounts.find((a) => a.isDefault)?.id ?? psnAccounts[0]?.id ?? "",
  );
  const [epicId, setEpicId] = useState(
    epicAccounts.find((a) => a.isDefault)?.id ?? epicAccounts[0]?.id ?? "",
  );

  useEffect(() => {
    if (!showBurst) return;
    const timer = window.setTimeout(() => setShowBurst(false), 2300);
    return () => window.clearTimeout(timer);
  }, [showBurst]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete || busy) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/gifts/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setShowBurst(true);
        setPreview(data.gift as GiftPreview);
      } else {
        setError(REASON_TEXT[data?.reason] ?? REASON_TEXT.ERROR);
      }
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd edin.");
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (busy || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gifts/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: normalized,
          ...(preview.needsAccount === "PSN" ? { psnAccountId: psnId } : {}),
          ...(preview.needsAccount === "EPIC" ? { epicAccountId: epicId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setShowBurst(true);
        setClaimed({ title: data.title ?? preview.title });
        router.refresh();
      } else {
        setError(REASON_TEXT[data?.reason] ?? REASON_TEXT.ERROR);
      }
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd edin.");
    } finally {
      setBusy(false);
    }
  }

  if (claimed) {
    return (
      <>
        {showBurst && <GiftBurstOverlay />}
        <div className="gift-success-card p-8 text-center">
          <div className="relative mx-auto mb-5 h-28 w-28">
            <Image
              src="/gift.svg"
              alt="Açılmış hədiyyə"
              fill
              sizes="112px"
              className="object-contain drop-shadow-[0_22px_45px_rgba(52,211,153,0.28)]"
            />
            <span className="absolute -right-1 bottom-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-950/40">
              <Check className="h-5 w-5" />
            </span>
          </div>
          <h2 className="text-3xl font-black text-white">Təbriklər!</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-emerald-50/90">
            <b>{claimed.title}</b> hədiyyəsi hesabınıza əlavə olundu. Komandamız çatdırılma üçün işə
            başlayacaq və status dəyişdikcə sizinlə əlaqə saxlanılacaq.
          </p>
          <Link
            href="/profile/orders"
            className="gift-open-action mt-7 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white"
          >
            Sifarişlərimə bax
          </Link>
        </div>
      </>
    );
  }

  const needPsn = preview?.needsAccount === "PSN";
  const needEpic = preview?.needsAccount === "EPIC";
  const missingPsn = needPsn && psnAccounts.length === 0;
  const missingEpic = needEpic && epicAccounts.length === 0;
  const friendMessage = preview?.message?.trim();

  return (
    <>
      {showBurst && <GiftBurstOverlay />}
      <div className="gift-claim-flow">
        <form
          onSubmit={lookup}
          className={`gift-code-card ${preview ? "is-revealed" : ""}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="gift-code-icon">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <label htmlFor="gift-code-input" className="block text-sm font-semibold text-white">
                  Hədiyyə kodu
                </label>
                <p className="mt-1 text-xs text-zinc-400">11 simvolu tamamlayın</p>
              </div>
            </div>
            <div
              id="gift-code-progress"
              className="inline-flex w-fit items-center gap-2 px-1 py-1 text-xs text-zinc-300"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              {normalized.length}/{PRODUCT_GIFT_CODE_LENGTH}
            </div>
          </div>

          <div
            className="gift-code-composer"
            style={{ "--gift-progress": `${progressPercent}%` } as CSSProperties}
          >
            <input
              id="gift-code-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
              aria-describedby="gift-code-progress"
              value={code}
              onChange={(e) => {
                const cleaned = normalizeProductGiftCode(e.target.value).slice(0, PRODUCT_GIFT_CODE_LENGTH);
                setCode(formatProductGiftCode(cleaned));
                setPreview(null);
                setError(null);
              }}
              className="gift-code-native-input"
            />
            <div className="gift-code-slots" aria-hidden="true">
              {codeSlots.map((char, index) => (
                <span
                  key={index}
                  className={`gift-code-slot ${char ? "is-filled" : ""} ${
                    index === normalized.length ? "is-next" : ""
                  } ${index === 3 || index === 6 ? "is-group-end" : ""}`}
                >
                  {char || "•"}
                </span>
              ))}
            </div>
            <div className="gift-code-progress-line" />
          </div>

          {!preview && (
            <button
              type="submit"
              disabled={!isComplete || busy}
              className="gift-primary-action group mt-5 inline-flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Yoxlanılır...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 transition group-hover:scale-110" /> Hədiyyəni yoxla
                </>
              )}
            </button>
          )}
        </form>

        {error && (
          <div className="gift-error-banner flex items-start gap-2 p-4 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <section className="gift-preview-card">
            <div className="gift-preview-topline">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-100">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Hədiyyə tapıldı
              </span>
              <span className="text-xs font-semibold text-fuchsia-100">
                {preview.kindLabel}
              </span>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[112px_minmax(0,1fr)]">
              <div className="gift-product-cover relative h-28 w-28 overflow-hidden">
                {preview.imageUrl ? (
                  <Image
                    src={preview.imageUrl}
                    alt={preview.title}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-500">
                    <Gift className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-400">{preview.store ?? "Honsell"}</p>
                <h3 className="mt-1 text-2xl font-black text-white">{preview.title}</h3>
                <p className="mt-2 text-base font-bold text-emerald-200">
                  {preview.amountAzn.toFixed(2)} AZN
                </p>
              </div>
            </div>

            <div className="gift-message-note mt-5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-100">
                <MessageCircle className="h-4 w-4" />
                Dostunun mesajı
              </div>
              <p className="mt-3 text-lg font-semibold leading-8 text-white">
                “{friendMessage || "Bu hədiyyə sənin üçündür."}”
              </p>
            </div>

            {needPsn && !missingPsn && (
              <div className="gift-account-field mt-5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                  <Gamepad2 className="h-3.5 w-3.5" /> PlayStation hesabı
                </label>
                <select
                  value={psnId}
                  onChange={(e) => setPsnId(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-zinc-950/80 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:ring-2 focus:ring-emerald-400/30"
                >
                  {psnAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} - {a.psnEmail}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needEpic && !missingEpic && (
              <div className="gift-account-field mt-5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                  <KeyRound className="h-3.5 w-3.5" /> Epic hesabı
                </label>
                <select
                  value={epicId}
                  onChange={(e) => setEpicId(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-zinc-950/80 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:ring-2 focus:ring-emerald-400/30"
                >
                  {epicAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName || a.label} - {a.epicEmail}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {missingPsn || missingEpic ? (
              <div className="mt-5 space-y-3 rounded-xl bg-amber-400/10 p-4">
                <p className="flex items-start gap-2 text-sm text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {missingPsn
                    ? "Bu hədiyyəni almaq üçün əvvəlcə PlayStation hesabınızı əlavə edin."
                    : "Bu hədiyyəni almaq üçün əvvəlcə Epic (Türkiyə) hesabınızı əlavə edin."}
                </p>
                <Link
                  href={missingPsn ? "/profile/accounts" : "/profile/profiles"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-300"
                >
                  Hesab əlavə et
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={claim}
                disabled={busy}
                className="gift-open-action mt-6 inline-flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Açılır...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Hədiyyəni aç
                  </>
                )}
              </button>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function GiftBurstOverlay() {
  const sparks = Array.from({ length: 52 }, (_, index) => {
    const angle = (index / 52) * Math.PI * 2;
    const distance = 28 + (index % 7) * 7;
    const size = 4 + (index % 5) * 2;
    const colors = ["#fef08a", "#f0abfc", "#86efac", "#93c5fd", "#fdba74", "#ffffff"];

    return {
      x: `${Math.cos(angle) * distance}vmin`,
      y: `${Math.sin(angle) * distance}vmin`,
      size: `${size}px`,
      delay: `${(index % 9) * 22}ms`,
      color: colors[index % colors.length],
      rotate: `${Math.round((angle * 180) / Math.PI)}deg`,
    };
  });

  return (
    <div className="gift-burst" aria-hidden="true">
      <div className="gift-burst-flash" />
      <div className="gift-burst-ring gift-burst-ring-one" />
      <div className="gift-burst-ring gift-burst-ring-two" />
      <div className="gift-burst-ring gift-burst-ring-three" />
      <div className="gift-burst-core">
        <Image
          src="/gift.svg"
          alt=""
          fill
          sizes="180px"
          priority
          className="object-contain"
        />
      </div>
      {sparks.map((spark, index) => (
        <span
          key={index}
          className={`gift-burst-spark ${index % 4 === 0 ? "is-star" : ""}`}
          style={
            {
              "--gift-x": spark.x,
              "--gift-y": spark.y,
              "--gift-size": spark.size,
              "--gift-delay": spark.delay,
              "--gift-color": spark.color,
              "--gift-rotate": spark.rotate,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
