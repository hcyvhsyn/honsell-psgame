/**
 * Oyun axtarışının SQL tərəfi — `lib/gameSearchTerms.ts`-dəki qrupları
 * Postgres şərtinə çevirir.
 *
 * TƏK MƏNBƏ: navbar modalı (`/api/search`) və kataloq (`/api/games`) eyni
 * funksiyaları çağırır. Əvvəl hər ikisi öz `title ILIKE '%q%'` variantını
 * saxlayırdı və nəticələr fərqlənirdi — modal "GTA 5"-i tapmırdı, kataloq da.
 *
 * Başlıq sorğu ilə EYNİ qaydada normallaşdırılır (LATERAL-da bir dəfə
 * hesablanır):
 *
 *   "Marvel’s Spider-Man 2"  →  n = " marvel s spider man 2 "   s = "marvelsspiderman2"
 *   "God of War Ragnarök"    →  n = " god of war ragnarok "     s = "godofwarragnarok"
 *
 * `n` sözlərin əvvəlinə görə uyğunlaşdırma üçün boşluqla əhatələnir
 * ("% spider%" → "spider man" və "spiderman" hər ikisini tutur), `s` isə
 * defis/apostrof fərqlərini tamamilə udur.
 *
 * ⚠️ Bu ifadələr indekslənmir (regexp_replace sətir-sətir işləyir). Kataloq
 * sorğusu onsuz da `similarity()` səbəbindən seq scan idi, ona görə əlavə
 * yük kiçikdir — amma yeni çağırış yeri əlavə edəndə bunu nəzərə al.
 */
import { Prisma as PrismaSql } from "@/lib/generated/prisma/client";
import {
  TITLE_TRANSLATE_FROM,
  TITLE_TRANSLATE_TO,
  type GameSearchTerms,
} from "@/lib/gameSearchTerms";

/**
 * Sorğunun `FROM` hissəsi. `g` (Game), `gn.n` (normallaşdırılmış başlıq) və
 * `gs.s` (boşluqsuz başlıq) aliaslarını verir.
 */
export function gameSearchFromSql(): PrismaSql.Sql {
  return PrismaSql.sql`"Game" g
    CROSS JOIN LATERAL (
      SELECT ' ' || regexp_replace(
        translate(lower(g."title"), ${TITLE_TRANSLATE_FROM}, ${TITLE_TRANSLATE_TO}),
        '[^a-z0-9]+', ' ', 'g'
      ) || ' ' AS n
    ) gn
    CROSS JOIN LATERAL (SELECT replace(gn.n, ' ', '') AS s) gs`;
}

/** Tək variant üçün şərt: söz başlanğıcı uyğunluğu + boşluqsuz forma. */
function variantSql(variant: string): PrismaSql.Sql {
  const squashed = variant.replace(/ /g, "");
  const parts: PrismaSql.Sql[] = [
    PrismaSql.sql`gn.n LIKE ${`% ${variant}%`}`,
  ];
  // Qısa tokenlər üçün boşluqsuz forma işlədilmir: "v" hərfi olan hər başlıq
  // uyğun gələrdi. 4+ simvolda isə bu, "spiderman" → "Spider-Man" körpüsüdür.
  if (squashed.length >= 4) {
    parts.push(PrismaSql.sql`gs.s LIKE ${`%${squashed}%`}`);
  }
  return PrismaSql.sql`(${PrismaSql.join(parts, " OR ")})`;
}

/** Bir sorğu sözü (bütün variantları OR ilə). */
function groupSql(group: string[]): PrismaSql.Sql {
  return PrismaSql.sql`(${PrismaSql.join(group.map(variantSql), " OR ")})`;
}

/**
 * Uyğun gələn söz sayı — həm süzgəcdə (hədd), həm sıralamada (relevanslıq)
 * işlədilir, ona görə tək ifadə kimi qaytarılır.
 */
function matchCountSql(terms: GameSearchTerms): PrismaSql.Sql {
  return PrismaSql.sql`(${PrismaSql.join(
    terms.groups.map((g) => PrismaSql.sql`(CASE WHEN ${groupSql(g)} THEN 1 ELSE 0 END)`),
    " + "
  )})`;
}

/**
 * TAM SÖZ kimi uyğun gələn söz sayı (prefiks yox).
 *
 * Sıralamada birinci meyardır, çünki prefiks uyğunluğu tək başına aldadıcıdır:
 * "cod" sorğusunda " cod%" şablonu **"Code Blue"** başlığını Call of Duty-dən
 * yuxarı qaldırırdı. Tam söz yoxlaması abbreviatura açılışını da tutur
 * ("cod" → " call of duty ") və seriyanı öz yerinə qaytarır.
 */
function exactWordCountSql(terms: GameSearchTerms): PrismaSql.Sql {
  return PrismaSql.sql`(${PrismaSql.join(
    terms.groups.map(
      (g) => PrismaSql.sql`(CASE WHEN (${PrismaSql.join(
        g.map((v) => PrismaSql.sql`gn.n LIKE ${`% ${v} %`}`),
        " OR "
      )}) THEN 1 ELSE 0 END)`
    ),
    " + "
  )})`;
}

/**
 * Başlıq uyğunluğu şərti. `gameSearchFromSql()` ilə birlikdə işlədilməlidir.
 */
export function gameSearchMatchSql(terms: GameSearchTerms): PrismaSql.Sql {
  // Sorğudan bir dənə də hərf/rəqəm qalmayıbsa (məs. yalnız durğu işarəsi)
  // qruplar boş olur — `sum >= 0` bütün kataloqu qaytarardı.
  if (terms.groups.length === 0) {
    return PrismaSql.sql`g."title" ILIKE ${`%${terms.raw}%`}`;
  }

  const parts: PrismaSql.Sql[] = [
    PrismaSql.sql`${matchCountSql(terms)} >= ${terms.required}`,
    // Typo toleransı — sözlərin heç biri tam tutmasa da ("assasins creed").
    PrismaSql.sql`similarity(g."title", ${terms.phrase}) >= 0.15`,
  ];
  return PrismaSql.sql`(${PrismaSql.join(parts, " OR ")})`;
}

/**
 * Relevanslıq sıralaması. Çağıran tərəf öz tie-breaker-lərini (qiymət,
 * populyarlıq, `lastScrapedAt`) SONRA əlavə edir.
 */
export function gameSearchRelevanceSql(terms: GameSearchTerms): PrismaSql.Sql {
  if (terms.groups.length === 0) {
    return PrismaSql.sql`g."title" ASC`;
  }

  // Tam ifadə uyğunluğu: "god of war" yazan istifadəçi əvvəlcə seriyanın
  // özünü görməlidir, sonra sözləri ayrı-ayrı daşıyanları.
  // Boşluqsuz forma yalnız 4+ simvolda işlədilir — `variantSql()` ilə eyni
  // intizam. "cod" sorğusunda "cod" hərf ardıcıllığı **"Code Blue"** və
  // "C.O.D.E." paketlərinin içindən keçib onları Call of Duty-dən yuxarı
  // qaldırırdı.
  const squashedTier =
    terms.squashed.length >= 4
      ? PrismaSql.sql`WHEN gs.s LIKE ${`%${terms.squashed}%`} THEN 1`
      : PrismaSql.empty;
  const phraseRank = PrismaSql.sql`(CASE
    WHEN gn.n LIKE ${` ${terms.phrase}%`} THEN 3
    WHEN gn.n LIKE ${`% ${terms.phrase}%`} THEN 2
    ${squashedTier}
    ELSE 0 END)`;

  return PrismaSql.sql`${exactWordCountSql(terms)} DESC,
    ${phraseRank} DESC,
    ${matchCountSql(terms)} DESC,
    similarity(g."title", ${terms.phrase}) DESC`;
}
