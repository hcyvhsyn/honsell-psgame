import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserReviewablePurchases } from "@/lib/userPurchasedProducts";
import { cleanupCommunityText } from "@/lib/communityModeration";
import { REVIEW_TEXT_MIN, REVIEW_TEXT_MAX } from "@/lib/reviewTextLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Yalnız uğurlu alışı olan müştəri rəy yaza bilər; rəy konkret alışa bağlanır.
    const reviewable = await getUserReviewablePurchases(user.id);
    if (reviewable.length === 0) {
      return NextResponse.json(
        { error: "Rəy yazmaq üçün rəy yazılmamış uğurlu sifarişin olmalıdır." },
        { status: 403 },
      );
    }

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

    // Müştəri rəy yazdığı alışı seçməlidir — və o alış həqiqətən onun rəy
    // yazılmamış alışları arasında olmalıdır (serverdə yoxlanır).
    const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";
    const matched = reviewable.find((p) => p.transactionId === transactionId);
    if (!matched) {
      return NextResponse.json(
        { error: "Zəhmət olmasa rəy yazdığın məhsulu siyahıdan seç." },
        { status: 400 },
      );
    }
    // platform/məhsul adı client-dən deyil, seçilmiş alışdan götürülür.
    const platform = matched.platform;
    const productTitle = matched.title;

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

    // Admin təsdiqinə qədər deaktiv saxlanır; təsdiqdə cashback verilir.
    await prisma.testimonial.create({
      data: {
        name: user.name ?? user.email.split("@")[0],
        text: finalText,
        rating,
        platform,
        productTitle,
        transactionId: matched.transactionId,
        isActive: false,
        sortOrder: 0,
        avatarUrl: null,
      },
    });

    return NextResponse.json({ ok: true });
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

