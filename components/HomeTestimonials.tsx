import HomeReviewCta from "@/components/HomeReviewCta";
import TestimonialsRail from "@/components/TestimonialsRail";
import { getPublicTestimonials } from "@/lib/publicTestimonials";

/**
 * Ana səhifə rəyləri — yığcam lent (ilk 6 rəy) + "Bütün rəylər" → /reyler.
 * Axtarış/filtr/səhifələmə və "AI düzəldə bilər" qeydi qəsdən yoxdur: bunlar /reyler-in işidir.
 */
export default async function HomeTestimonials() {
  const initialData = await getPublicTestimonials().catch(() => null);
  if (!initialData || initialData.total === 0) return null;

  return (
    <section id="reyler" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
          Müştərilər nə deyir
        </h2>
        <HomeReviewCta />
        <TestimonialsRail initialData={initialData} compact />
      </div>
    </section>
  );
}
