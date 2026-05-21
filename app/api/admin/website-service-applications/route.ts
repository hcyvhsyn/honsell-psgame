import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set([
  "NEW",
  "CONTACTED",
  "PRICE_GIVEN",
  "ACCEPTED",
  "REJECTED",
  "COMPLETED",
]);

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const where = status && ALLOWED_STATUSES.has(status) ? { status } : {};

  const applications = await prisma.websiteServiceApplication.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      package: { select: { id: true, name: true, priceRange: true } },
    },
  });

  return NextResponse.json({ applications });
}
