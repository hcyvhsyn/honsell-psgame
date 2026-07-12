import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Aktiv universitetlərin siyahısı — profil səhifəsindəki tələbə dropdown-u üçün.
 * Yalnız giriş etmiş istifadəçilər üçün açıqdır.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const universities = await prisma.university.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortName: true },
  });

  return NextResponse.json({ universities });
}
