import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/pricing";
import { awardReviewCashback } from "@/lib/reviewCashback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/testimonials/[id]
 * Body: { isActive?: boolean, sortOrder?: number }
 *
 * isActive=true  → rəy anasayfada görünür (təsdiq)
 * isActive=false → gizlədilir / təsdiq gözləyir
 * sortOrder      → anasayfada sıralama (kiçik əvvəl)
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { isActive?: boolean; sortOrder?: number } = {};

  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.sortOrder != null && Number.isFinite(Number(body.sortOrder))) {
    data.sortOrder = Math.trunc(Number(body.sortOrder));
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Dəyişiklik yoxdur." }, { status: 400 });
  }

  try {
    const updated = await prisma.testimonial.update({ where: { id: params.id }, data });

    // Rəy təsdiqlənəndə (aktiv) və konkret alışa bağlıdırsa — 1% cashback ver.
    // İdempotentdir: təkrar aktiv/deaktiv etmək ikinci dəfə pul yazmaz.
    let cashbackCents = 0;
    if (data.isActive === true && updated.transactionId) {
      try {
        const purchase = await prisma.transaction.findUnique({
          where: { id: updated.transactionId },
          select: { userId: true },
        });
        if (purchase?.userId) {
          const settings = await getSettings();
          const result = await awardReviewCashback(prisma, {
            userId: purchase.userId,
            sourceTransactionId: updated.transactionId,
            reviewCashbackRatePct: settings.reviewCashbackRatePct,
            testimonialId: updated.id,
          });
          if (result) cashbackCents = result.cashbackCents;
        }
      } catch (e) {
        // Cashback xətası təsdiqi bloklamasın — loglayıb davam edirik.
        console.error("review cashback on approve failed", {
          testimonialId: updated.id,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({ ok: true, testimonial: updated, cashbackAzn: cashbackCents / 100 });
  } catch {
    return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });
  }
}

/** DELETE /api/admin/testimonials/[id] — rəyi tamamilə silir. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.testimonial.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Rəy tapılmadı." }, { status: 404 });
  }
}
