import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPurchasedProducts } from "@/lib/userPurchasedProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Yalnız ən azı bir uğurlu alışı olan müştəri könüllü rəy yaza bilər.
    // Bu, saxta/spam rəyləri kəsir və "təsdiqlənmiş alıcı" nişanını real edir.
    const purchased = await getUserPurchasedProducts(user.id);
    if (purchased.length === 0) {
      return NextResponse.json(
        { error: "Rəy yazmaq üçün ən azı bir uğurlu sifarişin olmalıdır." },
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

    // Müştəri rəy yazdığı məhsulu seçməlidir — və o məhsul həqiqətən aldığı
    // məhsullar arasında olmalıdır (serverdə yoxlanır, client-ə etibar etmirik).
    const productTitleRaw = typeof body.productTitle === "string" ? body.productTitle.trim() : "";
    const matched = purchased.find((p) => p.title === productTitleRaw);
    if (!matched) {
      return NextResponse.json(
        { error: "Zəhmət olmasa rəy yazdığın məhsulu siyahıdan seç." },
        { status: 400 },
      );
    }
    // platform client-dən deyil, seçilmiş məhsuldan götürülür.
    const platform = matched.platform;
    const productTitle = matched.title;

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Ulduz dərəcəsi səhvdir." }, { status: 400 });
    }
    if (text.length < 10) {
      return NextResponse.json({ error: "Rəy ən azı 10 simvol olmalıdır." }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json({ error: "Rəy çox uzundur (max 1000 simvol)." }, { status: 400 });
    }

    // Admin təsdiqinə qədər deaktiv saxlanır.
    await prisma.testimonial.create({
      data: {
        name: user.name ?? user.email.split("@")[0],
        text,
        rating,
        platform,
        productTitle,
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

