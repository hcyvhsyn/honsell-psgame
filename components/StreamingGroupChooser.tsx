import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Mail,
  Monitor,
  ShieldCheck,
  Sparkles,
  Tv,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import type { StreamingGroupChoice } from "@/lib/streamingGroups";

export type StreamingGroupChoicePricing = {
  accent: StreamingGroupChoice["accent"];
  fromPerMonthAzn: number | null;
  plans: Array<{
    name: string;
    fromPerMonthAzn: number | null;
    href: string;
    note?: string | null;
  }>;
};

type DifferenceRow = {
  label: string;
  kabinet: ReactNode;
  hesab: ReactNode;
};

const DIFFERENCE_ROWS: DifferenceRow[] = [
  {
    label: "Kimə aid?",
    kabinet: "Hazır kabinet",
    hesab: "Sənin hesabın",
  },
  {
    label: "Alışda nə lazımdır?",
    kabinet: "Heç nə",
    hesab: "Netflix e-poçtu",
  },
  {
    label: "Giriş",
    kabinet: "Mail + şifrə + PIN",
    hesab: "Öz mailin",
  },
  {
    label: "TV",
    kabinet: (
      <>
        Yanımda yox
        <span className="text-zinc-600"> / </span>
        Evimdə var
      </>
    ),
    hesab: "Bütün planlarda var",
  },
  {
    label: "Ən uyğun",
    kabinet: "Sürətli və sərfəli giriş",
    hesab: "Tam nəzarət istəyənlər",
  },
];

const FAQ_ITEMS = [
  {
    q: "Kabinet almaq nə deməkdir?",
    a: "Honsell-in hazır Netflix hesabında sənə ayrıca kabinet/profil ayrılır. Giriş məlumatlarını biz veririk.",
  },
  {
    q: "Hesab almaq nə deməkdir?",
    a: "Plan sənin şəxsi Netflix hesabına qoşulur. Alışda Netflix hesabının e-poçtunu qeyd edirsən.",
  },
  {
    q: "TV üçün hansını seçim?",
    a: "TV-də izləmək istəyirsənsə Evimdə, Evimdə VIP və ya öz hesabına plan daha uyğundur. Yanımda TV üçün deyil.",
  },
  {
    q: "Qiymətlər niyə fərqlidir?",
    a: "Qiymət istifadə modeli, stabillik və plan tipinə görə dəyişir. Ən sərfəli seçim adətən kabinet paketləridir.",
  },
];

function choiceHref(c: StreamingGroupChoice, basePath: string) {
  return c.platformSlug ? `/streaming/${c.platformSlug}` : `${basePath}?secim=${c.selection ?? ""}`;
}

function byAccent(
  pricing: StreamingGroupChoicePricing[] | undefined,
  accent: StreamingGroupChoice["accent"],
) {
  return pricing?.find((item) => item.accent === accent) ?? null;
}

function money(value: number | null) {
  return value == null ? "Tezliklə" : `${value.toFixed(2)} ₼`;
}

function monthly(value: number | null) {
  return value == null ? "Tezliklə" : `${value.toFixed(2)} ₼ / ay`;
}

function cheapestPlan(pricing: StreamingGroupChoicePricing | null) {
  return pricing?.plans.find((plan) => plan.fromPerMonthAzn != null) ?? pricing?.plans[0] ?? null;
}

function planForPoint(
  pricing: StreamingGroupChoicePricing | null,
  point: string,
) {
  const normalizedPoint = point.trim().toLowerCase();
  return pricing?.plans.find((plan) => plan.name.trim().toLowerCase() === normalizedPoint) ?? null;
}

/**
 * Parent xidmət (məs. Netflix) açılışında göstərilən addım seçim ekranı.
 * Hər kart ya eyni səhifədə group landing-i açır (?secim=...), ya da başqa
 * platforma səhifəsinə yönləndirir.
 */
export default function StreamingGroupChooser({
  serviceLabel,
  basePath,
  choices,
  pricing,
}: {
  serviceLabel: string;
  /** Parent detal URL-i — selection seçimləri buna ?secim=... əlavə edir. */
  basePath: string;
  choices: StreamingGroupChoice[];
  pricing?: StreamingGroupChoicePricing[];
}) {
  const cabinet = choices.find((choice) => choice.accent === "kabinet") ?? choices[0];
  const account = choices.find((choice) => choice.accent === "hesab") ?? choices[1];
  const cabinetPricing = cabinet ? byAccent(pricing, cabinet.accent) : null;
  const accountPricing = account ? byAccent(pricing, account.accent) : null;
  const cabinetBest = cheapestPlan(cabinetPricing);
  const accountBest = cheapestPlan(accountPricing);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-[linear-gradient(135deg,#12070a_0%,#07070a_48%,#111827_100%)] px-5 py-8 shadow-2xl sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_18%,rgba(229,9,20,0.22),transparent_38%),radial-gradient(circle_at_12%_88%,rgba(124,58,237,0.18),transparent_44%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-300/[0.45] to-transparent" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-300/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-100">
              <Sparkles className="h-3.5 w-3.5" />
              {serviceLabel} seçimi
            </span>

            <h2 className="mt-5 max-w-2xl text-4xl font-black leading-tight text-white sm:text-5xl">
              Kabinet, yoxsa öz hesabın?
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">
              İki seçim. Fərq sadədir: hazır giriş, ya da öz mailinə aktiv plan.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/[0.28] p-4">
            <div className="grid gap-3">
              <QuickAnswer
                icon={<KeyRound className="h-4 w-4" />}
                title="Kabinet"
                value={cabinetBest ? monthly(cabinetBest.fromPerMonthAzn) : money(cabinetPricing?.fromPerMonthAzn ?? null)}
                tone="cabinet"
              />
              <QuickAnswer
                icon={<UserRound className="h-4 w-4" />}
                title="Öz hesabın"
                value={accountBest ? monthly(accountBest.fromPerMonthAzn) : money(accountPricing?.fromPerMonthAzn ?? null)}
                tone="account"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Netflix alış modeli seçimi">
        {choices.map((choice) => {
          const isAccount = choice.accent === "hesab";
          const summary = byAccent(pricing, choice.accent);
          return (
            <ChoiceCard
              key={choice.title}
              choice={choice}
              href={choiceHref(choice, basePath)}
              pricing={summary}
              isAccount={isAccount}
            />
          );
        })}
      </section>

      {cabinet && account && (
        <section className="space-y-4">
          <SectionHeading eyebrow="Müqayisə" title="Bir baxışda fərq" />
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/[0.82] shadow-2xl">
            <div className="grid grid-cols-[1fr_1fr] border-b border-white/10 bg-white/[0.035] md:grid-cols-[220px_1fr_1fr]">
              <div className="hidden px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 md:block">
                Detal
              </div>
              <CompareHead
                icon={<KeyRound className="h-4 w-4" />}
                title="Kabinet"
                price={cabinetPricing?.fromPerMonthAzn ?? null}
                tone="cabinet"
              />
              <CompareHead
                icon={<UserRound className="h-4 w-4" />}
                title="Öz hesabın"
                price={accountPricing?.fromPerMonthAzn ?? null}
                tone="account"
              />
            </div>

            {DIFFERENCE_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_1fr] border-b border-white/[0.07] last:border-b-0 md:grid-cols-[220px_1fr_1fr]"
              >
                <div className="col-span-2 border-b border-white/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500 md:col-span-1 md:border-b-0 md:px-5 md:py-4">
                  {row.label}
                </div>
                <CompareCell tone="cabinet">{row.kabinet}</CompareCell>
                <CompareCell tone="account">{row.hesab}</CompareCell>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-300/25 bg-violet-500/10 text-violet-100">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
                Qısa seçim
              </p>
              <h3 className="mt-0.5 text-xl font-black text-white">Hansını götürüm?</h3>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <FitTile title="Ən sərfəli" body="Yanımda" icon={<Wallet className="h-4 w-4" />} />
            <FitTile title="TV-də izləyəcəm" body="Evimdə VIP" icon={<Tv className="h-4 w-4" />} />
            <FitTile title="Öz mailim olsun" body="Hesab almaq" icon={<Mail className="h-4 w-4" />} />
            <FitTile title="Hazır giriş istəyirəm" body="Kabinet" icon={<ShieldCheck className="h-4 w-4" />} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/[0.82] px-5 shadow-2xl sm:px-7">
          <div className="border-b border-white/10 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">FAQ</p>
            <h3 className="mt-1 text-2xl font-black text-white">Tez suallar</h3>
          </div>

          <div className="divide-y divide-white/10">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-bold text-zinc-100 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180 group-open:text-white" />
                </summary>
                <p className="pb-4 text-sm leading-6 text-zinc-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ChoiceCard({
  choice,
  href,
  pricing,
  isAccount,
}: {
  choice: StreamingGroupChoice;
  href: string;
  pricing: StreamingGroupChoicePricing | null;
  isAccount: boolean;
}) {
  const Icon = isAccount ? UserRound : KeyRound;
  const title = isAccount ? "Öz hesabın" : "Hazır kabinet";
  const line = isAccount ? "Öz Netflix mailinə aktivləşir" : "Giriş məlumatı hazır gəlir";
  const cta = isAccount ? "Hesab planlarına bax" : "Kabinetləri müqayisə et";
  const featureIcons = isAccount
    ? [Mail, BadgeCheck, Tv]
    : [Zap, Wallet, ShieldCheck];
  const startingPlan = cheapestPlan(pricing);
  const startingPrice = startingPlan?.fromPerMonthAzn ?? pricing?.fromPerMonthAzn ?? null;

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border p-5 shadow-2xl sm:p-6 ${
        isAccount ? "border-red-500/30 bg-[#150607]" : "border-violet-300/[0.24] bg-[#0b0913]"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          isAccount
            ? "bg-[radial-gradient(circle_at_82%_8%,rgba(229,9,20,0.22),transparent_42%)]"
            : "bg-[radial-gradient(circle_at_82%_8%,rgba(124,58,237,0.18),transparent_42%)]"
        }`}
      />

      <div className="relative flex h-full flex-col">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${
                isAccount
                  ? "border-red-300/30 bg-red-500/10 text-red-100"
                  : "border-violet-300/25 bg-violet-500/10 text-violet-100"
              }`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p
                className={`text-xs font-bold uppercase tracking-[0.18em] ${
                  isAccount ? "text-red-200" : "text-violet-200"
                }`}
              >
                {title}
              </p>
              <h3 className="mt-1 text-2xl font-black leading-tight text-white">
                {choice.title.replace(" istəyirəm", "")}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">{line}</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs font-bold text-zinc-500">Başlanğıc</p>
            <p className="mt-1 text-2xl font-black text-white tabular-nums">
              {money(startingPrice)}
            </p>
          </div>
        </header>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          {choice.points.map((point, index) => {
            const FeatureIcon = featureIcons[index] ?? Check;
            const plan = isAccount ? planForPoint(pricing, point) : null;
            return (
              <span
                key={point}
                className="inline-flex min-h-[58px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-bold text-zinc-100"
              >
                <FeatureIcon
                  className={`h-4 w-4 shrink-0 ${
                    isAccount ? "text-red-200" : "text-emerald-300"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block truncate">{point}</span>
                  {isAccount && (
                    <span className="mt-0.5 block truncate text-xs font-black text-zinc-400 tabular-nums">
                      {monthly(plan?.fromPerMonthAzn ?? null)}
                    </span>
                  )}
                </span>
              </span>
            );
          })}
        </div>

        <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
          {(pricing?.plans.length ? pricing.plans : []).map((plan) => (
            <PlanPreview key={plan.name} plan={plan} />
          ))}
          {!pricing?.plans.length && (
            <div className="py-4 text-sm font-semibold text-zinc-500">
              Planlar tezliklə görünəcək.
            </div>
          )}
        </div>

        <Link
          href={href}
          className={`mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition ${
            isAccount
              ? "bg-red-600 hover:bg-red-500"
              : "bg-gradient-to-r from-violet-700 to-blue-600 hover:from-violet-600 hover:to-blue-500"
          }`}
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function PlanPreview({
  plan,
}: {
  plan: StreamingGroupChoicePricing["plans"][number];
}) {
  const hasPrice = plan.fromPerMonthAzn != null;
  const content = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-zinc-100">{plan.name}</span>
        {plan.note && <span className="block truncate text-xs text-zinc-500">{plan.note}</span>}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-white tabular-nums">
        {monthly(plan.fromPerMonthAzn)}
        {hasPrice && <ChevronRight className="h-4 w-4 text-zinc-500" />}
      </span>
    </>
  );

  if (!hasPrice) {
    return <div className="flex items-center justify-between gap-3 py-3 opacity-75">{content}</div>;
  }

  return (
    <Link
      href={plan.href}
      className="group flex items-center justify-between gap-3 py-3 transition hover:bg-white/[0.025]"
    >
      {content}
    </Link>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">{eyebrow}</p>
      <h3 className="mt-2 text-3xl font-black text-white sm:text-4xl">{title}</h3>
    </header>
  );
}

function QuickAnswer({
  icon,
  title,
  value,
  tone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  tone: "cabinet" | "account";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            tone === "cabinet" ? "bg-violet-500/[0.12] text-violet-100" : "bg-red-500/[0.12] text-red-100"
          }`}
        >
          {icon}
        </span>
        <span className="truncate text-sm font-black text-white">{title}</span>
      </span>
      <span className="shrink-0 text-sm font-black text-zinc-200 tabular-nums">{value}</span>
    </div>
  );
}

function CompareHead({
  icon,
  title,
  price,
  tone,
}: {
  icon: ReactNode;
  title: string;
  price: number | null;
  tone: "cabinet" | "account";
}) {
  return (
    <div
      className={`px-4 py-4 ${
        tone === "cabinet" ? "bg-violet-500/[0.055]" : "bg-red-500/[0.055]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            tone === "cabinet" ? "bg-violet-500/[0.12] text-violet-100" : "bg-red-500/[0.12] text-red-100"
          }`}
        >
          {icon}
        </span>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="mt-0.5 text-xs font-bold text-zinc-500">{monthly(price)}</p>
        </div>
      </div>
    </div>
  );
}

function CompareCell({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "cabinet" | "account";
}) {
  const Icon = tone === "cabinet" ? Monitor : BadgeCheck;
  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-2.5">
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            tone === "cabinet" ? "text-violet-300" : "text-red-300"
          }`}
        />
        <p className="text-sm font-semibold leading-5 text-zinc-200">{children}</p>
      </div>
    </div>
  );
}

function FitTile({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-zinc-400">
        {icon}
        <span className="text-xs font-bold uppercase tracking-[0.14em]">{title}</span>
      </div>
      <p className="mt-2 text-lg font-black text-white">{body}</p>
    </div>
  );
}
