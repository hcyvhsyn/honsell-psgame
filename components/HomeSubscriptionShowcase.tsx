import Link from "next/link";
import { ArrowRight, Music2, Tv } from "lucide-react";
import type { ShowcaseBrand, ShowcaseRow } from "@/lib/homeSubscriptionShowcase";
import HomePlanGuide from "./HomePlanGuide";

/**
 * Ana səhifədə Netflix və Spotify — hər plan (sətir) BİR yığcam kartdır: "ayda X ₼-dan" + müddətlər.
 * Kart planın ilk (ən qısa) müddətinin `?mehsul=` linkidir; müddəti müştəri alış səhifəsində dəyişir.
 * (2026-11: əvvəl hər müddət ayrıca kart idi — Netflix bloku telefonda ~2.5 ekran tuturdu.)
 * Data: `lib/homeSubscriptionShowcase.ts`. Yeganə client hissə "Aralarındakı fərq nədir?" modalıdır.
 *
 * ⚠️ Performans: kartlarda şəkil və `backdrop-blur` YOXDUR.
 */
export default function HomeSubscriptionShowcase({ brands }: { brands: ShowcaseBrand[] }) {
  if (brands.length === 0) return null;
  return (
    <div className="space-y-6 py-6 sm:space-y-8 sm:py-8">
      {brands.map((brand) => (
        <BrandPanel key={brand.key} brand={brand} />
      ))}
    </div>
  );
}

const BRAND_ICON = {
  netflix: { Icon: Tv, tile: "bg-rose-600" },
  spotify: { Icon: Music2, tile: "bg-emerald-600" },
} as const;

const fmt = (azn: number) => azn.toFixed(2);

function BrandPanel({ brand }: { brand: ShowcaseBrand }) {
  const { Icon, tile } = BRAND_ICON[brand.key];
  return (
    <section id={brand.key} aria-labelledby={`${brand.key}-basliq`} className="scroll-mt-24">
      <div className="site-container">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white ${tile}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`${brand.key}-basliq`} className="text-xl font-black tracking-tight text-white sm:text-2xl">
                {brand.title}
              </h2>
              <p className="text-sm font-medium text-zinc-400">
                {brand.subtitle} · ayda {fmt(brand.fromPerMonthAzn)} ₼-dan
              </p>
            </div>
            <Link
              href={brand.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-violet-400/60 hover:text-white"
            >
              Ətraflı
              <ArrowRight className="h-4 w-4" />
            </Link>
          </header>

          {/* "Aralarındakı fərq nədir?" — qiymətlərdən ƏVVƏL: müştəri planı seçməzdən qabaq fərqi görsün. */}
          {brand.guide && <HomePlanGuide guide={brand.guide} />}

          <div className="mt-5 space-y-5">
            {brand.groups.map((group) => (
              <div key={group.key}>
                {group.title && (
                  <h3 className="mb-2 text-xs font-black tracking-[0.12em] text-zinc-500">{group.title}</h3>
                )}
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {group.rows.map((row) => (
                    <PlanTile key={row.key} brandTitle={brand.title} row={row} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanTile({ brandTitle, row }: { brandTitle: string; row: ShowcaseRow }) {
  const first = row.offers[0];
  if (!first) return null;
  const minPerMonth = Math.min(...row.offers.map((o) => o.perMonthAzn));
  const maxSaving = Math.max(0, ...row.offers.map((o) => o.savingPct));
  const months = row.offers.map((o) => o.months);
  const single = row.offers.length === 1;
  return (
    <li>
      <Link
        href={first.href}
        aria-label={`${brandTitle} ${row.title} — ayda ${fmt(minPerMonth)} ₼-dan`}
        className="group flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-3 transition hover:-translate-y-0.5 hover:border-violet-400/60"
      >
        {/* Ad iki sətrə qədər sığır ("Evimdə VIP · 2 nəfər" kəsilməsin); endirim nişanı qiymətin yanındadır. */}
        <span className="line-clamp-2 text-sm font-black leading-tight text-white">{row.title}</span>
        {row.caption && (
          <span className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug text-zinc-500">{row.caption}</span>
        )}
        <span className="mt-auto flex flex-wrap items-baseline gap-x-1.5 gap-y-1 pt-3">
          <span className="text-lg font-black leading-none tabular-nums text-white">
            {single ? `${fmt(first.priceAzn)} ₼` : `${fmt(minPerMonth)} ₼`}
          </span>
          <span className="text-xs font-semibold text-zinc-500">{single ? `/ ${first.months} ay` : "/ ay-dan"}</span>
          {maxSaving > 0 && (
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-emerald-300">
              −{maxSaving}%
            </span>
          )}
        </span>
        <span className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-zinc-500">
          <span className="truncate">{months.join(" · ")} ay</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-violet-300 transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}
