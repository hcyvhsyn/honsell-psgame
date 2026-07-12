import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStudentCardViewUrl } from "@/lib/imageUploadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * İstifadəçinin ÖZ tələbə kartı üçün qısa-ömürlü signed baxış URL-i.
 * Yalnız sahibin öz açarına giriş var — başqasının kartına çıxış yoxdur.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: { studentCardKey: true },
  });
  if (!profile?.studentCardKey) {
    return NextResponse.json({ url: null });
  }

  const url = await getStudentCardViewUrl(profile.studentCardKey);
  return NextResponse.json({ url });
}
