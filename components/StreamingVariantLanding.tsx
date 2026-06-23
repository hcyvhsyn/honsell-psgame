"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  CircleHelp,
  Home,
  MonitorUp,
  Repeat,
  Route,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Tv,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type LandingFeatureTone = "good" | "bad" | "warn" | "neutral";
export type LandingFeature = { text: string; tone: LandingFeatureTone };

export type LandingVariant = {
  slug: string;
  name: string;
  fromPerMonthAzn: number;
  features: LandingFeature[];
  href: string;
  imageUrl: string | null;
};

const TONE: Record<LandingFeatureTone, { Icon: LucideIcon; iconClass: string; rowClass: string }> = {
  good: {
    Icon: Check,
    iconClass: "text-[#50f0a1]",
    rowClass: "border-[#2be889]/15 bg-[#2be889]/[0.06]",
  },
  bad: {
    Icon: Ban,
    iconClass: "text-[#ff6b8a]",
    rowClass: "border-[#ff6b8a]/15 bg-[#ff6b8a]/[0.06]",
  },
  warn: {
    Icon: AlertTriangle,
    iconClass: "text-[#ffd166]",
    rowClass: "border-[#ffd166]/20 bg-[#ffd166]/[0.07]",
  },
  neutral: {
    Icon: Check,
    iconClass: "text-[#99a4bf]",
    rowClass: "border-[#ffffff]/10 bg-[#ffffff]/[0.04]",
  },
};

function isTechnicalProblem(feature: LandingFeature) {
  const text = feature.text.toLocaleLowerCase("az-AZ");
  if (feature.tone === "good") return false;
  if (
    text.includes("heç bir") ||
    text.includes("hec bir") ||
    text.includes("yaşanmır") ||
    text.includes("yasanmir")
  ) {
    return false;
  }
  return text.includes("texniki problem") || text.includes("2 həftədə") || text.includes("2 heftede");
}

function variantSummary(name: string) {
  const normalized = name.toLocaleLowerCase("az-AZ");
  if (normalized.includes("vip")) return "Ən rahat və daha stabil istifadə istəyənlər üçün.";
  if (normalized.includes("ev")) return "TV-də və ev ekranında istifadə etmək istəyənlər üçün.";
  if (normalized.includes("yan")) return "Telefon, planşet və şəxsi istifadə üçün uyğun seçim.";
  return "İstifadə tərzinə görə seçilən Netflix paketi.";
}

function FeatureRow({
  feature,
  onExplain,
}: {
  feature: LandingFeature;
  onExplain?: () => void;
}) {
  const tone = TONE[feature.tone] ?? TONE.neutral;
  const Icon = tone.Icon;
  const explain = onExplain && isTechnicalProblem(feature);
  return (
    <div className={`rounded-lg border p-3 ${tone.rowClass}`}>
      <div className="flex items-start gap-2 text-sm leading-snug">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.iconClass}`} />
        <span className="text-[#d9dfef]">{feature.text}</span>
      </div>
      {explain && (
        <button
          type="button"
          onClick={onExplain}
          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-[#ffd166]/25 bg-[#ffd166]/10 px-2.5 text-xs font-black text-[#ffe1a3] transition hover:bg-[#ffd166]/15"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          Bu problem nədir?
        </button>
      )}
    </div>
  );
}

export default function StreamingVariantLanding({
  serviceLabel,
  variants,
  commonFeatures,
}: {
  serviceLabel: string;
  variants: LandingVariant[];
  commonFeatures: LandingFeature[];
}) {
  const [technicalModalOpen, setTechnicalModalOpen] = useState(false);
  const sortedVariants = [...variants].sort((a, b) => a.fromPerMonthAzn - b.fromPerMonthAzn);
  const cheapest = sortedVariants[0]?.slug ?? null;

  return (
    <>
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-lg border border-[#24283b] bg-[#070812] p-4 shadow-[0_28px_90px_-60px_rgba(229,9,20,0.85)] sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(229,9,20,0.18),transparent_40%,rgba(124,58,237,0.12)_70%,rgba(34,211,238,0.08))]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[linear-gradient(90deg,#ffffff_1px,transparent_1px),linear-gradient(0deg,#ffffff_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="relative grid gap-5 lg:grid-cols-[0.74fr_1.26fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-[#e50914]/35 bg-[#e50914]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#ffb4b8]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e50914] shadow-[0_0_16px_rgba(229,9,20,0.9)]" />
                Paket müqayisəsi
              </div>
              <h3 className="mt-3 text-2xl font-black leading-tight text-[#f8fbff] sm:text-3xl">
                {serviceLabel} paketləri arasındakı fərqi aydın seç
              </h3>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-[#99a4bf]">
                Hər paket eyni məqsəd üçün deyil. TV dəstəyi, stabil istifadə və mümkün texniki riskləri
                müqayisə edib uyğun paketi seç.
              </p>
            </div>

            {commonFeatures.length > 0 && (
              <div className="rounded-lg border border-[#ffffff]/10 bg-[#0b0d19]/80 p-3">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#ffb4b8]">
                  <Sparkles className="h-4 w-4" /> Hamısında eyni qalır
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {commonFeatures.map((f, i) => (
                    <FeatureRow key={i} feature={f} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {variants.map((v) => {
            const isVip = /vip/i.test(v.name);
            const isCheapest = v.slug === cheapest;
            return (
              <article
                key={v.slug}
                className="group relative flex min-h-full flex-col overflow-hidden rounded-lg border border-[#24283b] bg-[#080a14] shadow-[0_22px_70px_-58px_rgba(229,9,20,0.9)] transition duration-200 hover:-translate-y-0.5 hover:border-[#e50914]/45 hover:bg-[#0d101d]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-[#030409]">
                  {v.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={v.imageUrl}
                      alt={`${serviceLabel} ${v.name}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover opacity-90 contrast-110 saturate-125 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,#e50914,#19050a_48%,#05060c)]" />
                  )}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(229,9,20,0.2),transparent_36%),linear-gradient(0deg,rgba(3,4,9,0.82),rgba(3,4,9,0.18)_58%,rgba(3,4,9,0.04))]" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    {isCheapest && (
                      <span className="rounded-md bg-[#f8fbff] px-2.5 py-1 text-[11px] font-black text-[#080a14]">
                        Ən sərfəli
                      </span>
                    )}
                    {isVip && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#e50914] px-2.5 py-1 text-[11px] font-black text-[#fff5f5] shadow-lg">
                        <Star className="h-3.5 w-3.5 fill-current" /> VIP
                      </span>
                    )}
                  </div>
                  {isVip && (
                    <div className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-lg border border-[#e50914]/35 bg-[#e50914]/15 text-[#ffb4b8] backdrop-blur">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffb4b8]">
                      {serviceLabel}
                    </p>
                    <h3 className="mt-1 text-3xl font-black leading-none text-[#f8fbff] drop-shadow">
                      {v.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-[#c8d0e3]">
                      {variantSummary(v.name)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="rounded-lg border border-[#ffffff]/10 bg-[#ffffff]/[0.035] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#707b98]">
                      Başlanğıc qiymət
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#9ba5bd]">
                      <span className="text-3xl font-black text-[#f8fbff] tabular-nums">
                        {v.fromPerMonthAzn.toFixed(2)}
                      </span>{" "}
                      ₼ / aydan
                    </p>
                  </div>

                  <div className="mt-3 flex-1 space-y-2">
                    {v.features.map((f, i) => (
                      <FeatureRow
                        key={i}
                        feature={f}
                        onExplain={() => setTechnicalModalOpen(true)}
                      />
                    ))}
                  </div>

                  <Link
                    href={v.href}
                    className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#e50914] px-3 text-sm font-black text-[#fff5f5] shadow-[0_18px_42px_-26px_rgba(229,9,20,0.95)] transition hover:bg-[#ff1f2b]"
                  >
                    Bu paketi seç
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {technicalModalOpen && (
        <TechnicalProblemModal onClose={() => setTechnicalModalOpen(false)} />
      )}
    </>
  );
}

function TechnicalProblemModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Netflix hane problemi izahı"
        className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#ffd166]/30 bg-[#070812] shadow-[0_32px_100px_-54px_rgba(255,209,102,0.95)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1.5 bg-[linear-gradient(90deg,#ffd166,#e50914,#8b5cf6)]" />
        <div className="flex items-start justify-between gap-4 border-b border-[#ffffff]/10 p-5">
          <div className="flex gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#ffd166]/35 bg-[#ffd166]/10 text-[#ffd166]">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xl font-black text-[#f8fbff]">
                Netflix “hane” problemi nədir?
              </p>
              <p className="mt-1 text-sm font-semibold text-[#9ba5bd]">
                TV ilə istifadə olunan paketlərdə yarana bilən ev təsdiqi probleminin izahı.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Bağla"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#ffffff]/10 text-[#9ba5bd] transition hover:bg-[#ffffff]/10 hover:text-[#f8fbff]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-lg border border-[#e50914]/25 bg-[#e50914]/10 p-4">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#ffb4b8]">
              Müştərinin görə biləcəyi bildiriş
            </p>
            <p className="mt-2 rounded-md border border-[#ffffff]/10 bg-[#030409]/70 p-3 text-sm font-black leading-relaxed text-[#f8fbff]">
              “Bu cihaz Netflix hanenizin bir parçası deyil”
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[#aeb8ce]">
              Bəzən bu mesaja bənzər hane və ya ev təsdiqi bildirişi görünə bilər.
            </p>
          </div>

          <InfoCard
            icon={Home}
            title="Hane sistemi necə işləyir?"
            body="Netflix hane sistemi hesabın əsasən eyni evdə yaşayan ailə üzvləri tərəfindən istifadə olunması üçün qurulmuş təhlükəsizlik sistemidir. Netflix hesabın hansı cihazlarda və hansı internet bağlantısı ilə istifadə edildiyini müəyyən aralıqlarla yoxlayır."
          />
          <InfoCard
            icon={MonitorUp}
            title="Problem niyə yaranır?"
            body="Netflix təxminən 14-20 gündən bir hesaba qoşulan cihazların IP ünvanlarını və istifadə yerini analiz edir. Hesab fərqli yerlərdən, fərqli internetlərdən və ya Netflix-in şübhəli hesab etdiyi bağlantılardan istifadə olunursa, izləmə müvəqqəti bloklana bilər."
          />

          <section className="rounded-lg border border-[#ffffff]/10 bg-[#ffffff]/[0.04] p-4">
            <p className="text-base font-black text-[#f8fbff]">Bu problem necə həll olunur?</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <SolutionCard
                icon={Repeat}
                title="1. Kabinetin başqa hesaba transfer edilməsi"
                body="Ən stabil həll istifadə etdiyiniz profil/kabinetin başqa uyğun Netflix hesabına köçürülməsidir. Bu halda izləməyə davam edə bilirsiniz. Müddət həmin anda boş və uyğun kabinetlərin vəziyyətindən asılıdır, ortalama 1-2 saat çəkə bilər."
              />
              <SolutionCard
                icon={Route}
                title="2. “Səyahətdəyəm” metodu"
                body="Bu metod Netflix-in istifadəçiyə hesabı başqa yerdən müvəqqəti istifadə etməyə icazə verməsi üçündür. Vacib məqam: “Səyahətdəyəm” metodu hər hesab üçün yalnız 1 dəfə istifadə oluna bilir."
              />
            </div>
          </section>

          <section className="rounded-lg border border-[#ffffff]/10 bg-[#ffffff]/[0.04] p-4">
            <p className="text-base font-black text-[#f8fbff]">Paketlərə görə fərq</p>
            <div className="mt-3 grid gap-3">
              <PackageRisk
                icon={Smartphone}
                title="Yanımda"
                body="Bu paketdə hane problemi yaşanmır. Çünki TV ilə girişə icazə verilmir və istifadə telefon, planşet və ya kompüter kimi şəxsi cihazlar üzərindən olur."
                tone="good"
              />
              <PackageRisk
                icon={Tv}
                title="Evimdə"
                body="Hane problemi təxminən 14-20 gündən bir yaşana bilər. Netflix fərqli yerlərdən istifadəni aşkar edərsə, izləmə müvəqqəti bloklana bilər. Problem kabinet transferi və ya “Səyahətdəyəm” metodu ilə həll olunur."
                tone="warn"
              />
              <PackageRisk
                icon={ShieldCheck}
                title="Evimdə VIP"
                body="Bu problem adətən yalnız 1 dəfə yaşanır. İlk hane təsdiqi və ya düzəlişdən sonra hesab daha stabil işləyir və müştəri uzun müddət əlavə hane problemi yaşamadan istifadə edə bilir."
                tone="premium"
              />
            </div>
          </section>

          <section className="rounded-lg border border-[#ffd166]/20 bg-[#ffd166]/[0.06] p-4">
            <p className="text-base font-black text-[#f8fbff]">FAQ</p>
            <div className="mt-3 space-y-2">
              <FaqItem
                question="Hane problemi hesabın bağlanması deməkdir?"
                answer="Xeyr. Bu, adətən hesabın tam bağlanması deyil, Netflix-in ev təsdiqi səbəbi ilə izləməni müvəqqəti bloklamasıdır."
              />
              <FaqItem
                question="Həll müddəti nə qədər çəkir?"
                answer="Kabinet transferi boş və uyğun kabinetlərin vəziyyətindən asılıdır. Ortalama proses 1-2 saat çəkə bilər."
              />
              <FaqItem
                question="“Səyahətdəyəm” metodu hər dəfə istifadə olunur?"
                answer="Xeyr. Bu metod hər hesab üçün yalnız 1 dəfə istifadə oluna bilir. Eyni hesabda problem təkrar yaranarsa, kabinet transferi lazımdır."
              />
              <FaqItem
                question="TV üçün daha stabil seçim hansıdır?"
                answer="TV ilə istifadə üçün Evimdə VIP daha stabil seçimdir. Yanımda paketində isə TV girişi olmadığı üçün hane problemi yaşanmır."
              />
            </div>
          </section>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#ffd166] text-sm font-black text-[#120b02] transition hover:bg-[#ffe19a]"
          >
            Başa düşdüm
          </button>
        </div>
      </div>
    </div>
  );
}

function SolutionCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-[#ffffff]/10 bg-[#030409]/55 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#ffd166]/12 text-[#ffd166]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-black leading-snug text-[#f8fbff]">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#aeb8ce]">{body}</p>
    </div>
  );
}

function PackageRisk({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: "good" | "warn" | "premium";
}) {
  const toneClass =
    tone === "good"
      ? "border-[#2be889]/20 bg-[#2be889]/[0.06] text-[#50f0a1]"
      : tone === "premium"
        ? "border-[#e50914]/25 bg-[#e50914]/[0.08] text-[#ffb4b8]"
        : "border-[#ffd166]/25 bg-[#ffd166]/[0.07] text-[#ffd166]";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#030409]/60">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-black text-[#f8fbff]">{title}</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-[#aeb8ce]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-lg border border-[#ffffff]/10 bg-[#030409]/55 p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-[#f8fbff]">
        {question}
        <ChevronDown className="h-4 w-4 shrink-0 text-[#ffd166] transition group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#aeb8ce]">{answer}</p>
    </details>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-[#ffffff]/10 bg-[#ffffff]/[0.04] p-4">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e50914]/12 text-[#ffb4b8]">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-black text-[#f8fbff]">{title}</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-[#aeb8ce]">{body}</p>
        </div>
      </div>
    </div>
  );
}
