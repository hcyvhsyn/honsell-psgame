import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Saxla" toggle-ı — FİLM/SERİAL reels-ləri üçün izləmə siyahısı.
 *
 * Oyun reels-ində client bunu ÇAĞIRMIR: orada mövcud `/api/favorites` işlədilir,
 * çünki favoritlərdə endirim bildirişləri var və saxlanan şey konkret oyundur.
 *
 * Cavab: `{ saved: boolean }` — yeni vəziyyət.
 */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Saxlamaq üçün hesaba daxil olmalısan." },
      { status: 401 },
    );
  }

  const reelId = String(ctx.params.id ?? "");
  const key = { reelId_userId: { reelId, userId: user.id } };

  const existing = await prisma.reelBookmark.findUnique({ where: key });
  if (existing) {
    await prisma.reelBookmark.delete({ where: key });
    return NextResponse.json({ saved: false });
  }

  try {
    await prisma.reelBookmark.create({ data: { reelId, userId: user.id } });
  } catch {
    // Silinmiş reel (foreign key) və s. — səssizcə "saxlanmadı" qaytar.
    return NextResponse.json({ saved: false });
  }
  return NextResponse.json({ saved: true });
}
