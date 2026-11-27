import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ShowcaseBrand } from "@/lib/homeSubscriptionShowcase";
import HomePlanGuide from "./HomePlanGuide";
import { BRAND_MARK, PlanGroup } from "./ShowcasePlanCards";

/**
 * Ana səhifədə Netflix və Spotify — "Abunəliklər" matrisi ilə EYNİ kart dizaynı (2026-11): hər plan
 * (sətir) bir kartdır, kvadrat qapağı koddan çəkilir və planın fərqini göstərir ([ShowcasePlanCards]).
 * Kart planın ilk (ən qısa) müddətinin `?mehsul=` linkidir; müddəti müştəri alış səhifəsində dəyişir.
 * Data: `lib/homeSubscriptionShowcase.ts`. Yeganə client hissə "Aralarındakı fərq nədir?" modalıdır.
 *
 * Ayrıca çərçivəli panel YOXDUR — kartlar matrislə eyni şəbəkədə, eyni kənar xəttindədir.
 * ⚠️ Performans: kartlarda şəkil faylı (brend işarəsi 1–3 KB webp-dən başqa) və `backdrop-blur` yoxdur.
 */
export default function HomeSubscriptionShowcase({ brands }: { brands: ShowcaseBrand[] }) {
  if (brands.length === 0) return null;
  return (
    <div className="space-y-10 pb-10 pt-4 sm:space-y-12 sm:pb-12">
      {brands.map((brand) => (
        <BrandBlock key={brand.key} brand={brand} />
      ))}
    </div>
  );
}

const fmt = (azn: number) => azn.toFixed(2);

function BrandBlock({ brand }: { brand: ShowcaseBrand }) {
  const mark = BRAND_MARK[brand.key];
  return (
    <section id={brand.key} aria-labelledby={`${brand.key}-basliq`} className="scroll-mt-24">
      <div className="site-container">
        <header className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- 1–3 KB webp */}
          <img src={mark.src} alt="" width={44} height={44} loading="lazy" decoding="async" className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h3 id={`${brand.key}-basliq`} className="text-xl font-black tracking-tight text-white sm:text-2xl">
              {brand.title}
            </h3>
            <p className="text-sm font-medium text-zinc-400">
              {brand.subtitle} · ayda {fmt(brand.fromPerMonthAzn)} ₼-dan
            </p>
          </div>
          <Link
            href={brand.href}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-violet-700 transition hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200"
          >
            Ətraflı <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {/* "Aralarındakı fərq nədir?" — qiymətlərdən ƏVVƏL: müştəri planı seçməzdən qabaq fərqi görsün. */}
        {brand.guide && <HomePlanGuide guide={brand.guide} />}

        <div className="mt-5 space-y-6">
          {brand.groups.map((group) => (
            <PlanGroup key={group.key} brand={brand.key} brandTitle={brand.title} group={group} headingLevel="h4" />
          ))}
        </div>
      </div>
    </section>
  );
}
