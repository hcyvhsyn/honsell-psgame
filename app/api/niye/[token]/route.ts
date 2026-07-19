import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWinbackReason } from "@/lib/winbackShared";

export const runtime = "nodejs";

const REASON_TEXT_MAX = 1000;

/**
 * Public: "niyə davam etmədin?" cavabını qeyd edir. OTP/hesab yoxdur — yalnız
 * geribildirim. Token bir dəfə cavablandırıla bilər.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({}));

  const reason = body.reason;
  if (!isWinbackReason(reason)) {
    return NextResponse.json({ error: "Zəhmət olmasa bir səbəb seçin." }, { status: 400 });
  }
  const reasonText =
    typeof body.reasonText === "string" ? body.reasonText.trim().slice(0, REASON_TEXT_MAX) : "";

  const invite = await prisma.whatsappWinbackInvite.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, submittedAt: true, expiresAt: true },
  });
  if (!invite) {
    return NextResponse.json({ error: "Link tapılmadı." }, { status: 404 });
  }
  if (invite.status === "SUBMITTED" || invite.submittedAt) {
    return NextResponse.json({ error: "Bu link üçün artıq cavab verilib." }, { status: 409 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Bu link köhnəlib." }, { status: 410 });
  }

  await prisma.whatsappWinbackInvite.update({
    where: { id: invite.id },
    data: {
      reason,
      reasonText: reasonText || null,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
