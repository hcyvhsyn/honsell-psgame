import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getTierBadgesForUsers, type UserTierBadge } from "@/lib/customerTier";

export const TESTIMONIAL_PAGE_SIZE = 9;

export type PublicTestimonialItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  text: string;
  rating: number;
  platform: string;
  productTitle: string | null;
  /** Alınan məhsulun qiyməti (AZN qəpik) — məlumdursa. */
  priceAznCents: number | null;
  /** Məhsulun alınma tarixi (ISO) — məlumdursa. */
  purchasedAt: string | null;
  adminReply: string | null;
  adminReplyImageUrl: string | null;
  tier: UserTierBadge | null;
};

export type PublicTestimonialsPage = {
  items: PublicTestimonialItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Aktiv rəyi olan hər platforma üzrə rəy sayı (filtrlərdən asılı deyil). */
  platformCounts: Record<string, number>;
};

type TestimonialFilters = {
  page?: number;
  query?: string;
  platform?: string;
  rating?: number | null;
};

export async function getPublicTestimonials({
  page = 1,
  query = "",
  platform = "",
  rating = null,
}: TestimonialFilters = {}): Promise<PublicTestimonialsPage> {
  const normalizedQuery = query.trim().slice(0, 100);
  const normalizedPage = Math.max(1, Math.floor(page));
  const where: Prisma.TestimonialWhereInput = {
    isActive: true,
    ...(platform ? { platform } : {}),
    ...(rating && rating >= 1 && rating <= 5 ? { rating } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            { name: { contains: normalizedQuery, mode: "insensitive" } },
            { productTitle: { contains: normalizedQuery, mode: "insensitive" } },
            { text: { contains: normalizedQuery, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Platforma sayğacları — filtr dropdown-u üçün. Yalnız rəyi olan kateqoriyalar
  // göstərilsin deyə bütün aktiv rəylər üzrə (platform/rating/query filtrindən asılı olmadan).
  const platformGroups = await prisma.testimonial.groupBy({
    by: ["platform"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const platformCounts: Record<string, number> = {};
  for (const group of platformGroups) {
    platformCounts[group.platform] = group._count._all;
  }

  const total = await prisma.testimonial.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / TESTIMONIAL_PAGE_SIZE));
  const safePage = Math.min(normalizedPage, totalPages);
  const testimonials = await prisma.testimonial.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    skip: (safePage - 1) * TESTIMONIAL_PAGE_SIZE,
    take: TESTIMONIAL_PAGE_SIZE,
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
  });

  const transactionIds = testimonials
    .map((testimonial) => testimonial.transactionId)
    .filter((id): id is string => Boolean(id));
  const testimonialIds = testimonials.map((testimonial) => testimonial.id);

  const [transactions, whatsappInvites] = await Promise.all([
    transactionIds.length > 0
      ? prisma.transaction.findMany({
          where: { id: { in: transactionIds } },
          select: { id: true, userId: true, amountAznCents: true, createdAt: true },
        })
      : [],
    testimonialIds.length > 0
      ? prisma.whatsappReviewInvite.findMany({
          where: { testimonialId: { in: testimonialIds } },
          select: {
            testimonialId: true,
            createdUserId: true,
            priceAznCents: true,
            createdAt: true,
          },
        })
      : [],
  ]);

  const userIdByTransaction = new Map(
    transactions.map((transaction) => [transaction.id, transaction.userId]),
  );
  const txnById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const inviteByTestimonial = new Map(
    whatsappInvites
      .filter((invite): invite is typeof invite & { testimonialId: string } =>
        Boolean(invite.testimonialId),
      )
      .map((invite) => [invite.testimonialId, invite]),
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
  ).catch(() => new Map<string, UserTierBadge>());

  return {
    page: safePage,
    pageSize: TESTIMONIAL_PAGE_SIZE,
    total,
    totalPages,
    platformCounts,
    items: testimonials.map((testimonial) => {
      const authorId = authorIdByTestimonial.get(testimonial.id);
      // Qiymət + alınma tarixi: əvvəlcə bağlı tranzaksiyadan (email-dəvət/oyun),
      // yoxdursa WhatsApp dəvətindən.
      const txn = testimonial.transactionId ? txnById.get(testimonial.transactionId) : null;
      const invite = inviteByTestimonial.get(testimonial.id);
      const priceAznCents = txn
        ? Math.abs(txn.amountAznCents)
        : invite?.priceAznCents ?? null;
      const purchasedAt = (txn?.createdAt ?? invite?.createdAt ?? null)?.toISOString() ?? null;
      return {
        id: testimonial.id,
        name: testimonial.name,
        avatarUrl: testimonial.avatarUrl,
        text: testimonial.text,
        rating: testimonial.rating,
        platform: testimonial.platform,
        priceAznCents,
        purchasedAt,
        productTitle: testimonial.productTitle,
        adminReply: testimonial.adminReply,
        adminReplyImageUrl: testimonial.adminReplyImageUrl,
        tier: authorId ? tierBadges.get(authorId) ?? null : null,
      };
    }),
  };
}
