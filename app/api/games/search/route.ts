import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { cdnImageUrl } from "@/lib/cdnImage";
import type { Game } from "@/lib/generated/prisma/client";
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-to-server oyun axtarışı — CRM (crm.honsell.store) üçün.
 *
 * Müştəri WhatsApp-da oyun soruşanda CRM bu endpointə vurur, oyunu tapıb
 * müştəriyə göstərilən AZN qiyməti (endirimli) və birbaşa məhsul linkini alır.
 *
 *   GET /api/games/search?q=<oyun_adı>&limit=5
 *   Header: X-API-Key: <GAMES_SEARCH_API_KEY>
 *
 * Auth: paylaşılan gizli açar `GAMES_SEARCH_API_KEY` (env) — CRM-dəki
 * `HONSELL_GAMES_API_KEY` ilə eyni olmalıdır. Açar server-də təyin
 * olunmayıbsa endpoint fail-closed davranır (503) — heç vaxt public açılmır.
 * Açar uyğun gəlmirsə → 401.
 *
 * Qeyd (Cloudflare/WAF): bu yol server-server çağırışlarıdır, brauzer deyil.
 * Bot Fight Mode / WAF `/api/games/search`-i bloklamamalıdır — X-API-Key
 * başlığı olan sorğulara icazə verən qayda əlavə edin (kod deyil, infra işi).
 */
export async function GET(req: Request) {
  // ---- Auth: X-API-Key -----------------------------------------------------
  const expected = process.env.GAMES_SEARCH_API_KEY?.trim();
  if (!expected) {
    // Fail-closed: açar konfiqurasiya olunmayıbsa açıq buraxmırıq.
    return NextResponse.json(
      { error: "Games search API is not configured" },
      { status: 503 }
    );
  }
  const provided = req.headers.get("x-api-key")?.trim() ?? "";
  if (!apiKeyMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- Params --------------------------------------------------------------
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 }
    );
  }
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit")) || 5));

  // ---- Search (PS storefront) ---------------------------------------------
  // CRM yalnız satılan (linki olan) oyunları istəyir. PS store-un məhsul
  // səhifəsi /oyunlar/[productId]-dir; Epic sətirlərinin detal səhifəsi
  // olmadığından onları daxil etmirik.
  const [rows, settings] = await Promise.all([
    searchGames(q, limit),
    getSettings(),
  ]);

  const base = siteBaseUrl();
  const results = rows.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      name: g.title,
      priceAzn: price.finalAzn,
      oldPriceAzn: price.originalAzn, // null olduqda endirim yoxdur
      currency: "AZN",
      url: `${base}/oyunlar/${encodeURIComponent(g.productId)}`,
      platform: g.platform ?? null,
      // Kataloqda yalnız aktiv (satışda olan) oyunları qaytarırıq → hamısı
      // əlçatandır. Ayrıca stok sütunu yoxdur; rəqəmsal çatdırılma modeli.
      inStock: true,
      imageUrl: cdnImageUrl(g.imageUrl) ?? null,
    };
  });

  return NextResponse.json({ results });
}

/**
 * Fuzzy oyun axtarışı (pg_trgm). Ad üzrə hissəvi/case-insensitive + typo
 * tolerant; həmçinin `genres` tag massivində hissəvi uyğunluq da tutulur
 * ("rpg" → RPG kateqoriyalı oyunlar). Uyğun olmayan Postgres-də graceful
 * fallback ilə sadə `contains` axtarışına keçir — app/api/games/route.ts modeli.
 */
async function searchGames(q: string, limit: number): Promise<Game[]> {
  const like = `%${q}%`;
  try {
    // ILIKE substring güclü siqnaldır; similarity qısa/typo sorğuları tutur.
    // genres — tag massivi; hər hansı tag q-nu ehtiva edərsə də uyğun sayılır.
    const where = PrismaSql.sql`
      g."isActive" = true
      AND g."store" = 'PS'
      AND (
        g."title" ILIKE ${like}
        OR similarity(g."title", ${q}) >= 0.15
        OR EXISTS (
          SELECT 1 FROM unnest(g."genres") AS tag WHERE tag ILIKE ${like}
        )
      )
    `;
    // Ad uyğunluğu tag uyğunluğundan öndə sıralanır ki, birbaşa oyun adı
    // axtaranda kateqoriya nəticələri onu sıxışdırmasın.
    const order = PrismaSql.sql`
      (CASE WHEN g."title" ILIKE ${like} THEN 1 ELSE 0 END) DESC,
      similarity(g."title", ${q}) DESC,
      g."isFeatured" DESC,
      g."lastScrapedAt" DESC
    `;
    return (await prisma.$queryRaw(
      PrismaSql.sql`SELECT g.* FROM "Game" g WHERE ${where} ORDER BY ${order} LIMIT ${limit}`
    )) as Game[];
  } catch {
    return prisma.game.findMany({
      where: {
        isActive: true,
        store: "PS",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { genres: { has: q } },
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { lastScrapedAt: "desc" }],
      take: limit,
    });
  }
}

/** Sabit vaxtlı açar müqayisəsi (timing-attack qorunması). */
function apiKeyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Məhsul linkləri üçün kanonik baza URL. `NEXT_PUBLIC_SITE_URL` varsa ona
 * üstünlük verilir; yoxdursa canlı domen. Sorğunun origin-inə güvənmirik —
 * self-host reverse-proxy arxasında o daxili host ola bilər (məs. localhost)
 * və CRM-ə səhv link qaytarardı.
 */
function siteBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  return "https://www.honsell.store";
}
