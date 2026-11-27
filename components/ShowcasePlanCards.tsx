import Link from "next/link";
import { ArrowRight, Laptop, Monitor, Smartphone, Tablet, Tv, UserRound } from "lucide-react";
import type { ShowcaseBrand, ShowcaseDevice, ShowcaseGroup, ShowcaseRow, ShowcaseVisual } from "@/lib/homeSubscriptionShowcase";

/**
 * Netflix / Spotify plan kartı — ana səhifədəki "Abunəliklər" matrisi ([HomeProductMatrix]) ilə eyni
 * çərçivə: kvadrat şəkil sahəsi + nişan, ad, qiymət, dəyirmi düymə. Şəkil sahəsi FAYL DEYİL, koddan
 * çəkilir ([PlanArt]) — planın fərqini (keyfiyyət, cihazlar, nəfər) göstərir və şəbəkədən heç nə yükləmir.
 * Ana səhifə ([HomeSubscriptionShowcase]) və `/streaming/netflix` ([NetflixLanding]) işlədir.
 *
 * ⚠️ Şəkil sahəsinin rəngləri `style`-dadır: açıq temada `globals.css` `.text-white` / `.bg-zinc-950`-i
 * açıq rəngə çevirir, qapaq isə şəkil kimi həmişə tünd qalmalıdır. Performans: blur və animasiya yoxdur.
 */

export const BRAND_MARK: Record<ShowcaseBrand["key"], { src: string; label: string }> = {
  netflix: { src: "/brands/netflix-n.webp", label: "Netflix" },
  spotify: { src: "/brands/spotify.webp", label: "Spotify" },
};

/** Fon: brend rəngi + plan tonu (base → top daha parlaq; top-a qızılı işıq). */
const ART_BG: Record<ShowcaseBrand["key"], Record<ShowcaseVisual["tone"], string>> = {
  netflix: {
    base: "radial-gradient(120% 90% at 100% 0%, rgba(229,9,20,0.38), transparent 60%), linear-gradient(160deg, #1a0507 0%, #070707 70%)",
    mid: "radial-gradient(120% 90% at 100% 0%, rgba(229,9,20,0.58), transparent 62%), linear-gradient(160deg, #2a070b 0%, #080808 72%)",
    top: "radial-gradient(90% 70% at 0% 0%, rgba(245,158,11,0.30), transparent 60%), radial-gradient(120% 90% at 100% 0%, rgba(229,9,20,0.62), transparent 62%), linear-gradient(160deg, #2b0a0a 0%, #080808 72%)",
  },
  spotify: {
    base: "radial-gradient(120% 90% at 100% 0%, rgba(30,215,96,0.30), transparent 60%), linear-gradient(160deg, #04170b 0%, #070707 70%)",
    mid: "radial-gradient(120% 90% at 100% 0%, rgba(30,215,96,0.48), transparent 62%), linear-gradient(160deg, #06210f 0%, #080808 72%)",
    top: "radial-gradient(90% 70% at 0% 0%, rgba(56,189,248,0.25), transparent 60%), radial-gradient(120% 90% at 100% 0%, rgba(30,215,96,0.55), transparent 62%), linear-gradient(160deg, #06210f 0%, #080808 72%)",
  },
};

const DEVICE_ICON: Record<ShowcaseDevice, { Icon: typeof Tv; label: string }> = {
  phone: { Icon: Smartphone, label: "Telefon" },
  tablet: { Icon: Tablet, label: "Planşet" },
  computer: { Icon: Laptop, label: "Kompüter" },
  tv: { Icon: Tv, label: "TV" },
};

const CARD_ACCENT: Record<ShowcaseBrand["key"], string> = {
  netflix: "border-rose-300/20 hover:border-rose-300/45",
  spotify: "border-emerald-300/20 hover:border-emerald-300/45",
};

const WHITE = "#ffffff";
const fmt = (azn: number) => azn.toFixed(2);

function headlineSize(text: string): string {
  if (text.length <= 3) return "text-5xl sm:text-6xl";
  if (text.length <= 5) return "text-4xl sm:text-5xl";
  if (text.length <= 7) return "text-3xl";
  return "text-2xl";
}

/** Kvadrat qapaq: nişan, brend işarəsi, iri yazı, cihazlar, nəfər/ekran sayı, endirim. */
export function PlanArt({
  brand,
  visual,
  saving,
}: {
  brand: ShowcaseBrand["key"];
  visual: ShowcaseVisual;
  saving: number;
}) {
  const mark = BRAND_MARK[brand];
  const CountIcon = visual.count.kind === "screens" ? Monitor : UserRound;
  const shownIcons = Math.min(visual.count.n, 4);
  return (
    <div
      className="relative flex aspect-square flex-col overflow-hidden rounded-xl p-2.5"
      style={{ background: ART_BG[brand][visual.tone], color: WHITE }}
    >
      {/* Matrisdəki brend nişanı ilə eyni üslub. */}
      <div className="flex items-start justify-between gap-2">
        <span className="max-w-[calc(100%-2.5rem)] truncate rounded-full border border-white/10 bg-zinc-950/85 px-2 py-1 text-[10px] font-black text-white">
          {visual.badge}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element -- 1–3 KB webp, optimizer lazım deyil */}
        <img
          src={mark.src}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          decoding="async"
          className="h-7 w-7 shrink-0 rounded-lg"
        />
      </div>

      <div className="mt-auto min-w-0">
        <p className={`font-black leading-[0.95] tracking-tight ${headlineSize(visual.headline)}`} style={{ color: WHITE }}>
          {visual.headline}
        </p>
        {visual.tagline && (
          <p className="mt-1 truncate text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
            {visual.tagline}
          </p>
        )}
      </div>

      {visual.devices.length > 0 && (
        <ul className="mt-2 flex gap-1" aria-label="Cihazlar">
          {visual.devices.map(({ key, allowed }) => {
            const { Icon, label } = DEVICE_ICON[key];
            return (
              <li
                key={key}
                title={`${label}: ${allowed ? "olar" : "olmaz"}`}
                className="relative grid h-6 w-6 place-items-center rounded-md"
                style={{
                  background: allowed ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                  color: allowed ? WHITE : "rgba(255,255,255,0.35)",
                }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">
                  {label}: {allowed ? "olar" : "olmaz"}
                </span>
                {!allowed && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 h-[2px] w-7 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full"
                    style={{ background: "#f43f5e" }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-[11px] font-black" style={{ color: "rgba(255,255,255,0.85)" }}>
          <span className="flex shrink-0" aria-hidden>
            {Array.from({ length: shownIcons }, (_, i) => (
              <CountIcon key={i} className={`h-3.5 w-3.5 ${i > 0 ? "-ml-0.5" : ""}`} />
            ))}
          </span>
          <span className="truncate">{visual.count.label}</span>
        </span>
        {saving > 0 && (
          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums" style={{ background: "#10b981", color: WHITE }}>
            −{saving}%
          </span>
        )}
      </div>
    </div>
  );
}

/** Matris kartı formatında plan kartı. Bütün kart linkdir (`?mehsul=` — alış səhifəsi paketi seçili açır). */
export function PlanCard({ brand, brandTitle, row }: { brand: ShowcaseBrand["key"]; brandTitle: string; row: ShowcaseRow }) {
  const first = row.offers[0];
  if (!first) return null;
  const minPerMonth = Math.min(...row.offers.map((o) => o.perMonthAzn));
  const maxSaving = Math.max(0, ...row.offers.map((o) => o.savingPct));
  const single = row.offers.length === 1;
  const months = row.offers.map((o) => o.months).join(" · ");
  return (
    <li className="min-w-0">
      <Link
        href={first.href}
        aria-label={`${brandTitle} ${row.title} — ${single ? `${fmt(first.priceAzn)} ₼` : `ayda ${fmt(minPerMonth)} ₼-dan`}`}
        className={`group flex h-full min-h-[218px] min-w-0 flex-col rounded-2xl border bg-white/[0.035] p-2.5 transition hover:-translate-y-0.5 hover:bg-white/[0.055] ${CARD_ACCENT[brand]}`}
      >
        <PlanArt brand={brand} visual={row.visual} saving={maxSaving} />

        <span className="mt-3 line-clamp-2 text-sm font-black leading-tight text-white">{row.title}</span>
        {/* Cihaz/keyfiyyət qapaqdadır — burada yalnız müddətlər (caption `title`-da qalır). */}
        <p className="mt-1 line-clamp-1 text-xs font-semibold text-zinc-500" title={row.caption || undefined}>
          {single ? "Müddət" : "Müddətlər"}: {months} ay
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {/* İki sətir: telefonda (~170px kart) "6.00₼ / ay-dan" düymənin yanında kəsilirdi. */}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-none text-zinc-500">{single ? "Qiymət" : "Ayda"}</p>
            <p className="mt-1 truncate text-lg font-black leading-none text-white">
              {single ? fmt(first.priceAzn) : fmt(minPerMonth)}₼
              {!single && <span className="text-xs font-semibold text-zinc-500">-dan</span>}
            </p>
          </div>
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-950 transition group-hover:bg-violet-200 dark:border-transparent"
          >
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </li>
  );
}

/**
 * Bir qrupun kartları. Telefonda üfüqi lent (Populyar oyunlar kimi — Netflix bloku ekranları
 * tutmasın), sm+ matrislə eyni şəbəkə (3/4/5/6 sütun).
 */
export function PlanGroup({
  brand,
  brandTitle,
  group,
  headingLevel = "h3",
}: {
  brand: ShowcaseBrand["key"];
  brandTitle: string;
  group: ShowcaseGroup;
  headingLevel?: "h3" | "h4";
}) {
  const Heading = headingLevel;
  return (
    <div>
      {group.title && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <Heading className="text-base font-black text-white">{group.title}</Heading>
          {group.hint && <p className="text-xs font-semibold text-zinc-500">{group.hint}</p>}
        </div>
      )}
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:w-[46%] [&>li]:shrink-0 [&>li]:snap-start sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 sm:[&>li]:w-auto md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {group.rows.map((row) => (
          <PlanCard key={row.key} brand={brand} brandTitle={brandTitle} row={row} />
        ))}
      </ul>
    </div>
  );
}
