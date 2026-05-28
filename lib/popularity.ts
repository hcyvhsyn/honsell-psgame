// Oyunları populyarlıq üzrə sıralamaq üçün paylaşılan PostgreSQL fraqmentləri.
//
// Sıralama real istifadəçi davranışından (uğurlu alış, favoritə əlavə,
// təsdiqlənmiş rəy) və yumşaq boost-lardan (curated `isFeatured` flag-i +
// aktiv endirim) çəkili cəm kimi hesablanır. Tək yerdə saxlayırıq ki, həm
// /api/games (sort=popular), həm də /oyunlar səhifəsinin ilkin yüklənməsi
// eyni qaydada sıralasın.
//
// Çəkilər (lexicographic əvəzinə hamısı bir-birinə qarışsın deyə cəm):
//   alış sayı × 10  — ən güclü siqnal, real "satılır"
//   favorit × 3     — niyyət
//   rəy × 2         — engagement
//   isFeatured ?+5  — admin curated boost (kateqoriya filtrindən aşağıda qalsın deyə kiçik)
//   endirim ?+2     — hazırda aktiv endirim, "indi maraqlı" siqnalı
//
// Tiebreaker: `lastScrapedAt` DESC (yeni gələnlər üstdə), sonra `id` ASC.
//
// İmplementasiya qeydi: aqreqasiya LATERAL JOIN-larla anlıq hesablanır. Bu,
// ~10k oyun kataloqu üçün postgres `Game(gameId)` indekslərini istifadə edib
// 50-100ms-də cavab verir; çağırış yeri 600s `unstable_cache` ilə örtüldüyü
// üçün də gerçəkdə az tezliklə işə düşür.

import { prisma } from "./prisma";
import { Prisma as PrismaSql, type Game } from "./generated/prisma/client";

export const POPULARITY_JOINS_SQL: PrismaSql.Sql = PrismaSql.sql`
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS c
    FROM "Transaction" t
    WHERE t."gameId" = g."id"
      AND t."type" = 'PURCHASE'
      AND t."status" = 'SUCCESS'
  ) tx ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS c
    FROM "Favorite" f
    WHERE f."gameId" = g."id"
  ) fav ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS c
    FROM "GameReview" r
    WHERE r."gameId" = g."id"
      AND r."status" = 'APPROVED'
  ) rv ON true
`;

export const POPULARITY_ORDER_BY_SQL: PrismaSql.Sql = PrismaSql.sql`
  (
    tx.c * 10 +
    fav.c * 3 +
    rv.c * 2 +
    CASE WHEN g."isFeatured" THEN 5 ELSE 0 END +
    CASE WHEN g."discountTryCents" IS NOT NULL THEN 2 ELSE 0 END
  ) DESC,
  g."lastScrapedAt" DESC,
  g."id" ASC
`;

/**
 * Verilmiş `whereSql` şərtinə uyğun oyunları populyarlıq skoruyla sıralanmış
 * şəkildə qaytarır. `whereSql` `g.` aliasını qəbul edir (məs.
 * `g."isActive" = true AND g."store" = ${store}`).
 */
export async function fetchPopularGames(
  whereSql: PrismaSql.Sql,
  limit: number,
  offset: number,
): Promise<Game[]> {
  return (await prisma.$queryRaw(PrismaSql.sql`
    SELECT g.*
    FROM "Game" g
    ${POPULARITY_JOINS_SQL}
    WHERE ${whereSql}
    ORDER BY ${POPULARITY_ORDER_BY_SQL}
    LIMIT ${limit} OFFSET ${offset}
  `)) as Game[];
}
