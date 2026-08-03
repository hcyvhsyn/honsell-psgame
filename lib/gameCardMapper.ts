/**
 * DB sətri → `GameCardData` çevirməsi. TƏK MƏNBƏ.
 *
 * NİYƏ LAZIMDIR: kataloq kartı beş fərqli yerdən doldurulur — `/api/games`,
 * `/api/search/ai`, `lib/facetCatalog.ts`, `/oyunlar` və `/endirimler`. Sahə
 * siyahısı orada beş dəfə əl ilə yazılırdı, ona görə karta yeni sahə əlavə
 * edəndə (janr, PEGI, reytinq…) birini unutmaq kifayət idi ki, eyni oyun bir
 * səhifədə reytinqli, digərində reytinqsiz görünsün. İndi hamısı buradan keçir.
 *
 * PRISMA-YA TOXUNMUR: xam sətir + artıq hesablanmış qiymət qəbul edir, ona görə
 * çağıran tərəf qiyməti PS (computeDisplayPrice) və ya Epic (computeEpicDisplay
 * Price) modeli ilə hesablamaqda sərbəstdir.
 */
import type { GameCardData } from "@/lib/gameCardShared";

/** Kart üçün DB-dən oxunmalı sütunlar. */
export type GameCardRow = {
  id: string;
  productId: string;
  slug?: string | null;
  title: string;
  imageUrl: string | null;
  platform: string | null;
  productType: string;
  store?: string | null;
  discountTryCents: number | null;
  discountEndAt: Date | string | null;
  // PS Store detal metadata-sı — enricher çatmayıbsa NULL.
  genres?: string[] | null;
  contentRating?: string | null;
  psRatingAvg?: number | null;
  psRatingCount?: number | null;
  publisherName?: string | null;
  releaseDate?: Date | string | null;
};

/**
 * Prisma `select` bloku — `SELECT *`-dan qaçmaq üçün.
 *
 * `Game.embedding` 512 ölçülü Float[] sütundur; kataloq sorğusunda onu
 * çəkmək hər sətrə kilobaytlarla lazımsız yük gətirir (bax: yaddaşdakı
 * "semantic search" qeydi — bir dəfə 114 saniyəlik sorğuya səbəb olmuşdu).
 */
export const GAME_CARD_SELECT = {
  id: true,
  productId: true,
  slug: true,
  title: true,
  imageUrl: true,
  platform: true,
  productType: true,
  store: true,
  priceTryCents: true,
  discountTryCents: true,
  discountEndAt: true,
  genres: true,
  contentRating: true,
  psRatingAvg: true,
  psRatingCount: true,
  publisherName: true,
  releaseDate: true,
  editionLabel: true,
} as const;

/** Raw SQL yolları üçün eyni sütun siyahısı (`g.` aliası ilə). */
export const GAME_CARD_COLUMNS_SQL = `g."id", g."productId", g."slug", g."title",
  g."imageUrl", g."platform", g."productType", g."store", g."priceTryCents",
  g."discountTryCents", g."discountEndAt", g."genres", g."contentRating",
  g."psRatingAvg", g."psRatingCount", g."publisherName", g."releaseDate",
  g."editionLabel"`;

type Price = {
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toYear(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

export function buildGameCard(
  g: GameCardRow & { editionLabel?: string | null },
  price: Price,
  opts?: {
    /** Epic sətirlərində detal səhifəsi yoxdur — link hədəflərini boşalt. */
    suppressLinks?: boolean;
    /** Epic-də üstündən xətt çəkilmiş qiymət vaxtlı kampaniya deyil. */
    suppressDiscountEnd?: boolean;
  }
): GameCardData {
  const suppressLinks = opts?.suppressLinks ?? false;
  return {
    id: g.id,
    store: g.store ?? "PS",
    productId: suppressLinks ? null : g.productId,
    slug: suppressLinks ? null : (g.slug ?? null),
    title: g.title,
    imageUrl: g.imageUrl,
    platform: g.platform,
    productType: g.productType,
    finalAzn: price.finalAzn,
    originalAzn: price.originalAzn,
    discountPct: price.discountPct,
    discountEndAt:
      opts?.suppressDiscountEnd || g.discountTryCents == null
        ? null
        : toIso(g.discountEndAt),
    genres: g.genres && g.genres.length > 0 ? g.genres : null,
    contentRating: g.contentRating ?? null,
    psRatingAvg: g.psRatingAvg ?? null,
    psRatingCount: g.psRatingCount ?? null,
    publisherName: g.publisherName ?? null,
    releaseYear: toYear(g.releaseDate),
    editionLabel: g.editionLabel ?? null,
  };
}
