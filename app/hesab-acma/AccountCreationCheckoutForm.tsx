"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Gamepad2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import ProductImage from "@/components/ProductImage";
import ReferralBadge from "@/components/ReferralBadge";
import type { HesabAcmaProduct } from "@/components/HesabAcmaHomeCategoryCard";
import { useCart } from "@/lib/cart";
import { validateAccountCreationDetails } from "@/lib/accountCreationCart";
import { accountPasswordChecks } from "@/lib/accountPasswordRules";

/**
 * Hesab açılışı formasının "checkout" görünüşü: solda məlumat sahələri, sağda
 * sifariş xülasəsi + CTA.
 *
 * ⚠️ CTA sağ sütundadır, sahələr solda — ona görə HƏR İKİ sütun EYNİ `<form>`
 * elementinin içindədir. Sağ sütunu ayrı bloka çıxarıb düyməni `onClick` ilə
 * işlətmək Enter ilə göndərməni və brauzerin öz validasiya fokusunu itirir.
 */
export default function AccountCreationCheckoutForm({ product }: { product: HesabAcmaProduct }) {
  const router = useRouter();
  const { add } = useCart();

  const [fullName, setFullName] = useState("");
  const [dobText, setDobText] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const birthDate = useMemo(() => isoFromDobText(dobText), [dobText]);
  const checks = useMemo(() => accountPasswordChecks(password, [email.trim()]), [password, email]);
  const priceText = (product.priceAznCents / 100).toFixed(2);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (dobText.trim() && !birthDate) {
      setErr("Doğum tarixini GG/AA/YYYY formatında yazın (məs.: 05/09/1998).");
      return;
    }

    const details = {
      fullName: fullName.trim(),
      birthDate,
      email: email.trim(),
      password,
    };
    // Sahələr ƏVVƏL yoxlanılır: checkbox formanın SONUNDA olduğu üçün boş formada
    // "təsdiqləyin" xətası göstərmək istifadəçini səhv yerə yönəldir.
    const invalid = validateAccountCreationDetails(details);
    if (invalid) {
      setErr(invalid);
      return;
    }
    if (!ack) {
      setErr("Şifrəni təhlükəsiz saxlayacağınızı təsdiqləyin.");
      return;
    }

    setBusy(true);
    try {
      add({
        id: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        finalAzn: product.priceAznCents / 100,
        productType: "ACCOUNT_CREATION",
        accountCreation: details,
      });
      router.push("/cart");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start"
    >
      {/* ─── Sol: hesab məlumatları ─────────────────────────────────────── */}
      <div className="min-w-0 rounded-3xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
            <UserRound className="h-5 w-5" />
          </span>
          <h2 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
            Hesab məlumatları
          </h2>
        </div>

        <div className="mt-6 grid gap-5">
          <Field label="Ad və soyad" htmlFor="ha-name">
            <input
              id="ha-name"
              autoComplete="name"
              className={INPUT}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Adınızı və soyadınızı daxil edin"
            />
          </Field>

          <Field label="Doğum tarixi" htmlFor="ha-dob">
            {/* Görünən sahə maskalı mətndir (GG/AA/YYYY), sağdaki şəffaf
                `type="date"` isə brauzerin öz təqvimini açır — yəni həm
                klaviatura ilə yazmaq, həm də mobil picker işləyir. */}
            <div className="relative">
              <input
                id="ha-dob"
                inputMode="numeric"
                autoComplete="bday"
                className={`${INPUT} pr-12`}
                value={dobText}
                onChange={(e) => setDobText(maskDobText(e.target.value))}
                placeholder="GG/AA/YYYY"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                <CalendarDays className="h-4 w-4" />
              </span>
              <input
                type="date"
                aria-label="Doğum tarixini təqvimdən seç"
                tabIndex={-1}
                max={new Date().toISOString().slice(0, 10)}
                value={birthDate}
                onChange={(e) => setDobText(dobTextFromIso(e.target.value))}
                className="absolute inset-y-0 right-0 w-12 cursor-pointer opacity-0"
              />
            </div>
          </Field>

          <Field
            label="Yeni e-poçt"
            htmlFor="ha-email"
            hint="Bu hesab üçün yeni e-poçt ünvanı yaradın — başqa region PS Store hesabına bağlı olmamalıdır."
          >
            <input
              id="ha-email"
              type="email"
              autoComplete="off"
              className={INPUT}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yeni.email@example.com"
            />
          </Field>

          <Field
            label="Yeni şifrə"
            htmlFor="ha-password"
            hint="Bu şifrə yeni PSN hesabına qoyulur və sifarişi icra edən əməkdaşa görünür."
          >
            <div className="relative">
              <input
                id="ha-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                spellCheck={false}
                className={`${INPUT} pr-12 font-mono`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifrə yaradın"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <div className="flex flex-wrap gap-2">
            {checks.map((check) => (
              <PasswordChip
                key={check.key}
                label={check.label}
                state={password.length === 0 ? "idle" : check.ok ? "ok" : "fail"}
              />
            ))}
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-zinc-300 text-violet-600 focus:ring-violet-500/40 dark:border-white/20 dark:bg-white/[0.06]"
            />
            <span>
              Şifrəni təhlükəsiz saxlayacağam
              <span className="mt-1 block text-xs font-normal leading-5 text-zinc-500 dark:text-zinc-400">
                Hesab təhvil verildikdən sonra şifrəni dəyişmək tövsiyə olunur.
              </span>
            </span>
          </label>

          {err && (
            <p
              role="alert"
              className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              {err}
            </p>
          )}
        </div>
      </div>

      {/* ─── Sağ: sifariş xülasəsi ──────────────────────────────────────── */}
      <aside className="rounded-3xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none sm:p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-black tracking-tight text-zinc-950 dark:text-white">
          Sifariş xülasəsi
        </h2>

        <div className="mt-5 flex gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-violet-500/10 ring-1 ring-zinc-200 dark:ring-white/10">
            <ProductImage
              src={product.imageUrl}
              alt={product.title}
              sizes="80px"
              className="h-full w-full object-cover"
              fallback={
                <span className="grid h-full w-full place-items-center text-violet-600 dark:text-violet-300">
                  <Gamepad2 className="h-9 w-9" />
                </span>
              }
            />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[15px] font-black leading-5 text-zinc-950 dark:text-white">
              {product.title}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Yeni hesab • Türkiyə regionu
            </p>
            <p className="mt-2 text-2xl font-black tabular-nums text-zinc-950 dark:text-white">
              {priceText} AZN
            </p>
          </div>
        </div>

        {/* ⚠️ Referal faizi 0 olanda `ReferralBadge` null qaytarır — ona görə ayırıcı
            xətt ONA deyil, aşağıdakı siyahıya bağlıdır, yoxsa boş bir zolaq qalır. */}
        <div className="mt-5 empty:hidden">
          <ReferralBadge category="accountCreation" productName="Türkiyə PSN hesabı" />
        </div>

        <ul className="mt-5 grid gap-3 border-t border-zinc-200 pt-5 dark:border-white/10">
          <SummaryPerk icon={<UserRound className="h-4 w-4" />} text="Sizin adınıza açılır" />
          <SummaryPerk icon={<Mail className="h-4 w-4" />} text="Yeni e-poçt ilə" />
          <SummaryPerk icon={<ShieldCheck className="h-4 w-4" />} text="Təhlükəsiz təhvil" />
          <SummaryPerk icon={<LockKeyhole className="h-4 w-4" />} text="Şifrəni siz təyin edirsiniz" />
        </ul>

        <button
          type="submit"
          disabled={busy}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-4 text-sm font-black text-white transition hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 disabled:opacity-60"
        >
          {busy ? "Səbətə əlavə edilir..." : "Ödənişə keç"}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Hesab ödənişdən sonra hazırlanacaq.
        </p>
      </aside>
    </form>
  );
}

const INPUT =
  "w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-600 dark:focus:bg-white/[0.06]";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-bold text-zinc-800 dark:text-zinc-200"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && (
        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p>
      )}
    </div>
  );
}

function PasswordChip({ label, state }: { label: string; state: "idle" | "ok" | "fail" }) {
  const tone =
    state === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300"
      : state === "fail"
        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300"
        : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tone}`}
    >
      {state === "fail" ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function SummaryPerk({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
        {icon}
      </span>
      {text}
    </li>
  );
}

/** Yazılanı `GG/AA/YYYY` formasına salır (yalnız rəqəm saxlanılır). */
function maskDobText(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

function dobTextFromIso(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * `GG/AA/YYYY` → `YYYY-MM-DD`. Səbətdə və sifarişdə tarix ISO formatında
 * saxlanılır (mövcud sifarişlərlə eyni forma) — maska yalnız görünüşdür.
 * Tarix real deyilsə (31/02, gələcək gün, 1900-dən əvvəl) boş sətir qaytarır.
 */
function isoFromDobText(text: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  // 31/02 kimi tarixi `Date` növbəti aya sürüşdürür — geri müqayisə ilə tuturuq.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return "";
  }
  if (date.getTime() > Date.now()) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}
