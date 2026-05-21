"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  Briefcase,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import {
  LINKEDIN_PLAN_FEATURES,
  LINKEDIN_PLAN_LABELS,
  LINKEDIN_PLAN_TAGLINES,
  type LinkedInPlanGroup,
  type LinkedInPlanType,
  type LinkedInVariant,
} from "@/lib/linkedin-plans";

type PlanTheme = {
  accent: string;
  accentText: string;
  border: string;
  ring: string;
  cta: string;
  badge: string;
  icon: typeof Briefcase;
  audience: string;
};

const PLAN_THEMES: Record<LinkedInPlanType, PlanTheme> = {
  CAREER: {
    accent: "from-sky-500/15 via-blue-500/10 to-cyan-400/5",
    accentText: "text-sky-300",
    border: "border-sky-400/30",
    ring: "ring-sky-400/40",
    cta: "from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500",
    badge: "bg-sky-500/15 text-sky-200 border-sky-400/30",
    icon: GraduationCap,
    audience: "İş axtaranlar · Tələbələr · Freelancer-lər",
  },
  BUSINESS: {
    accent: "from-blue-700/20 via-indigo-600/10 to-sky-500/5",
    accentText: "text-blue-300",
    border: "border-blue-500/35",
    ring: "ring-blue-500/40",
    cta: "from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600",
    badge: "bg-blue-500/15 text-blue-200 border-blue-400/30",
    icon: Briefcase,
    audience: "Biznes sahibləri · Founder-lər · Satış komandaları",
  },
};

function formatAzn(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function LinkedInPlanSelector({ groups }: { groups: LinkedInPlanGroup[] }) {
  const cart = useCart();
  const allDurations = useMemo(() => {
    const set = new Set<number>();
    groups.forEach((g) => g.variants.forEach((v) => set.add(v.durationMonths)));
    return Array.from(set).sort((a, b) => a - b);
  }, [groups]);

  // Hər müddət üçün ən böyük endirim faizini (Career/Business üzrə max) hesabla —
  // dəyər birbaşa adminin daxil etdiyi köhnə qiymət/yeni qiymət fərqindən gəlir.
  const discountByDuration = useMemo(() => {
    const map = new Map<number, number>();
    for (const g of groups) {
      for (const v of g.variants) {
        if (v.discountPercent == null || v.discountPercent <= 0) continue;
        const current = map.get(v.durationMonths) ?? 0;
        if (v.discountPercent > current) map.set(v.durationMonths, v.discountPercent);
      }
    }
    return map;
  }, [groups]);

  const [duration, setDuration] = useState<number>(allDurations[0] ?? 1);
  const effectiveDuration = allDurations.includes(duration) ? duration : allDurations[0] ?? 1;

  const [pending, setPending] = useState<LinkedInVariant | null>(null);

  function handleSubmit(v: LinkedInVariant, email: string, password: string) {
    cart.add({
      id: v.id,
      title: v.title,
      imageUrl: v.imageUrl,
      finalAzn: v.priceAznCents / 100,
      productType: "PLATFORM",
      streaming: { gmail: email, password, platformKind: "LINKEDIN" },
    });
    cart.updateStreaming(v.id, { gmail: email, password, platformKind: "LINKEDIN" });
    setPending(null);
  }

  if (allDurations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-400">
        Hələ aktiv plan əlavə edilməyib.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <DurationSwitcher
        options={allDurations}
        value={effectiveDuration}
        onChange={setDuration}
        discountByDuration={discountByDuration}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {groups.map((group) => (
          <PlanCard
            key={group.planType}
            group={group}
            duration={effectiveDuration}
            onSelect={(v) => setPending(v)}
          />
        ))}
      </div>

      <p className="text-center text-xs text-zinc-500">
        Qiymətlər AZN ilə göstərilir. Abunəlik birbaşa sənin LinkedIn hesabına aktivləşdirilir.
      </p>

      {pending && (
        <CredentialsModal
          variant={pending}
          onClose={() => setPending(null)}
          onSubmit={(email, password) => handleSubmit(pending, email, password)}
        />
      )}
    </section>
  );
}

function DurationSwitcher({
  options,
  value,
  onChange,
  discountByDuration,
}: {
  options: number[];
  value: number;
  onChange: (n: number) => void;
  discountByDuration: Map<number, number>;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
        Müddəti seç
      </p>
      <div className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/10 bg-zinc-950/80 p-1.5">
        {options.map((n) => {
          const active = value === n;
          const discount = discountByDuration.get(n) ?? 0;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={active}
              className={`relative inline-flex min-w-[88px] items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition ${
                active
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.4)]"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {n} ay
              {discount > 0 && (
                <span
                  className={`absolute -top-2 right-1 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    active
                      ? "bg-white text-blue-700"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  -{discount}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanCard({
  group,
  duration,
  onSelect,
}: {
  group: LinkedInPlanGroup;
  duration: number;
  onSelect: (v: LinkedInVariant) => void;
}) {
  const cart = useCart();

  const theme = PLAN_THEMES[group.planType];
  const Icon = theme.icon;
  const variant =
    group.variants.find((v) => v.durationMonths === duration) ??
    group.variants[0] ??
    null;

  const inCart = variant ? cart.hydrated && cart.has(variant.id) : false;
  const isPopular = variant?.isPopular ?? false;

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl border ${theme.border} bg-zinc-950/80 p-6 shadow-2xl transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(56,189,248,0.18)] sm:p-7`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.accent}`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {isPopular && (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-950 shadow-lg">
          <Sparkles className="h-3 w-3" />
          Populyar
        </span>
      )}

      <div className="relative flex flex-1 flex-col gap-5">
        <header className="flex items-start gap-4">
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border ${theme.border} bg-white/5`}
          >
            <Icon className={`h-7 w-7 ${theme.accentText}`} />
          </span>
          <div className="min-w-0">
            <p className={`text-xs font-bold uppercase tracking-[0.18em] ${theme.accentText}`}>
              LinkedIn Premium
            </p>
            <h3 className="mt-1 text-2xl font-black leading-tight text-white">
              {LINKEDIN_PLAN_LABELS[group.planType].replace("LinkedIn Premium ", "")}
            </h3>
            <p className="mt-1 text-xs font-medium text-zinc-400">{theme.audience}</p>
          </div>
        </header>

        <p className="text-sm leading-relaxed text-zinc-300">
          {LINKEDIN_PLAN_TAGLINES[group.planType]}
        </p>

        {variant && (
          <div
            className={`rounded-2xl border ${theme.border} bg-black/30 p-5`}
            aria-live="polite"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              {variant.oldPriceAznCents && variant.oldPriceAznCents > variant.priceAznCents && (
                <span className="text-base font-medium text-zinc-500 line-through tabular-nums">
                  {formatAzn(variant.oldPriceAznCents)} AZN
                </span>
              )}
              <span className="text-5xl font-black leading-none text-white tabular-nums">
                {formatAzn(variant.priceAznCents)}
              </span>
              <span className={`text-xl font-bold ${theme.accentText}`}>AZN</span>
              {variant.discountPercent != null && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/30">
                  <TrendingUp className="h-3 w-3" />
                  -{variant.discountPercent}%
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              {variant.durationMonths} ay · Aylıq{" "}
              <span className="font-bold text-zinc-200 tabular-nums">
                {(variant.priceAznCents / 100 / variant.durationMonths).toFixed(2)} ₼
              </span>
            </p>
          </div>
        )}

        <ul className="grid gap-2.5">
          {LINKEDIN_PLAN_FEATURES[group.planType].map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-200">
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/5 ring-1 ${theme.ring}`}
              >
                <Check className={`h-3 w-3 ${theme.accentText}`} />
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => variant && onSelect(variant)}
          disabled={!variant || inCart}
          className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white shadow-lg transition disabled:cursor-not-allowed ${
            inCart
              ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow-none"
              : `bg-gradient-to-r ${theme.cta}`
          }`}
        >
          {inCart ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Səbətdədir
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              {group.planType === "CAREER" ? "Career planı seç" : "Business planı seç"}
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function CredentialsModal({
  variant,
  onClose,
  onSubmit,
}: {
  variant: LinkedInVariant;
  onClose: () => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planLabel = variant.planType === "CAREER" ? "Career" : "Business";

  function submit(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Düzgün email ünvanı daxil et.");
      return;
    }
    if (!password || password.length < 4) {
      setError("Şifrəni daxil et (ən az 4 simvol).");
      return;
    }
    onSubmit(cleanEmail, password);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-sky-400/30 bg-zinc-950 p-6 text-zinc-100 shadow-[0_28px_90px_-42px_rgba(56,189,248,0.8)] sm:p-7"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.28),transparent_65%)]" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Bağla"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative flex items-start gap-4 pr-8">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-500/15 ring-1 ring-sky-400/35">
            <ShieldCheck className="h-6 w-6 text-sky-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
              LinkedIn Premium · {planLabel}
            </p>
            <h3 className="mt-1 text-xl font-black leading-tight text-white">
              Hesab məlumatları
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              Premium-u öz hesabına qoşmaq üçün LinkedIn email və şifrəni daxil et.
              Məlumatlar yalnız aktivləşdirmə üçün istifadə olunur və proses bitdikdən sonra
              istəsən şifrəni dəyişə bilərsən.
            </p>
          </div>
        </div>

        <div className="relative mt-6 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-zinc-300">LinkedIn email</span>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-300" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="ad@example.com"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 pl-12 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400/60"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-zinc-300">LinkedIn şifrə</span>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sky-300" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="off"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Hesab şifrəsi"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 pl-12 pr-12 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
        </div>

        {error && (
          <div className="relative mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        <p className="relative mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          Məlumatların şifrələnmiş şəkildə saxlanılır və yalnız Premium aktivləşdirməsi üçün
          istifadə olunur.
        </p>

        <div className="relative mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
          >
            İmtina
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-black text-white shadow-[0_12px_30px_rgba(37,99,235,0.4)] transition hover:from-sky-400 hover:to-blue-500"
          >
            <Plus className="h-4 w-4" />
            Səbətə əlavə et
          </button>
        </div>
      </form>
    </div>
  );
}
