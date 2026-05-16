import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isWasenderConfigured()) {
    return NextResponse.json({ error: "WhatsApp inteqrasiyası konfiqurasiya edilməyib." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Mesaj boş ola bilməz." }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Mesaj çox uzundur (max 4000 simvol)." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, phone: true },
  });
  if (!user) return NextResponse.json({ error: "İstifadəçi tapılmadı." }, { status: 404 });

  const to = normalizeToE164(user.phone);
  if (!to) {
    return NextResponse.json({ error: "İstifadəçinin nömrəsi yoxdur və ya yanlış formatdadır." }, { status: 400 });
  }

  const result = await sendWasenderText({ to, text });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
