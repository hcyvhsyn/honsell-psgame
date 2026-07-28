/**
 * Oyun kataloqu üçün ortaq filtr qurucuları.
 *
 * Bu funksiyalar əvvəl `app/api/games/route.ts` daxilində private idi. Facet
 * landing səhifələri (`/ps5-oyunlari`, `/janr/aksiyon`, …) EYNİ filtr məntiqini
 * server tərəfdə işlətməlidir — məntiqi kopyalasaq, iki nüsxə gec-tez
 * fərqli nəticə verər (səhifədə görünən sayla filtrin qaytardığı say
 * uyğunsuzlaşar). Ona görə tək mənbədən idarə olunur.
 *
 * Prisma raw SQL fraqmentləri `g.` aliasını gözləyir.
 */
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import type { Prisma } from "@/lib/generated/prisma/client";

export type GameFilterInput = {
  store: string;
  /** Tək janr (köhnə API davranışı) və ya bir neçəsindən hər hansı biri. */
  genre?: string | null;
  genres?: string[] | null;
  /** null = tip filtri tətbiq olunmur (type=ALL). */
  productType?: string | null;
  platform?: string | null;
  onSale?: boolean;
  /** Seriya səhifələri üçün başlıq alt-sətri ("FIFA", "Call of Duty"). */
  titleContains?: string | null;
  priceMinTryCents?: number | null;
  priceMaxTryCents?: number | null;
};

/** Raw SQL variantı — populyarlıq sıralaması bu yolu işlədir. */
export function buildGameBaseWhereSql(input: GameFilterInput): PrismaSql.Sql {
  const {
    store,
    genre = null,
    genres = null,
    productType = null,
    platform = null,
    onSale = false,
    titleContains = null,
    priceMinTryCents = null,
    priceMaxTryCents = null,
  } = input;

  const parts: PrismaSql.Sql[] = [
    PrismaSql.sql`g."isActive" = true`,
    PrismaSql.sql`g."store" = ${store}`,
  ];

  if (genre) parts.push(PrismaSql.sql`${genre} = ANY(g."genres")`);
  // Bir neçə janrdan hər hansı biri (məs. "idman" → Spor + Simülasyon).
  // ARRAY overlap əvəzinə OR işlədirik ki, driver-dən asılı massiv
  // parametrləşdirməsinə güvənməyək.
  if (genres && genres.length > 0) {
    parts.push(
      PrismaSql.sql`(${PrismaSql.join(
        genres.map((g) => PrismaSql.sql`${g} = ANY(g."genres")`),
        " OR "
      )})`
    );
  }
  if (productType) parts.push(PrismaSql.sql`g."productType" = ${productType}`);
  if (onSale) parts.push(PrismaSql.sql`g."discountTryCents" IS NOT NULL`);
  if (titleContains) {
    parts.push(PrismaSql.sql`g."title" ILIKE ${`%${titleContains}%`}`);
  }
  if (platform === "PS4" || platform === "PS5") {
    parts.push(
      PrismaSql.sql`(g."platform" ILIKE ${`%${platform}%`} OR g."platform" IS NULL)`
    );
  }
  // Qiymət aralığı — effektiv qiymət üzrə (endirim varsa o, yoxsa baza).
  // COALESCE müqayisəni tək sütuna yığır.
  if (priceMinTryCents != null) {
    parts.push(
      PrismaSql.sql`COALESCE(g."discountTryCents", g."priceTryCents") >= ${priceMinTryCents}`
    );
  }
  if (priceMaxTryCents != null) {
    parts.push(
      PrismaSql.sql`COALESCE(g."discountTryCents", g."priceTryCents") <= ${priceMaxTryCents}`
    );
  }
  return PrismaSql.join(parts, " AND ");
}

/**
 * Prisma `WhereInput` variantı — `count` və sıralanmış `findMany` yolları
 * bunu işlədir. Raw SQL variantı ilə EYNİ semantikanı saxlamalıdır.
 */
export function buildGameWhere(input: GameFilterInput): Prisma.GameWhereInput {
  const {
    store,
    genre = null,
    genres = null,
    productType = null,
    platform = null,
    onSale = false,
    titleContains = null,
    priceMinTryCents = null,
    priceMaxTryCents = null,
  } = input;

  const and: Prisma.GameWhereInput[] = [];
  const where: Prisma.GameWhereInput = { isActive: true, store };

  if (productType) where.productType = productType;
  if (onSale) where.discountTryCents = { not: null };
  if (genre) where.genres = { has: genre };
  if (genres && genres.length > 0) and.push({ genres: { hasSome: genres } });
  if (titleContains) where.title = { contains: titleContains, mode: "insensitive" };
  if (platform === "PS4" || platform === "PS5") {
    // `platform` sütunu tək dəyər ("PS5"), vergüllə ayrılmış cüt ("PS5,PS4")
    // və ya NULL (concept sətirləri) ola bilər — üçü də nəzərə alınır.
    and.push({ OR: [{ platform: { contains: platform } }, { platform: null }] });
  }

  const priceFilter = buildPriceFilter(priceMinTryCents, priceMaxTryCents);
  if (priceFilter) and.push(priceFilter);

  if (and.length > 0) where.AND = and;
  return where;
}

/**
 * Effektiv qiymət (endirim varsa o, yoxsa baza) üzrə filtr fraqmenti.
 * Heç bir hədd yoxdursa null qaytarır ki, çağıran AND-i tamamilə keçsin.
 *
 * OR forması planlayıcıya həddi düzgün indeksə itələməyə imkan verir —
 * endirimli sətirlər `discountTryCents`, qalanları `priceTryCents` üzrə.
 */
export function buildPriceFilter(
  minTryCents: number | null,
  maxTryCents: number | null
): Prisma.GameWhereInput | null {
  if (minTryCents == null && maxTryCents == null) return null;

  const range = (col: "discountTryCents" | "priceTryCents") => {
    const r: Prisma.IntFilter = {};
    if (minTryCents != null) r.gte = minTryCents;
    if (maxTryCents != null) r.lte = maxTryCents;
    return { [col]: r } as Prisma.GameWhereInput;
  };

  return {
    OR: [
      { discountTryCents: { not: null }, ...range("discountTryCents") },
      { discountTryCents: null, ...range("priceTryCents") },
    ],
  };
}
