"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleCheck,
  Download,
  Eye,
  EyeOff,
  Flame,
  Lock,
  Mail,
  MonitorSmartphone,
  PlayCircle,
  ShieldCheck,
  ShoppingCart,
  Star,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart";

type Product = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
};

type Props = {
  products: Product[];
};

type Plan = {
  product: Product;
  durationMonths: number | null;
  originalPriceAznCents: number | null;
  discountPct: number;
  isBest: boolean;
};

const BENEFITS = [
  "Reklamsız videolar",
  "Offline izləmə",
  "YouTube Music Premium",
  "Bütün cihazlarda",
];

function readMeta(p: Product) {
  const m =
    p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
      ? (p.metadata as Record<string, unknown>)
      : {};
  const opc = Number(m.originalPriceAznCents);
  const durationMonths = Number(m.durationMonths);
  const titleDuration = p.title.match(/(\d+)\s*ay/i);
  return {
    terms: typeof m.terms === "string" ? m.terms : null,
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    durationMonths: Number.isInteger(durationMonths) && durationMonths > 0
      ? durationMonths
      : titleDuration
        ? Number(titleDuration[1])
        : null,
  };
}

function fmtAzn(cents: number) {
  return `${(cents / 100).toFixed(2)} AZN`;
}

function discountFor(p: Product, originalPriceAznCents: number | null) {
  if (!originalPriceAznCents || originalPriceAznCents <= p.priceAznCents) return 0;
  return Math.round(
    ((originalPriceAznCents - p.priceAznCents) / originalPriceAznCents) * 100,
  );
}

export default function YoutubePlanPicker({ products }: Props) {
  const cart = useCart();
  const router = useRouter();
  const [selected, setSelected] = useState<Product | null>(null);
  const [gmail, setGmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const plans = useMemo<Plan[]>(() => {
    const base = products.map((product) => {
      const meta = readMeta(product);
      return {
        product,
        durationMonths: meta.durationMonths,
        originalPriceAznCents: meta.originalPriceAznCents,
        discountPct: discountFor(product, meta.originalPriceAznCents),
        isBest: false,
      };
    });
    const bestDiscount = Math.max(0, ...base.map((plan) => plan.discountPct));
    const fallbackIndex = Math.floor(base.length / 2);
    const bestIndex =
      bestDiscount > 0
        ? base.findIndex((plan) => plan.discountPct === bestDiscount)
        : fallbackIndex;
    return base.map((plan, index) => ({ ...plan, isBest: index === bestIndex }));
  }, [products]);

  function openModal(p: Product) {
    setSelected(p);
    setGmail("");
    setPassword("");
    setShowPassword(false);
    setError(null);
  }

  function closeModal() {
    setSelected(null);
  }

  function submit() {
    if (!selected) return;
    const cleanGmail = gmail.trim().toLowerCase();
    if (!cleanGmail) {
      setError("Gmail ünvanı daxil edin.");
      return;
    }
    if (!/^[^\s@]+@gmail\.com$/.test(cleanGmail)) {
      setError("Yalnız Gmail ünvanı (@gmail.com) qəbul edilir.");
      return;
    }
    if (!password || password.length < 4) {
      setError("Hesab şifrəsini daxil edin (ən az 4 simvol).");
      return;
    }

    cart.add({
      id: selected.id,
      title: selected.title,
      imageUrl: selected.imageUrl ?? "/youtube.png",
      finalAzn: selected.priceAznCents / 100,
      productType: "PLATFORM",
      streaming: { gmail: cleanGmail, password },
    });
    cart.updateStreaming(selected.id, { gmail: cleanGmail, password });
    setJustAdded(selected.id);
    closeModal();
    setTimeout(() => setJustAdded((prev) => (prev === selected.id ? null : prev)), 2000);
    router.refresh();
  }

  return (
    <>
      <section className="relative overflow-hidden bg-[#05070b] text-zinc-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_14%_6%,rgba(239,68,68,0.18),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(244,63,94,0.18),transparent_32%),linear-gradient(180deg,rgba(127,29,29,0.16),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.014)_1px,transparent_1px)] bg-[size:54px_54px] opacity-40" />

        <div className="relative mx-auto max-w-[96rem] px-4 pb-14 pt-8 sm:px-6 lg:px-8">
          <Hero />

          {products.length === 0 ? (
            <div className="mt-8 rounded-[8px] border border-dashed border-red-400/25 bg-white/[0.035] p-8 text-center text-sm text-zinc-400">
              YouTube Premium üçün aktiv paket yoxdur.
            </div>
          ) : (
            <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.product.id}
                  plan={plan}
                  isAdded={cart.has(plan.product.id)}
                  wasJustAdded={justAdded === plan.product.id}
                  onSelect={() => openModal(plan.product)}
                />
              ))}
            </ul>
          )}

          <TrustBar />
        </div>
      </section>

      {selected && (
        <CredentialsModal
          error={error}
          gmail={gmail}
          password={password}
          showPassword={showPassword}
          title={selected.title}
          onClose={closeModal}
          onGmailChange={(value) => {
            setGmail(value);
            if (error) setError(null);
          }}
          onPasswordChange={(value) => {
            setPassword(value);
            if (error) setError(null);
          }}
          onShowPasswordChange={setShowPassword}
          onSubmit={submit}
        />
      )}
    </>
  );
}

function Hero() {
  return (
    <header className="relative overflow-hidden rounded-[8px] border border-red-400/25 bg-[radial-gradient(circle_at_91%_24%,rgba(239,68,68,0.32),transparent_22%),linear-gradient(115deg,rgba(127,29,29,0.56),rgba(7,10,15,0.96)_32%,rgba(8,12,18,0.96)_67%,rgba(127,29,29,0.42))] px-5 py-10 text-center shadow-[0_24px_90px_-58px_rgba(239,68,68,0.85)] sm:px-8 sm:py-12">
      <div className="pointer-events-none absolute right-[-1.5rem] top-[-2.5rem] h-40 w-64 rotate-12 rounded-[32px] bg-red-500/15 shadow-[inset_0_0_55px_rgba(248,113,113,0.18)] sm:h-52 sm:w-80" />
      <div className="pointer-events-none absolute right-14 top-16 hidden h-0 w-0 border-y-[24px] border-l-[38px] border-y-transparent border-l-red-200/10 lg:block" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-red-300/25 to-transparent" />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center">
        <div className="relative h-9 w-56 sm:h-10 sm:w-64">
          <Image
            src="/youtube.png"
            alt="YouTube Premium"
            fill
            priority
            sizes="260px"
            className="object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]"
          />
        </div>

        <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          YouTube Premium{" "}
          <span className="bg-gradient-to-r from-red-300 via-rose-400 to-red-500 bg-clip-text text-transparent">
            paketləri
          </span>
        </h1>
        <p className="mt-4 max-w-3xl text-base text-zinc-300 sm:text-lg">
          Müddətini seç, sifarişdən sonra hesab məlumatları emailinə göndəriləcək.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-zinc-300">
          <HeroBenefit icon={<PlayCircle className="h-4 w-4" />} label="Reklamsız videolar" />
          <HeroBenefit icon={<Download className="h-4 w-4" />} label="Offline izləmə" />
          <HeroBenefit icon={<PlayCircle className="h-4 w-4" />} label="YouTube Music Premium" />
          <HeroBenefit icon={<MonitorSmartphone className="h-4 w-4" />} label="Bütün cihazlarda" />
        </div>
      </div>
    </header>
  );
}

function HeroBenefit({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-red-400">{icon}</span>
      {label}
    </span>
  );
}

function PlanCard({
  plan,
  isAdded,
  wasJustAdded,
  onSelect,
}: {
  plan: Plan;
  isAdded: boolean;
  wasJustAdded: boolean;
  onSelect: () => void;
}) {
  const { product, durationMonths, originalPriceAznCents, discountPct, isBest } = plan;

  return (
    <li
      className={`group relative flex min-h-[30rem] flex-col overflow-visible rounded-[8px] border bg-[linear-gradient(180deg,rgba(127,29,29,0.56),rgba(7,11,16,0.98)_34%,rgba(6,10,15,0.98))] p-5 shadow-[0_26px_70px_-50px_rgba(239,68,68,0.8)] transition duration-200 hover:-translate-y-1 ${
        isBest
          ? "border-red-400/80 shadow-[0_0_0_1px_rgba(248,113,113,0.25),0_26px_80px_-42px_rgba(244,63,94,0.95)]"
          : "border-white/10 hover:border-red-400/45"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[8px]">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,rgba(248,113,113,0.24),transparent_60%)]" />
        <div className="absolute inset-x-5 top-[23rem] h-px bg-gradient-to-r from-transparent via-red-400/25 to-transparent" />
      </div>

      {isBest && (
        <>
          <div className="absolute -top-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-[8px] bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-[0_14px_36px_-18px_rgba(244,63,94,1)]">
            <Star className="h-4 w-4 fill-white" />
            Ən sərfəli
          </div>
          <div className="absolute -bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-[8px] border border-red-400/35 bg-red-950/90 px-4 py-2 text-xs font-medium text-red-100 shadow-[0_14px_36px_-20px_rgba(244,63,94,1)]">
            <Flame className="h-4 w-4 fill-red-300 text-red-300" />
            Ən çox seçilən plan
          </div>
        </>
      )}

      {discountPct > 0 && (
        <div className="absolute right-4 top-4 z-10 rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-3 py-1.5 text-sm font-black text-white shadow-lg shadow-red-500/25">
          -{discountPct}%
        </div>
      )}

      <div className="relative z-[1] flex h-full flex-1 flex-col">
        <div className="relative h-7 w-28">
          <Image
            src="/youtube.png"
            alt="YouTube Premium"
            fill
            sizes="112px"
            className="object-contain object-left"
          />
        </div>

        <div className="mx-auto mt-8 grid h-24 w-24 place-items-center rounded-[8px] border border-red-300/25 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <CalendarDays className="h-10 w-10 text-red-300" strokeWidth={1.8} />
          <span className="text-2xl font-black text-white">
            {durationMonths ? `${durationMonths} ay` : "Plan"}
          </span>
        </div>

        <h3 className="mt-5 text-center text-lg font-black leading-snug text-white">
          YouTube Premium &<br /> YouTube Music
        </h3>

        <div className="mt-7 text-center">
          {originalPriceAznCents && originalPriceAznCents > product.priceAznCents && (
            <div className="mb-1 text-sm font-medium text-zinc-500 line-through">
              {fmtAzn(originalPriceAznCents)}
            </div>
          )}
          <div
            className={`text-4xl font-black tracking-tight ${
              isBest ? "text-red-300" : "text-white"
            }`}
          >
            {fmtAzn(product.priceAznCents).replace(" AZN", "")}{" "}
            <span className="text-2xl">AZN</span>
          </div>
        </div>

        <div className="mt-5 h-px bg-gradient-to-r from-transparent via-red-400/15 to-transparent" />

        <ul className="mt-4 space-y-2.5 text-sm text-zinc-300">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2">
              <CircleCheck className="h-4 w-4 shrink-0 text-red-400" />
              {benefit}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onSelect}
          disabled={isAdded}
          className={`mt-auto inline-flex h-14 w-full items-center justify-center gap-2 rounded-[8px] px-4 text-base font-black text-white transition disabled:cursor-not-allowed ${
            isAdded
              ? "border border-emerald-400/25 bg-emerald-500/15 text-emerald-200"
              : isBest
                ? "bg-gradient-to-r from-rose-600 via-red-500 to-pink-600 shadow-[0_18px_44px_-24px_rgba(244,63,94,1)] hover:from-rose-500 hover:via-red-400 hover:to-pink-500"
                : "bg-gradient-to-r from-red-500 to-red-700 shadow-[0_18px_44px_-26px_rgba(239,68,68,0.9)] hover:from-red-400 hover:to-red-600"
          }`}
        >
          {wasJustAdded ? (
            <>
              <Check className="h-5 w-5" />
              Əlavə edildi
            </>
          ) : isAdded ? (
            <>
              <Check className="h-5 w-5" />
              Səbətdədir
            </>
          ) : (
            <>
              <ShoppingCart className="h-5 w-5" />
              Səbətə əlavə et
            </>
          )}
        </button>
      </div>
    </li>
  );
}

function TrustBar() {
  return (
    <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-full border border-white/10 bg-white/[0.035] px-6 py-3 text-sm text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <span className="inline-flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-rose-400" />
        100% təhlükəsiz ödəniş
      </span>
      <span className="hidden text-zinc-500 sm:inline">•</span>
      <span>Dərhal aktivləşdirmə</span>
      <span className="hidden text-zinc-500 sm:inline">•</span>
      <span>Məmnuniyyət zəmanəti</span>
    </div>
  );
}

function CredentialsModal({
  error,
  gmail,
  password,
  showPassword,
  title,
  onClose,
  onGmailChange,
  onPasswordChange,
  onShowPasswordChange,
  onSubmit,
}: {
  error: string | null;
  gmail: string;
  password: string;
  showPassword: boolean;
  title: string;
  onClose: () => void;
  onGmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onShowPasswordChange: (value: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-[10px] border border-red-400/25 bg-[#080b10] p-6 text-zinc-100 shadow-[0_28px_90px_-42px_rgba(239,68,68,0.75)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.28),transparent_65%)]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] text-zinc-500 transition hover:bg-white/[0.08] hover:text-zinc-200"
          aria-label="Bağla"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative flex items-start gap-4 pr-8">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-red-500/15 ring-1 ring-red-500/30">
            <Mail className="h-6 w-6 text-red-300" />
          </div>
          <div className="min-w-0">
            <div className="relative h-7 w-44">
              <Image
                src="/youtube.png"
                alt="YouTube Premium"
                fill
                sizes="176px"
                className="object-contain object-left"
              />
            </div>
            <h3 className="mt-3 text-xl font-black text-white">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Abunəliyi qoşmaq üçün Gmail hesabının email və şifrəsini daxil et.
              Məlumatlar yalnız Premium aktivləşdirməsi üçün istifadə olunur.
            </p>
          </div>
        </div>

        <div className="relative mt-6 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-zinc-300">Gmail ünvanı</span>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-red-300" />
              <input
                type="email"
                autoComplete="email"
                value={gmail}
                onChange={(e) => onGmailChange(e.target.value)}
                placeholder="seninhesabin@gmail.com"
                className="h-12 w-full rounded-[8px] border border-white/10 bg-black/25 pl-12 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-red-300/55"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-zinc-300">Şifrə</span>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-red-300" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="off"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Gmail şifrəsi"
                className="h-12 w-full rounded-[8px] border border-white/10 bg-black/25 pl-12 pr-12 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-red-300/55"
              />
              <button
                type="button"
                onClick={() => onShowPasswordChange(!showPassword)}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[7px] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"
                aria-label={showPassword ? "Şifrəni gizlət" : "Şifrəni göstər"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>
        </div>

        {error && (
          <div className="relative mt-3 rounded-[8px] border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="relative mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08]"
          >
            İmtina
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex items-center gap-2 rounded-[8px] bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 text-sm font-black text-white shadow-[0_16px_36px_-22px_rgba(244,63,94,1)] hover:from-red-400 hover:to-rose-500"
          >
            <ShoppingCart className="h-4 w-4" />
            Səbətə əlavə et
          </button>
        </div>
      </div>
    </div>
  );
}
