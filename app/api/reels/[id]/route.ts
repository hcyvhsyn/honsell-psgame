import { NextResponse } from "next/server";
import { getReelById } from "@/lib/reels";

export const runtime = "nodejs";

/**
 * Tək reel — `/reels?r=<id>` deep link-i üçün.
 *
 * Niyə ayrıca endpoint: `r` parametrini `app/reels/page.tsx`-də `searchParams`
 * ilə oxusaq route DİNAMİK olur və bütün keşləmə arxitekturası dağılır. Ona görə
 * parametr client-də oxunur və reel buradan çəkilir.
 */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const item = await getReelById(String(ctx.params.id ?? ""));
  if (!item) return NextResponse.json({ error: "Tapılmadı" }, { status: 404 });
  return NextResponse.json({ item });
}
