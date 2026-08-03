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

  // ─── PS Store detal metadata filtrləri ────────────────────────────────────
  // Mənbə: scripts/enrichGameMetadata.ts. Sətir hələ zənginləşdirilməyibsə
  // dəyər NULL olur və bu filtrlərin hər biri onu KƏNARLAŞDIRIR — bu qəsdəndir:
  // "PEGI 18 göstər" deyən istifadəçiyə reytinqi bilinməyən oyunu vermək
  // filtri mənasız edərdi.
  /** PEGI etiketləri ("PEGI 18"). Bir neçəsindən hər hansı biri. */
  contentRatings?: string[] | null;
  /** PS Store istifadəçi reytinqi üçün aşağı hədd (məs. 4.0). */
  minPsRating?: number | null;
  /** Nəşriyyatçı adı — dəqiq uyğunluq (siyahı DB-dəki dəyərlərdən qurulur). */
  publisher?: string | null;
  /** Çıxış ili aralığı. */
  releaseYearMin?: number | null;
  releaseYearMax?: number | null;
};

/**
 * Reytinq filtri üçün minimum səs sayı.
 *
 * 2 nəfərin 5 ulduz verdiyi oyun "4.5+" filtrində birinci çıxsaydı, filtr
 * keyfiyyət yox, təsadüf sıralayardı. Kartdakı göstərim həddi ilə eynidir
 * (bax: MIN_RATING_COUNT_TO_SHOW), yəni filtrdən keçən hər sətirdə reytinq
 * həm də görünür.
 */
export const MIN_RATING_COUNT_FOR_FILTER = 10;

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
    contentRatings = null,
    minPsRating = null,
    publisher = null,
    releaseYearMin = null,
    releaseYearMax = null,
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
  if (contentRatings && contentRatings.length > 0) {
    parts.push(
      PrismaSql.sql`(${PrismaSql.join(
        contentRatings.map((r) => PrismaSql.sql`g."contentRating" = ${r}`),
        " OR "
      )})`
    );
  }
  if (minPsRating != null) {
    parts.push(
      PrismaSql.sql`(g."psRatingAvg" >= ${minPsRating} AND COALESCE(g."psRatingCount", 0) >= ${MIN_RATING_COUNT_FOR_FILTER})`
    );
  }
  if (publisher) parts.push(PrismaSql.sql`g."publisherName" = ${publisher}`);
  // Çıxış ilini DB tərəfdə EXTRACT ilə deyil, tarix aralığı ilə müqayisə
  // edirik — belədə `releaseDate` üzərində indeks/planlayıcı işləyə bilir.
  if (releaseYearMin != null) {
    parts.push(
      PrismaSql.sql`g."releaseDate" >= ${new Date(Date.UTC(releaseYearMin, 0, 1))}`
    );
  }
  if (releaseYearMax != null) {
    parts.push(
      PrismaSql.sql`g."releaseDate" < ${new Date(Date.UTC(releaseYearMax + 1, 0, 1))}`
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
    contentRatings = null,
    minPsRating = null,
    publisher = null,
    releaseYearMin = null,
    releaseYearMax = null,
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

  and.push(
    ...buildMetadataWhereClauses({
      contentRatings,
      minPsRating,
      publisher,
      releaseYearMin,
      releaseYearMax,
    })
  );

  if (and.length > 0) where.AND = and;
  return where;
}

/**
 * PS Store detal metadata filtrlərinin Prisma `AND` fraqmentləri.
 *
 * Ayrıca ixrac olunur, çünki `/api/games` `where` obyektini tarixən öz içində
 * qurur (axtarış `q`-sunu da oraya yazır) və `buildGameWhere`-i bütövlükdə
 * işlədə bilmir. Məntiqi iki yerdə saxlamamaq üçün yalnız bu hissə paylaşılır.
 */
export function buildMetadataWhereClauses(
  input: Pick<
    GameFilterInput,
    "contentRatings" | "minPsRating" | "publisher" | "releaseYearMin" | "releaseYearMax"
  >
): Prisma.GameWhereInput[] {
  const out: Prisma.GameWhereInput[] = [];
  if (input.contentRatings && input.contentRatings.length > 0) {
    out.push({ contentRating: { in: input.contentRatings } });
  }
  if (input.minPsRating != null) {
    out.push({
      psRatingAvg: { gte: input.minPsRating },
      psRatingCount: { gte: MIN_RATING_COUNT_FOR_FILTER },
    });
  }
  if (input.publisher) out.push({ publisherName: input.publisher });
  if (input.releaseYearMin != null) {
    out.push({ releaseDate: { gte: new Date(Date.UTC(input.releaseYearMin, 0, 1)) } });
  }
  if (input.releaseYearMax != null) {
    out.push({ releaseDate: { lt: new Date(Date.UTC(input.releaseYearMax + 1, 0, 1)) } });
  }
  return out;
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
