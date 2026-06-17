import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * GET ?q=&page= → müştəri əlaqə jurnalı: kimə, nə vaxt, hansı kanaldan mesaj
 * göndərmişik. Yalnız real göndərilən (SENT) sətirlər. Müştəri üzrə axtarış.
 */
export async function GET(req: Request) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const where: Record<string, unknown> = {
    OR: [{ emailStatus: "SENT" }, { waStatus: "SENT" }],
  };
  if (q) {
    where.user = {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    };
  }

  const [total, rows] = await Promise.all([
    prisma.campaignRecipient.count({ where }),
    prisma.campaignRecipient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true } },
        campaign: { select: { id: true, title: true, sentAt: true } },
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      customerName: r.user.name,
      email: r.email,
      phone: r.phone,
      channels: [
        r.emailStatus === "SENT" ? "Email" : null,
        r.waStatus === "SENT" ? "WhatsApp" : null,
      ].filter(Boolean),
      sentAt: (r.campaign.sentAt ?? r.createdAt).toISOString(),
      campaignId: r.campaign.id,
      campaignTitle: r.campaign.title,
      clickCount: r.clickCount,
    })),
  });
}
