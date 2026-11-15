import Link from "next/link";
import { ArrowRight, Music2, Tv } from "lucide-react";
import type { ShowcaseBrand, ShowcaseOffer, ShowcaseRow } from "@/lib/homeSubscriptionShowcase";

/**
 * Ana səhifədə Netflix və Spotify — hər plan bir sətir, hər müddət ayrıca kart
 * (`lib/homeSubscriptionShowcase.ts`). Server komponentidir: kart linkdir, JS yoxdur.
 *
 * ⚠️ Performans: kartlarda şəkil və `backdrop-blur` YOXDUR (onlarla kart təkrarlanır).
 */
export default function HomeSubscriptionShowcase({ brands }: { brands: ShowcaseBrand[] }) {
  if (brands.length === 0) return null;
  return (
    <div className="space-y-6 py-10 sm:space-y-8 sm:py-12">
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

          <div className="mt-5 space-y-6">
            {brand.groups.map((group) => (
              <div key={group.key}>
                {group.title && (
                  <h3 className="mb-1 text-xs font-black tracking-[0.12em] text-zinc-500">{group.title}</h3>
                )}
                <div className="divide-y divide-zinc-800">
                  {group.rows.map((row) => (
                    <PlanRow key={row.key} brandTitle={brand.title} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PlanRow({ brandTitle, row }: { brandTitle: string; row: ShowcaseRow }) {
  return (
    <div className="grid gap-x-5 gap-y-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-base font-black text-white">{row.title}</p>
        {row.caption && <p className="truncate text-xs font-semibold text-zinc-500">{row.caption}</p>}
      </div>
      {/* pt-3: "Ən sərfəli" nişanı kartın üstündən çıxır, overflow-x onu kəsməsin. */}
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {row.offers.map((offer) => (
          <OfferCard key={offer.id} label={`${brandTitle} ${row.title}`} offer={offer} />
        ))}
      </ul>
    </div>
  );
}

function OfferCard({ label, offer }: { label: string; offer: ShowcaseOffer }) {
  return (
    <li className="w-[8.75rem] shrink-0 snap-start sm:w-[9.5rem]">
      <Link
        href={offer.href}
        aria-label={`${label} — ${offer.months} ay, ${fmt(offer.priceAzn)} ₼`}
        className={`group relative flex h-full flex-col rounded-2xl border bg-zinc-950 p-3 transition hover:-translate-y-0.5 ${
          offer.best ? "border-emerald-500/50 hover:border-emerald-400" : "border-zinc-800 hover:border-violet-400/60"
        }`}
      >
        {offer.best && (
          // `uppercase` YOX — "Ə" böyük hərfi şriftdə kiçik "ə" kimi görünür.
          <span className="absolute -top-2.5 left-2.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white">
            Ən sərfəli
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-black text-white">{offer.months} ay</span>
          {offer.savingPct > 0 && (
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-emerald-600 dark:text-emerald-300">
              −{offer.savingPct}%
            </span>
          )}
        </span>
        <span className="mt-2 text-xl font-black leading-none tabular-nums text-white">{fmt(offer.priceAzn)} ₼</span>
        <span className="mt-1 text-[11px] font-semibold tabular-nums text-zinc-500">
          {offer.originalAzn != null ? (
            <span className="mr-1 line-through">{fmt(offer.originalAzn)} ₼</span>
          ) : null}
          {offer.months > 1 ? `ayda ${fmt(offer.perMonthAzn)} ₼` : offer.originalAzn != null ? null : "aylıq"}
        </span>
        {/* Mobildə gizli — kartın özü toxunulandır, sətirlər qısa qalsın. */}
        <span className="mt-3 hidden items-center gap-1 text-xs font-bold text-violet-600 transition group-hover:gap-1.5 dark:text-violet-300 sm:inline-flex">
          Seç
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </li>
  );
}
