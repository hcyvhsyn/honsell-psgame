/**
 * Oyun kartının paylaşılan tipi və göstərim köməkçiləri.
 *
 * NİYƏ AYRI FAYL: `GameCardData` əvvəl `components/GameCard.tsx` içində idi və
 * server modulları (facetCatalog, /api/games, səhifələr) onu oradan `import
 * type` ilə götürürdü. İndi kartın janr/PEGI/reytinq etiketlərini formatlayan
 * funksiyalar da lazımdır və onları client komponentdən import etmək dairəvi
 * asılılıq yaradardı. Bu modul PRISMA-YA TOXUNMUR — "use client" ağacına
 * düşməsi təhlükəsizdir (bax: lib/lootBoxShared.ts ilə eyni səbəb).
 *
 * DATA MƏNBƏYİ: buradakı sahələrin böyük hissəsi PS Store DETAL səhifəsindən
 * gəlir (scripts/enrichGameMetadata.ts). Listinq scrape-i onları vermir, ona
 * görə enricher işləyənə qədər hamısı NULL olur — bütün göstərim məntiqi
 * "dəyər yoxdursa heç nə göstərmə" prinsipi ilə qurulub.
 */

export type GameCardData = {
  id: string;
  title: string;
  imageUrl: string | null;
  /** "PS5", "PS4", or "PS5,PS4" for cross-gen titles. NULL for concepts. */
  platform: string | null;
  productType: string;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  /** ISO timestamp of when the active discount expires; null if no discount or unknown. */
  discountEndAt: string | null;
  /** PS Store productId — legacy link target, used when `slug` is not set yet. */
  productId?: string | null;
  /** SEO slug — the canonical detail URL. Preferred over productId when present. */
  slug?: string | null;
  /** Storefront: "PS" (default) or "EPIC". Epic cards swap PS chrome for Epic branding. */
  store?: string | null;

  // ─── PS Store detal metadata-sı (enrichGameMetadata.ts) ────────────────────
  // Hamısı opsionaldır: enricher hələ çatmayıbsa NULL gəlir və kart həmin
  // sətri sadəcə render etmir.
  /** PS Store janrları (türkcə, məs. "Aksiyon"). Kartda AZ-yə çevrilir. */
  genres?: string[] | null;
  /** PEGI etiketi, məs. "PEGI 18". */
  contentRating?: string | null;
  /** PS Store istifadəçi reytinqi (1–5). */
  psRatingAvg?: number | null;
  /** Həmin reytinqi verən istifadəçi sayı. */
  psRatingCount?: number | null;
  publisherName?: string | null;
  /** Çıxış ili. Tam tarix əvəzinə il saxlanılır — kartda yalnız il göstərilir. */
  releaseYear?: number | null;
  /** PS Store `localizedStoreDisplayClassification` (türkcə, məs. "Premium Sürüm"). */
  editionLabel?: string | null;
};

// ─── Janr ────────────────────────────────────────────────────────────────────
//
// DB-dəki dəyərlər PS Store TR mağazasından gəldiyi üçün TÜRKCƏDİR. Onları DB
// səviyyəsində tərcümə etmirik (facet filtrləri həmin dəyərlərə bağlıdır —
// bax: lib/gameFacets.ts), yalnız göstərim anında AZ-yə çeviririk.
const GENRE_AZ: Record<string, string> = {
  Aksiyon: "Aksiyon",
  Macera: "Macəra",
  Nişancı: "Nişançı",
  Dövüş: "Döyüş",
  Dövüs: "Döyüş",
  Spor: "İdman",
  Simülasyon: "Simulyasiya",
  Yarış: "Yarış",
  "Sürüş/Yarış": "Sürüş/Yarış",
  "Rol Yapma": "Rollu oyun",
  RPG: "RPG",
  Korku: "Qorxu",
  "Hayatta Kalma": "Sağ qalma",
  Strateji: "Strategiya",
  Bulmaca: "Tapmaca",
  Aile: "Ailəvi",
  Parti: "Məclis oyunu",
  "Müzik/Ritim": "Musiqi/Ritm",
  Müzik: "Musiqi",
  Eğitim: "Təhsil",
  Arcade: "Arkad",
  Platform: "Platforma",
  "Kart ve Masa": "Kart və masaüstü",
  MMO: "MMO",
  Kelime: "Söz oyunu",
  Benzersiz: "Unikal",
  Sanat: "İncəsənət",
  Gizlilik: "Gizlilik",
  Dövüşme: "Döyüş",
};

/** Türkcə janr adını AZ göstərim adına çevirir. Tanımırsa olduğu kimi qaytarır. */
export function genreLabelAz(genre: string): string {
  return GENRE_AZ[genre] ?? genre;
}

// ─── Sürüm / məhsul təsnifatı ────────────────────────────────────────────────
//
// `editionLabel` PS Store-un lokallaşdırılmış təsnifatıdır — "sürüm adı" DEYİL.
// İki fərqli yerdə işə yarayır:
//   1. Başlıq üstündəki eyebrow: yalnız SÜRÜM fərqi bildirənlər ("Premium
//      Sürüm", "Oyun Paketi"). "Tam Sürüm Oyun" hər oyunda təkrarlanır və
//      şum yaradır, ona görə göstərilmir.
//   2. Kapaqdakı çip: ADDON sətirlərində boş "DLC" əvəzinə konkret nə olduğu
//      ("Kostyum", "Sezon bileti", "Xəritə") — bu, bizdə olan ən dəqiq
//      məlumatdır və müştəri kartın üstündə görməlidir.

const EDITION_TIER_AZ: Record<string, string> = {
  "Premium Sürüm": "Premium sürüm",
  "Oyun Paketi": "Oyun paketi",
  "Deluxe Sürüm": "Deluxe sürüm",
  "Ultimate Sürüm": "Ultimate sürüm",
  "Gold Sürüm": "Gold sürüm",
  "Standart Sürüm": "Standart sürüm",
};

const ADDON_KIND_AZ: Record<string, string> = {
  Eklenti: "Əlavə",
  "Eklenti Paketi": "Əlavə paketi",
  Karakter: "Personaj",
  Kostüm: "Kostyum",
  Seviye: "Səviyyə",
  Öğe: "Əşya",
  Harita: "Xəritə",
  Araç: "Nəqliyyat",
  "Sezon Bileti": "Sezon bileti",
  Parça: "Parça",
  Bölüm: "Bölüm",
  Silahlar: "Silahlar",
  "Oyun Müziği": "Oyun musiqisi",
  Bilet: "Bilet",
  Abonelik: "Abunəlik",
};

/**
 * Başlıq üstündə göstəriləcək sürüm etiketi. Yalnız oyunu digərlərindən
 * FƏRQLƏNDİRƏN sürümlər üçün dəyər qaytarır, qalan hallarda null.
 */
export function editionTierLabel(editionLabel?: string | null): string | null {
  if (!editionLabel) return null;
  return EDITION_TIER_AZ[editionLabel.trim()] ?? null;
}

/**
 * ADDON kartlarında kapaq çipi üçün konkret əlavə tipi ("Kostyum", "Xəritə").
 * Tanınmayan dəyərdə null — çağıran ümumi "DLC" etiketinə qayıdır.
 */
export function addonKindLabel(editionLabel?: string | null): string | null {
  if (!editionLabel) return null;
  return ADDON_KIND_AZ[editionLabel.trim()] ?? null;
}

// ─── Reytinq ─────────────────────────────────────────────────────────────────

/**
 * Reytinq sayını qısaldır: 78 412 → "78K". Kartda yer azdır və dəqiq rəqəmin
 * heç bir dəyəri yoxdur — böyüklük sırası kifayətdir.
 */
export function formatRatingCount(count: number): string {
  if (count >= 1_000_000) {
    const m = count / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1000) {
    const k = count / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(count);
}

/**
 * Reytinq göstərilməyə dəyərmi? Tək-tük səs verilmiş oyunda "5.0 (2)" yanıldıcı
 * siqnaldır — minimum həddən aşağısını gizlədirik.
 */
export const MIN_RATING_COUNT_TO_SHOW = 10;

export function shouldShowRating(
  avg?: number | null,
  count?: number | null
): boolean {
  return (
    typeof avg === "number" &&
    avg > 0 &&
    typeof count === "number" &&
    count >= MIN_RATING_COUNT_TO_SHOW
  );
}

// ─── Endirim müddəti ─────────────────────────────────────────────────────────

// Azərbaycan dilində "12 avqusta qədər" — yönlük hal formaları.
const MONTHS_DATIVE_AZ = [
  "yanvara",
  "fevrala",
  "marta",
  "aprelə",
  "maya",
  "iyuna",
  "iyula",
  "avqusta",
  "sentyabra",
  "oktyabra",
  "noyabra",
  "dekabra",
];

export type DiscountDeadline =
  | { kind: "expired" }
  /** 24 saatdan az qalıb — saniyəli geri sayım (təcililik hissi yaradır). */
  | { kind: "countdown"; text: string }
  /** Uzaq tarix — "12 avqusta qədər". Saniyə saymağın mənası yoxdur. */
  | { kind: "date"; text: string };

/**
 * Endirimin bitmə anını istifadəçi üçün oxunaqlı mətnə çevirir.
 *
 * NİYƏ İKİ FORMAT: əvvəl hər halda "10 gün 04:12:33" göstərilirdi — 10 gün
 * qalmış saniyə saymaq həm şum, həm də yalançı təcililikdir. İndi son 24 saat
 * geri sayımla, ondan uzağı isə sadə tarixlə göstərilir.
 */
export function formatDiscountDeadline(
  iso: string,
  nowMs: number
): DiscountDeadline | null {
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - nowMs;
  if (diff <= 0) return { kind: "expired" };

  if (diff < 86_400_000) {
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return { kind: "countdown", text: `${pad(h)}:${pad(m)}:${pad(s)}` };
  }

  const d = new Date(end);
  const month = MONTHS_DATIVE_AZ[d.getMonth()] ?? "";
  return { kind: "date", text: `${d.getDate()} ${month} qədər` };
}

// ─── Qənaət ──────────────────────────────────────────────────────────────────

/**
 * "17.01 ₼ qənaət" rəqəmi. Faiz nişanı endirimin NİSBİ böyüklüyünü verir,
 * manatla qənaət isə MÜTLƏQ faydanı — ikisi birlikdə daha güclü siqnaldır.
 * 1 manatdan az qənaətdə null qaytarır (rozet dəyər qatmır).
 */
export function savingsAzn(
  originalAzn: number | null | undefined,
  finalAzn: number
): number | null {
  if (originalAzn == null) return null;
  const diff = originalAzn - finalAzn;
  return diff >= 1 ? diff : null;
}
