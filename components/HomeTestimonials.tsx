import { Star, Quote, BadgeCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import HomeReviewCta from "@/components/HomeReviewCta";

/**
 * Anasayfa müştəri rəyləri. `Testimonial` modeli post-purchase email
 * dəvətləri ilə doldurulur; admin `isActive` ilə təsdiqləyir. Sosial sübut
 * üçün ən güclü konversiya elementlərindən biridir.
 */

const PLATFORM_LABELS: Record<string, string> = {
  GAME: "Oyun",
  PS_PLUS: "PS Plus",
  GIFT_CARD: "Gift Card",
  ACCOUNT_CREATION: "Hesab açma",
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function HomeTestimonials() {
  const testimonials = await prisma.testimonial
    .findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, name: true, avatarUrl: true, text: true, rating: true, platform: true, productTitle: true },
    })
    .catch(() => []);

  // Təsdiqlənmiş rəy yoxdursa bölməni gizlət. "Rəy yaz" düyməsi (HomeReviewCta)
  // user-ə bağlı olduğu üçün client-də gəlir → bu komponent server/statik qalır.
  if (testimonials.length === 0) return null;

  const showGrid = testimonials.length > 0;

  return (
    <section id="reyler" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <HomeReviewCta />
        {showGrid && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => {
            const rating = Math.max(1, Math.min(5, t.rating));
            return (
              <figure
                key={t.id}
                className="relative flex flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.03]"
              >
                <Quote className="absolute right-5 top-5 h-8 w-8 text-violet-500/15 dark:text-violet-300/15" />
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < rating ? "fill-current" : "text-zinc-300 dark:text-zinc-700"}`}
                    />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  “{t.text}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-zinc-100 pt-4 dark:border-white/10">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-600/10 text-sm font-black text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} alt={t.name} className="h-full w-full object-cover" />
                    ) : (
                      initials(t.name)
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-sm font-bold text-zinc-900 dark:text-white">
                      <span className="truncate">{t.name}</span>
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                    </div>
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      Təsdiqlənmiş alıcı · {t.productTitle ?? PLATFORM_LABELS[t.platform] ?? "Məhsul"}
                    </div>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
        )}
      </div>
    </section>
  );
}
