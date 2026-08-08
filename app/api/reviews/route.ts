import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserReviewablePurchases } from "@/lib/userPurchasedProducts";
import { cleanupCommunityText } from "@/lib/communityModeration";
import { REVIEW_TEXT_MIN, REVIEW_TEXT_MAX } from "@/lib/reviewTextLimits";
import { isReviewCategoryOverride } from "@/lib/reviewCategoryShared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reviews — müştəri rəyi (admin təsdiqinə qədər `isActive: false`).
 *
 * İki rejim var:
 *  - **Alışa bağlı** (`transactionId` göndərilir) — alış serverdə yoxlanır,
 *    məhsul adı/kateqoriyası alışdan götürülür, təsdiqdən sonra cashback verilir.
 *  - **Ümumi** (`transactionId` YOXDUR) — hələ alış etməmiş (və ya bütün
 *    alışlarına rəy yazmış) istifadəçi də rəy yaza bilər. Bu rəy heç bir alışa
 *    bağlanmır, ona görə **cashback qazandırmır** (cashback yalnız
 *    `Testimonial.transactionId` dolu olanda verilir — bax
 *    `app/api/admin/testimonials/[id]/route.ts`).
 *
 * Spam qorunması: login onsuz da `emailVerified` tələb edir, üstəlik aşağıdakı
 * "3 təsdiq gözləyən rəy" limiti hər iki rejimə eyni cür tətbiq olunur.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const reviewable = await getUserReviewablePurchases(user.id);

    // Eyni istifadəçidən yığılıb qalan, hələ təsdiqlənməmiş rəy varsa, yenisini
    // qəbul etmirik — moderasiya növbəsini spamdan qoruyur.
    const pendingFromUser = await prisma.testimonial.count({
      where: { name: user.name ?? user.email.split("@")[0], isActive: false },
    });
    if (pendingFromUser >= 3) {
      return NextResponse.json(
        { error: "Təsdiq gözləyən rəylərin var. Zəhmət olmasa onların yoxlanışını gözlə." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const rating = Math.max(1, Math.min(5, Number(body.rating) || 0));
    const text = typeof body.text === "string" ? body.text.trim() : "";

    // Alış seçilibsə, o alış həqiqətən istifadəçinin rəy yazılmamış alışları
    // arasında olmalıdır (serverdə yoxlanır). Seçilməyibsə — ümumi rəydir.
    // Səhv/köhnəlmiş id-ni səssizcə ümumi rəyə çevirmirik: müştəri cashback
    // gözləyir, ona görə açıq xəta qaytarırıq.
    const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";
    const matched = transactionId
      ? reviewable.find((p) => p.transactionId === transactionId)
      : null;
    if (transactionId && !matched) {
      return NextResponse.json(
        { error: "Seçdiyin alış tapılmadı və ya ona artıq rəy yazılıb." },
        { status: 400 },
      );
    }
    // Alışa bağlı rəydə platform/məhsul adı client-dən deyil, seçilmiş alışdan
    // götürülür. Ümumi rəydə məhsul yoxdur; kateqoriya yalnız allowlist-dən
    // qəbul olunur (köhnə "Rəy yaz" modalı platforma seçimi göndərir).
    const platform = matched
      ? matched.platform
      : isReviewCategoryOverride(body.platform)
        ? body.platform
        : "GENERAL";
    const productTitle = matched ? matched.title : null;

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Ulduz dərəcəsi səhvdir." }, { status: 400 });
    }
    if (text.length < REVIEW_TEXT_MIN) {
      return NextResponse.json(
        { error: `Rəy ən azı ${REVIEW_TEXT_MIN} simvol olmalıdır.` },
        { status: 400 },
      );
    }
    if (text.length > REVIEW_TEXT_MAX) {
      return NextResponse.json(
        { error: `Rəy çox uzundur (max ${REVIEW_TEXT_MAX} simvol).` },
        { status: 400 },
      );
    }

    // AI orfoqrafiya/durğu düzəlişi + təhlükəsizlik yoxlaması.
    const cleaned = await cleanupCommunityText({ text, kind: "post", maxLength: REVIEW_TEXT_MAX });
    if (!cleaned.safeToPublish) {
      return NextResponse.json(
        { error: "Rəydə yolverilməz məzmun aşkarlandı. Zəhmət olmasa yenidən yaz." },
        { status: 400 },
      );
    }
    // Düzəlişdən sonra mətn minimumdan qısa olmasın.
    const finalText = cleaned.text.length >= REVIEW_TEXT_MIN ? cleaned.text : text;

    // Admin təsdiqinə qədər deaktiv saxlanır; təsdiqdə cashback verilir
    // (yalnız transactionId dolu olan — yəni alışa bağlı — rəylərdə).
    await prisma.testimonial.create({
      data: {
        name: user.name ?? user.email.split("@")[0],
        text: finalText,
        rating,
        platform,
        productTitle,
        transactionId: matched?.transactionId ?? null,
        isActive: false,
        sortOrder: 0,
        avatarUrl: null,
      },
    });

    return NextResponse.json({ ok: true, cashbackEligible: Boolean(matched) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("api/reviews failed", { userId: user.id, message: msg, err });
    return NextResponse.json(
      {
        error: "Rəy göndərmək alınmadı.",
        hint: msg.toLowerCase().includes("platform")
          ? "DB migration tətbiq edilməyib ola bilər (Testimonial.platform)."
          : undefined,
      },
      { status: 500 }
    );
  }
}

