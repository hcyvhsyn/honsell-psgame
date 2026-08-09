import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { findCustomerByPhone } from "@/lib/whatsappCustomerLookup";
import {
  createWhatsappReviewInvite,
  reviewInviteBaseUrl,
} from "@/lib/whatsappReviewInvites";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await requireAdmin();

  const url = new URL(req.url);
  const lookupPhone = url.searchParams.get("phone");
  if (lookupPhone !== null) {
    const customer = await findCustomerByPhone(lookupPhone);
    return NextResponse.json({ customer });
  }

  const items = await prisma.whatsappReviewInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      token: true,
      phone: true,
      productTitle: true,
      status: true,
      name: true,
      reviewText: true,
      rating: true,
      userId: true,
      testimonialId: true,
      usedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  // Admin cavabları Testimonial-da saxlanılır — dəvətin testimonialId-si ilə birləşdir.
  const testimonialIds = items
    .map((i) => i.testimonialId)
    .filter((id): id is string => Boolean(id));
  const replies = testimonialIds.length
    ? await prisma.testimonial.findMany({
        where: { id: { in: testimonialIds } },
        select: { id: true, adminReply: true, adminReplyImageUrl: true },
      })
    : [];
  const replyById = new Map(replies.map((r) => [r.id, r]));

  return NextResponse.json({
    items: items.map((i) => {
      const reply = i.testimonialId ? replyById.get(i.testimonialId) : null;
      return {
        ...i,
        url: `${reviewInviteBaseUrl()}/rey/${i.token}`,
        adminReply: reply?.adminReply ?? null,
        adminReplyImageUrl: reply?.adminReplyImageUrl ?? null,
        usedAt: i.usedAt?.toISOString() ?? null,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      };
    }),
  });
}

/**
 * Dəvətin yaradılması [lib/whatsappReviewInvites.ts] içindədir — CRM-dəki
 * partner endpoint-i də eyni funksiyanı çağırır (qiymət/satış məntiqi tək yerdə).
 */
export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const result = await createWhatsappReviewInvite(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Admin client-i `ok`/`alreadyExists` gözləmir — cavab formatı dəyişməsin.
  return NextResponse.json({
    invite: result.invite,
    customer: result.customer,
    whatsappSent: result.whatsappSent,
    whatsappError: result.whatsappError,
  });
}
