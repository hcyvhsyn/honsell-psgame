import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPersonalizedReelsPage, normalizeReelCategory, REELS_PAGE_SIZE } from "@/lib/reels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Şəxsiləşdirilmiş feed — görülmüş videoları çıxarır və ziyarətə məxsus `seed`
 * ilə qarışdırır.
 *
 * NİYƏ POST (GET yox): gövdədə 500-ə qədər `excludeIds` gedir, bu, URL uzunluq
 * həddini aşa bilər. Həm də cavab istifadəçiyə xasdır, yəni keşlənməməlidir —
 * `/api/reels/state` ilə eyni şablon.
 *
 * `/api/reels` (GET, keşlənən) SİLİNMİR: statik səhifə və deep link onu işlədir.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const excludeIds: string[] = Array.isArray(body?.excludeIds)
    ? (body.excludeIds as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const seed = typeof body?.seed === "string" && body.seed ? body.seed : "default";
  const cursor = Number(body?.cursor ?? 0);
  const limit = Number(body?.limit ?? REELS_PAGE_SIZE);

  const category = normalizeReelCategory(body?.category);
  // Sessiya YALNIZ "Saxladıqlarım" üçün oxunur — digər kateqoriyalarda cavab
  // istifadəçidən asılı deyil.
  const user = category === "SAVED" ? await getCurrentUser().catch(() => null) : null;

  const page = await getPersonalizedReelsPage({
    cursor: Number.isFinite(cursor) ? cursor : 0,
    limit: Number.isFinite(limit) ? limit : REELS_PAGE_SIZE,
    category,
    platformCode: typeof body?.platform === "string" ? body.platform : null,
    excludeIds,
    seed,
    userId: user?.id ?? null,
  });

  return NextResponse.json(page);
}
