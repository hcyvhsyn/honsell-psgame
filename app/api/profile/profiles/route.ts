import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Profillerim səhifəsindən saxlanılmış platform credentials-ı silir.
 * Sifariş sətirləri qalır (alış tarixçəsi pozulmasın deyə) — yalnız metadata-dan
 * `gmail` və `customerPassword` sahələri çıxarılır. Eyni (platform, email) cütünə
 * uyğun bütün tranzaksiyalar bir əməliyyatda təmizlənir.
 */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const platformKind = String(body?.platformKind ?? "").toUpperCase();
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (platformKind !== "LINKEDIN" && platformKind !== "YOUTUBE") {
    return NextResponse.json({ error: "Etibarsız platform tipi." }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ error: "Email tələb olunur." }, { status: 400 });
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
      metadata: { contains: email },
    },
    select: { id: true, metadata: true },
  });

  let cleared = 0;
  for (const t of transactions) {
    if (!t.metadata) continue;
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(t.metadata) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (m.kind !== "PLATFORM") continue;

    const txEmail = typeof m.gmail === "string" ? m.gmail.toLowerCase() : "";
    if (txEmail !== email) continue;

    const category = String(m.category ?? "");
    const musicBrand = String(m.musicBrand ?? "");
    const planType = String(m.planType ?? "").toUpperCase();
    const isYoutube = category === "MUSIC" && musicBrand === "YOUTUBE_PREMIUM";
    const isLinkedIn =
      category === "WORK" && (planType === "CAREER" || planType === "BUSINESS");
    const matchesKind =
      (platformKind === "YOUTUBE" && isYoutube) ||
      (platformKind === "LINKEDIN" && isLinkedIn);
    if (!matchesKind) continue;

    delete m.gmail;
    delete m.customerPassword;
    await prisma.transaction.update({
      where: { id: t.id },
      data: { metadata: JSON.stringify(m) },
    });
    cleared += 1;
  }

  return NextResponse.json({ ok: true, cleared });
}
