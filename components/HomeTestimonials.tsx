import { Star, Quote, BadgeCheck, Sparkles, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getTierBadgesForUsers } from "@/lib/customerTier";
import HomeReviewCta from "@/components/HomeReviewCta";
import TierBadge from "@/components/TierBadge";

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
  STREAMING: "Streaming",
  MUSIC: "Musiqi",
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
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        text: true,
        rating: true,
        platform: true,
        productTitle: true,
        transactionId: true,
        adminReply: true,
        adminReplyImageUrl: true,
      },
    })
    .catch(() => []);

  // Təsdiqlənmiş rəy yoxdursa bölməni gizlət. "Rəy yaz" düyməsi (HomeReviewCta)
  // user-ə bağlı olduğu üçün client-də gəlir → bu komponent server/statik qalır.
  if (testimonials.length === 0) return null;

  const transactionIds = testimonials
    .map((testimonial) => testimonial.transactionId)
    .filter((id): id is string => Boolean(id));
  const testimonialIds = testimonials.map((testimonial) => testimonial.id);

  const [transactions, whatsappInvites] = await Promise.all([
    transactionIds.length > 0
      ? prisma.transaction
          .findMany({
            where: { id: { in: transactionIds } },
            select: { id: true, userId: true },
          })
          .catch(() => [])
      : [],
    prisma.whatsappReviewInvite
      .findMany({
        where: {
          testimonialId: { in: testimonialIds },
          createdUserId: { not: null },
        },
        select: { testimonialId: true, createdUserId: true },
      })
      .catch(() => []),
  ]);

  const userIdByTransaction = new Map(
    transactions.map((transaction) => [transaction.id, transaction.userId]),
  );
  const userIdByTestimonial = new Map(
    whatsappInvites
      .filter(
        (invite): invite is typeof invite & { testimonialId: string; createdUserId: string } =>
          Boolean(invite.testimonialId && invite.createdUserId),
      )
      .map((invite) => [invite.testimonialId, invite.createdUserId]),
  );
  const authorIdByTestimonial = new Map(
    testimonials.map((testimonial) => [
      testimonial.id,
      (testimonial.transactionId
        ? userIdByTransaction.get(testimonial.transactionId)
        : undefined) ?? userIdByTestimonial.get(testimonial.id),
    ]),
  );
  const tierBadges = await getTierBadgesForUsers(
    Array.from(authorIdByTestimonial.values()),
  ).catch(() => new Map());

  const showGrid = testimonials.length > 0;

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
        {showGrid && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => {
            const rating = Math.max(1, Math.min(5, t.rating));
            const authorId = authorIdByTestimonial.get(t.id);
            const tier = authorId ? tierBadges.get(authorId) : null;
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

                {t.adminReply || t.adminReplyImageUrl ? (
                  <div className="mt-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 dark:border-violet-300/20 dark:from-violet-400/[0.08] dark:to-transparent">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-200">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-white">
                        <ShieldCheck className="h-3 w-3" />
                      </span>
                      Honsell cavabı
                    </div>
                    {t.adminReply && (
                      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                        {t.adminReply}
                      </p>
                    )}
                    {t.adminReplyImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.adminReplyImageUrl}
                        alt="Honsell cavabı"
                        className="mt-2 max-h-56 w-full rounded-xl border border-violet-100 object-cover dark:border-white/10"
                      />
                    )}
                  </div>
                ) : null}

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
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span>Status:</span>
                      {tier ? (
                        <TierBadge tier={tier} full className="px-1.5 py-0 text-[9px]" />
                      ) : (
                        <span className="rounded-full border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
                          Honsell müştərisi
                        </span>
                      )}
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
