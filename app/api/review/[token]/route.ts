import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const invite = await prisma.reviewInvite.findUnique({
    where: { token: params.token },
  });

  if (!invite) {
    return NextResponse.json({ error: "Link tapılmadı." }, { status: 404 });
  }
  if (invite.usedAt) {
    return NextResponse.json(
      { error: "Bu sifariş üçün artıq rəy yazılıb." },
      { status: 409 }
    );
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Link köhnəldi." }, { status: 410 });
  }

  const body = await req.json().catch(() => ({}));
  const rating = Math.max(1, Math.min(5, Number(body.rating) || 0));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";

  if (text.length < 10) {
    return NextResponse.json(
      { error: "Rəy ən azı 10 simvol olmalıdır." },
      { status: 400 }
    );
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { error: "Rəy çox uzundur (max 1000 simvol)." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Ulduz dərəcəsi səhvdir." }, { status: 400 });
  }

  let displayName = nameRaw.length > 0 ? nameRaw.slice(0, 80) : "";
  if (!displayName) {
    const u = await prisma.user.findUnique({
      where: { id: invite.userId },
      select: { name: true, email: true },
    });
    displayName = u?.name ?? u?.email.split("@")[0] ?? "Müştəri";
  }

  try {
    await prisma.$transaction(async (ptx) => {
      await ptx.testimonial.create({
        data: {
          name: displayName,
          text,
          rating,
          platform: invite.productType,
          isActive: true,
          sortOrder: 0,
          avatarUrl: null,
          transactionId: invite.transactionId,
        },
      });
      await ptx.reviewInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Naməlum xəta";
    console.error("review submit failed", { token: params.token, msg });
    return NextResponse.json(
      { error: "Rəy göndərmək alınmadı." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
