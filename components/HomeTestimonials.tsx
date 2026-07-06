import { Sparkles } from "lucide-react";
import HomeReviewCta from "@/components/HomeReviewCta";
import TestimonialsRail from "@/components/TestimonialsRail";
import { getPublicTestimonials } from "@/lib/publicTestimonials";

/** Ana səhifədə server-side səhifələnən və client-də filtrlənən rəy lenti. */
export default async function HomeTestimonials() {
  const initialData = await getPublicTestimonials().catch(() => null);
  if (!initialData || initialData.total === 0) return null;

  return (
    <section id="reyler" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <HomeReviewCta />
        <div className="mx-auto mb-7 flex w-fit max-w-2xl items-start gap-2 rounded-2xl border border-violet-200/70 bg-violet-50/70 px-4 py-2.5 text-xs leading-relaxed text-violet-900 dark:border-violet-300/15 dark:bg-violet-400/[0.07] dark:text-violet-200">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>
            Rəylərdəki orfoqrafik və durğu səhvləri məna dəyişdirilmədən AI
            tərəfindən düzəldilə bilər.
          </p>
        </div>
        <TestimonialsRail initialData={initialData} />
      </div>
    </section>
  );
}
