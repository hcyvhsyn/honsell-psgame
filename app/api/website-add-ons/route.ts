import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const addOns = await prisma.websiteServiceAddOn.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      pricingType: true,
      flatPrice: true,
      freeUnits: true,
      unitPrice: true,
      unitLabel: true,
    },
  });
  return NextResponse.json({ addOns });
}
