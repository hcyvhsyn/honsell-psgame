import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { isWasenderConfigured } from "@/lib/wasender";
import { sendPsnOtpRequestWhatsApp } from "@/lib/orderNotifications";

export const runtime = "nodejs";

/**
 * Sifarişi icra etmək üçün müştərinin PlayStation hesabına daxil oluruq;
 * bu endpoint müştəriyə giriş anında gələn təsdiq kodunu (OTP) istəyən
 * WhatsApp mesajını göndərir. [id] — Transaction (sifariş) id-sidir.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isWasenderConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp inteqrasiyası konfiqurasiya edilməyib." },
      { status: 503 }
    );
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      user: { select: { name: true, phone: true } },
      serviceProduct: { select: { title: true } },
      game: { select: { title: true } },
    },
  });
  if (!tx) {
    return NextResponse.json({ error: "Sifariş tapılmadı." }, { status: 404 });
  }
  if (!tx.user?.phone) {
    return NextResponse.json(
      { error: "Müştərinin nömrəsi yoxdur və ya yanlış formatdadır." },
      { status: 400 }
    );
  }

  const result = await sendPsnOtpRequestWhatsApp({
    phone: tx.user.phone,
    userName: tx.user.name,
    productTitle: tx.serviceProduct?.title ?? tx.game?.title ?? null,
  });

  if (!result.ok) {
    const status = result.reason === "PHONE_INVALID" ? 400 : 502;
    return NextResponse.json({ error: result.reason ?? "Mesaj göndərilmədi" }, { status });
  }

  return NextResponse.json({ ok: true });
}
