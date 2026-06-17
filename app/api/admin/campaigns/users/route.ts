import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getTestAccountEmails } from "@/lib/testAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q= → əllə əlavə üçün istifadəçi axtarışı (ad / email / telefon). */
export async function GET(req: Request) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ users: [] });

  const testEmails = getTestAccountEmails();
  const users = await prisma.user.findMany({
    where: {
      disabled: false,
      email: { notIn: testEmails },
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true, phone: true, emailVerified: true },
    take: 15,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}
