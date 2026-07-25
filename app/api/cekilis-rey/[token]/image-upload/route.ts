import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createImageUploadTarget } from "@/lib/imageUploadServer";

export const runtime = "nodejs";

/**
 * Qalib rəyi fotosu üçün presigned upload hədəfi (public, token ilə).
 * Yalnız keçərli, hələ təqdim edilməmiş qalib token-i qəbul olunur.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const entry = await prisma.giveawayEntry.findUnique({
    where: { reviewToken: params.token },
    select: { isWinner: true, reviewStatus: true },
  });
  if (!entry || !entry.isWinner) {
    return NextResponse.json({ error: "Link tapılmadı." }, { status: 404 });
  }
  if (entry.reviewStatus === "SUBMITTED") {
    return NextResponse.json({ error: "Bu link üçün artıq rəy yazılıb." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const res = await createImageUploadTarget({
    contentType: String(body.contentType ?? ""),
    prefix: "giveaway-reviews",
    supabaseBucket: "banners",
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json(res);
}
