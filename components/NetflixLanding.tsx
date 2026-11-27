import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CreditCard,
  KeyRound,
  ListChecks,
  Lock,
  Mail,
  PlayCircle,
  Smile,
  Tv,
  UserRound,
  X,
} from "lucide-react";
import type { ShowcaseBrand, ShowcaseGroup } from "@/lib/homeSubscriptionShowcase";
import { NETFLIX_ACCOUNT_STORE_PATH } from "@/lib/homeSubscriptionShowcase";
import { NETFLIX_STORE_PATH } from "@/lib/storeScope";
import HomePlanGuide from "./HomePlanGuide";
import { BRAND_MARK, PlanGroup } from "./ShowcasePlanCards";

/**
 * `/streaming/netflix` (seçim addımı, `?secim=` yoxdur). Əvvəl iki mətn kartı idi və müştəri "otaq" ilə
 * "öz hesab"ın fərqini başa düşmürdü (2026-11). İndi: iki yol şəkillə ([ProfilesArt] — Netflix-in "Kim
 * izləyir?" ekranı, [OwnAccountArt] — plan öz hesabına), bütün planlar ana səhifə kartları ilə, müqayisə
 * cədvəli və addımlar. Data ana səhifə vitrini ilə eynidir (`buildNetflixShowcase`) — qiymət, link, kart.
 *
 * ⚠️ İllüstrasiyaların rəngləri `style`-dadır: açıq temada `globals.css` `.text-white`-ı tündə çevirir,
 * şəkil isə həmişə tünd qalmalıdır. Mətndəki faktlar `StreamingPlanPicker` şərtləri və
 * `STREAMING_VARIANTS`-dandır — yeni iddia (çatdırılma vaxtı və s.) yazmazdan əvvəl orada yoxla.
 */

const WHITE = "#ffffff";
const fmt = (azn: number) => azn.toFixed(2);

function groupFrom(group: ShowcaseGroup | undefined): number | null {
  const offers = group?.rows.flatMap((r) => r.offers) ?? [];
  return offers.length ? Math.min(...offers.map((o) => o.perMonthAzn)) : null;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

export default function NetflixLanding({ brand }: { brand: ShowcaseBrand }) {
  const otaq = brand.groups.find((g) => g.key === "otaq");
  const hesab = brand.groups.find((g) => g.key === "hesab");
  const otaqFrom = groupFrom(otaq);
  const hesabFrom = groupFrom(hesab);
  const allMonths = brand.groups.flatMap((g) => g.rows.flatMap((r) => r.offers.map((o) => o.months)));
  const minMonths = Math.min(...allMonths);
  const maxMonths = Math.max(...allMonths);

  // Otaq planları: TV-siz (Yanımda) və TV-li (Evimdə, VIP) — adlar qapaqdakı `headline`-dır.
  const otaqTvLess = uniq(
    (otaq?.rows ?? []).filter((r) => r.visual.devices.some((d) => d.key === "tv" && !d.allowed)).map((r) => r.visual.headline),
  );
  const otaqTv = uniq(
    (otaq?.rows ?? []).filter((r) => r.visual.devices.some((d) => d.key === "tv" && d.allowed)).map((r) => r.visual.headline),
  );
  // Hesab planları: "Basic 720p · Standart 1080p · Premium 4K" — yalnız satılanlar.
  const hesabTiers = uniq((hesab?.rows ?? []).map((r) => `${r.title} ${r.visual.headline}`));
  const hesabQualities = uniq((hesab?.rows ?? []).map((r) => r.visual.headline));
  const otaqCheaper = otaqFrom != null && hesabFrom != null && otaqFrom < hesabFrom;

  const choices = [
    otaq && otaqFrom != null
      ? {
          key: "otaq",
          art: <ProfilesArt />,
          tag: otaqCheaper ? "Ən sərfəli yol" : null,
          title: "Bizim hesabda sənə aid otaq",
          lead: "Hesab bizimdir — ondan sənə ayrıca profil (otaq) veririk. Netflix hesabın olmasa da olar.",
          points: [
            "Mail, şifrə və PIN-i biz göndəririk",
            "4K Ultra HD keyfiyyət",
            "Otağının adını və PIN-ini özün dəyişə bilərsən",
            otaqTvLess.length && otaqTv.length
              ? `${otaqTvLess.join(", ")} — TV-siz; ${otaqTv.join(", ")} — TV ilə`
              : "Hər nəfərə ayrıca otaq",
          ],
          from: otaqFrom,
          href: `${NETFLIX_STORE_PATH}?secim=kabinet`,
          cta: "Otaq seç",
        }
      : null,
    hesab && hesabFrom != null
      ? {
          key: "hesab",
          art: <OwnAccountArt plan={hesab.rows[hesab.rows.length - 1]?.title ?? "Premium"} />,
          tag: null,
          title: "Öz hesabına plan",
          lead: "Plan sənin Netflix hesabına aktivləşir — profillərin, siyahın və baxış tarixçən yerində qalır.",
          points: [
            "Alışda hesabının e-poçtunu və şifrəsini yazırsan",
            hesabTiers.join(" · "),
            "Netflix qaydası: hesab bir ev üçündür",
            "Azərbaycanda yaşayanlar üçün uyğundur",
          ],
          from: hesabFrom,
          href: NETFLIX_ACCOUNT_STORE_PATH,
          cta: "Plan seç",
        }
      : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  const facts = [
    `Ayda ${fmt(brand.fromPerMonthAzn)} ₼-dan`,
    minMonths === maxMonths ? `${minMonths} ay` : `${minMonths} aydan ${maxMonths} aya`,
    ...(otaq ? ["Otaqda 4K Ultra HD"] : []),
  ];

  const compare: Array<{ label: string; otaq: Cell; hesab: Cell }> = [
    { label: "Hesab kimindir?", otaq: "Bizim (Premium hesab)", hesab: "Sənin" },
    {
      label: "Səndən nə lazımdır?",
      otaq: "Heç nə — mail, şifrə və PIN-i biz göndəririk",
      hesab: "Hesabının e-poçtu və şifrəsi",
    },
    { label: "Keyfiyyət", otaq: "4K Ultra HD", hesab: `Plana görə: ${hesabQualities.join(" / ")}` },
    {
      label: "TV-də izləmək",
      otaq: otaqTvLess.length && otaqTv.length ? `${otaqTv.join(", ")} — bəli; ${otaqTvLess.join(", ")} — yox` : "Plana görə",
      hesab: true,
    },
    { label: "Neçə nəfər?", otaq: "Hər nəfərə ayrıca otaq", hesab: "Bir ev daxilində, plana görə" },
    {
      label: "Qiymət",
      otaq: otaqFrom != null ? `Ayda ${fmt(otaqFrom)} ₼-dan` : "—",
      hesab: hesabFrom != null ? `Ayda ${fmt(hesabFrom)} ₼-dan` : "—",
    },
  ];

  const steps = [
    {
      Icon: ListChecks,
      title: "Planı seç",
      body: "Otaq və ya öz hesabın, sonra neçə nəfər və neçə ay.",
    },
    { Icon: CreditCard, title: "Ödənişi et", body: "Səbətdə kartla və ya balansınla ödə." },
    {
      Icon: PlayCircle,
      title: "İzləməyə başla",
      body: "Otaqda mail, şifrə və PIN-i sənə göndəririk; öz hesabında plan hesabına aktivləşir.",
    },
  ];

  return (
    // Eni səhifə konteyneridir (navbar/footer ilə eyni kənar) — burada max-w VERMƏ.
    <div className="space-y-12 sm:space-y-16">
      {/* ── Başlıq ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- 1 KB webp */}
          <img
            src={BRAND_MARK.netflix.src}
            alt=""
            width={64}
            height={64}
            decoding="async"
            className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16"
          />
          <div className="min-w-0">
            <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              Netflix-i necə istəyirsən?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              İki yol var: <span className="font-bold text-zinc-200">bizim hesabda sənə aid otaq</span> və ya{" "}
              <span className="font-bold text-zinc-200">plan öz Netflix hesabına</span>. Fərqi aşağıda şəkillə
              göstərmişik.
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-2">
          {facts.map((f) => (
            <li
              key={f}
              className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-bold text-zinc-200"
            >
              {f}
            </li>
          ))}
        </ul>
      </header>

      {/* ── İki yol ───────────────────────────────────────────── */}
      <section aria-label="İki yol" className={`grid gap-4 ${choices.length > 1 ? "md:grid-cols-2" : ""}`}>
        {choices.map((c, i) => (
          <article
            key={c.key}
            className="group flex flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60 transition hover:border-violet-400/60"
          >
            <div className="relative h-52 sm:h-60">
              {c.art}
              <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-zinc-950/85 px-2.5 py-1 text-[11px] font-black text-white">
                {i + 1}-ci yol
              </span>
              {c.tag && (
                <span
                  className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-black"
                  style={{ background: "#10b981", color: WHITE }}
                >
                  {c.tag}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <h3 className="text-xl font-black leading-tight text-white sm:text-2xl">{c.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{c.lead}</p>
              <ul className="mt-4 flex-1 space-y-2.5">
                {c.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm font-medium text-zinc-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
                <span className="text-sm text-zinc-400">
                  Ayda <span className="text-xl font-black tabular-nums text-white">{fmt(c.from)} ₼</span>-dan
                </span>
                <Link
                  href={c.href}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500"
                >
                  {c.cta}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* ── Bütün planlar ─────────────────────────────────────── */}
      <section id="planlar" aria-labelledby="planlar-basliq" className="scroll-mt-24">
        <h2 id="planlar-basliq" className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          Bütün planlar
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Karta toxun — plan seçili açılır, müddəti orada dəyişirsən.</p>
        {brand.guide && <HomePlanGuide guide={brand.guide} />}
        <div className="mt-6 space-y-8">
          {[otaq, hesab]
            .filter((g): g is ShowcaseGroup => Boolean(g))
            .map((group) => (
              <PlanGroup key={group.key} brand="netflix" brandTitle={brand.title} group={group} />
            ))}
        </div>
      </section>

      {/* ── Müqayisə ──────────────────────────────────────────── */}
      {otaq && hesab && (
        <section aria-labelledby="ferq-basliq">
          <h2 id="ferq-basliq" className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Fərq bir baxışda
          </h2>
          <div className="mt-5 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/60">
            <div className="grid grid-cols-2 border-b border-zinc-800 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <span className="hidden sm:block" />
              <ColumnHead Icon={UserRound} title="Sənə aid otaq" />
              <ColumnHead Icon={KeyRound} title="Öz hesabına plan" />
            </div>
            {compare.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-2 border-b border-zinc-800 last:border-b-0 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <p className="col-span-2 px-4 pt-3 text-xs font-bold text-zinc-500 sm:col-span-1 sm:py-4 sm:text-sm">
                  {row.label}
                </p>
                <CompareCell value={row.otaq} />
                <CompareCell value={row.hesab} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Addımlar ──────────────────────────────────────────── */}
      <section aria-labelledby="addimlar-basliq">
        <h2 id="addimlar-basliq" className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          Necə alınır?
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {steps.map(({ Icon, title, body }, i) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-white">
                  {i + 1}. {title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-zinc-400">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

type Cell = string | boolean;

function ColumnHead({ Icon, title }: { Icon: typeof Tv; title: string }) {
  return (
    <p className="flex items-center gap-2 px-4 py-3 text-sm font-black text-white sm:py-4">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      {title}
    </p>
  );
}

function CompareCell({ value }: { value: Cell }) {
  if (typeof value === "boolean") {
    return (
      <p className="flex items-center gap-1.5 px-4 pb-3 pt-1 text-sm font-semibold text-zinc-200 sm:py-4">
        {value ? (
          <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden />
        ) : (
          <X className="h-4 w-4 text-rose-500" aria-hidden />
        )}
        {value ? "Bəli" : "Xeyr"}
      </p>
    );
  }
  return <p className="px-4 pb-3 pt-1 text-sm font-semibold leading-6 text-zinc-200 sm:py-4">{value}</p>;
}

/** Netflix-in "Kim izləyir?" ekranı: başqalarının otağı PIN-li, biri — sənin. */
function ProfilesArt() {
  const profiles = [
    { color: "#2563eb", me: false },
    { color: "#e50914", me: true },
    { color: "#eab308", me: false },
    { color: "#14b8a6", me: false },
  ];
  return (
    <div
      className="flex h-full flex-col items-center justify-center px-4 pt-6"
      style={{
        background: "radial-gradient(80% 70% at 50% 0%, rgba(229,9,20,0.35), transparent 70%), #0b0b0b",
        color: WHITE,
      }}
      aria-hidden
    >
      <p className="text-base font-bold sm:text-lg" style={{ color: "rgba(255,255,255,0.92)" }}>
        Kim izləyir?
      </p>
      <ul className="mt-4 flex items-start justify-center gap-3 sm:gap-4">
        {profiles.map((p, i) => (
          <li key={i} className="flex w-14 flex-col items-center gap-1.5 sm:w-16">
            <span
              className="relative grid aspect-square w-full place-items-center rounded-lg"
              style={{
                background: p.color,
                opacity: p.me ? 1 : 0.45,
                boxShadow: p.me ? "0 0 0 3px #ffffff" : undefined,
              }}
            >
              <Smile className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: "rgba(0,0,0,0.55)" }} />
              {!p.me && (
                <span
                  className="absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full"
                  style={{ background: "#18181b", color: WHITE }}
                >
                  <Lock className="h-3 w-3" />
                </span>
              )}
            </span>
            <span
              className="text-[11px] font-bold"
              style={{ color: p.me ? WHITE : "rgba(255,255,255,0.5)" }}
            >
              {p.me ? "Sən" : "PIN-li"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
        Hesab bizimdir · <span style={{ color: WHITE, fontWeight: 800 }}>otaq yalnız sənindir</span>
      </p>
    </div>
  );
}

/** Öz hesabın: e-poçt + şifrə → plan həmin hesaba aktivləşir. */
function OwnAccountArt({ plan }: { plan: string }) {
  const field = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  } as const;
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 px-4 pt-6"
      style={{
        background: "radial-gradient(80% 70% at 50% 0%, rgba(139,92,246,0.35), transparent 70%), #0b0b0b",
        color: WHITE,
      }}
      aria-hidden
    >
      <div className="w-full max-w-[240px] rounded-xl p-2.5" style={field}>
        <p className="text-[10px] font-black" style={{ color: "rgba(255,255,255,0.6)" }}>
          Sənin Netflix hesabın
        </p>
        <p className="mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold" style={field}>
          <Mail className="h-3.5 w-3.5 shrink-0" /> sənin@mail.com
        </p>
        <p className="mt-1.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold tracking-widest" style={field}>
          <KeyRound className="h-3.5 w-3.5 shrink-0" /> ••••••••
        </p>
      </div>
      <ArrowDown className="h-4 w-4" style={{ color: "rgba(255,255,255,0.6)" }} />
      <p
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black"
        style={{ background: "#10b981", color: WHITE }}
      >
        <Check className="h-3.5 w-3.5" /> {plan} aktivdir
      </p>
    </div>
  );
}
