import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin: /abunelik CRM yeniləmələri (son 300). */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const rows = await prisma.crmRenewalOrder.findMany({
    where: status && ["PENDING", "SUCCESS", "FAILED"].includes(status) ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ rows });
}
