/**
 * Reels feed sıralaması — SAF funksiyalar (DB-yə toxunmur, test edilə bilir).
 *
 * PROBLEM: sıralama `sortOrder → createdAt → id` idi, yəni hamı üçün eyni və hər
 * ziyarət offset 0-dan başlayırdı. 100 video olsa belə istifadəçi həmişə eyni
 * videodan başlayır və eyniləri təkrar görürdü.
 *
 * HƏLL: yaş "həftə səbətlərinə" bölünür, hər səbətin İÇİ isə ziyarətə məxsus
 * `seed` ilə qarışdırılır:
 *
 *     score = həftəSəbəti * 1000 + seededHash(id, seed) % 1000
 *
 * Nəticə: bu həftənin videoları (qarışıq) əvvəldə, sonra keçən həftə, və s.
 *   • Tam təsadüfi sıralama YARAMAZDI — yeni yüklənən kampaniya videosu kataloqun
 *     içində itərdi.
 *   • Sırf "ən yenilər əvvəl" də YARAMAZDI — köhnə yaxşı videolar bir daha çıxmazdı.
 *
 * ⚠️ `seed` bir ziyarət boyu SABİT qalmalıdır: səhifələmə bu sıraya offset kimi
 * tətbiq olunur, seed ortada dəyişsə səhifələmə element atlayar/təkrarlayar.
 */

/** Bir səbətin uzunluğu. 7 gün — "bu həftə yüklənənlər" təbii qrupdur. */
const BUCKET_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/** Səbət daxilində qarışdırma diapazonu (score-un kəsr hissəsi). */
const SHUFFLE_RANGE = 1000;

export type RankableReel = {
  id: string;
  createdAt: Date | string;
};

/**
 * Determinist 32-bit hash (FNV-1a). `Math.random` işlətmirik: eyni (id, seed)
 * cütü həmişə eyni nəticə verməlidir, yoxsa səhifələmə sabit qalmaz.
 */
export function seededHash(id: string, seed: string): number {
  let h = 0x811c9dc5;
  const input = `${seed}:${id}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // FNV prime (32-bit) — Math.imul overflow-u düzgün idarə edir.
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // işarəsiz
}

/** Yaşın həftə səbəti — 0 = bu həftə, 1 = keçən həftə, … */
export function recencyBucket(createdAt: Date | string, now: number): number {
  const t = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return Number.MAX_SAFE_INTEGER; // tarixsiz sətir sona
  const ageDays = Math.max(0, (now - t) / MS_PER_DAY);
  return Math.floor(ageDays / BUCKET_DAYS);
}

/** Bir reel-in sıralama xalı — kiçik olan əvvəl gəlir. */
export function reelScore(reel: RankableReel, seed: string, now: number): number {
  return (
    recencyBucket(reel.createdAt, now) * SHUFFLE_RANGE +
    (seededHash(reel.id, seed) % SHUFFLE_RANGE)
  );
}

/**
 * Sıralanmış YENİ massiv qaytarır (giriş massivi dəyişdirilmir).
 *
 * `now` parametr kimi ötürülür ki, funksiya saf və test edilə bilən qalsın.
 */
export function rankReels<T extends RankableReel>(reels: T[], seed: string, now: number): T[] {
  return [...reels].sort((a, b) => {
    const diff = reelScore(a, seed, now) - reelScore(b, seed, now);
    // Bərabər xalda id ilə sabitlə — yoxsa sıra sort-un davamlılığından asılı olur.
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

/** Ziyarətə məxsus seed. Hər səhifə yüklənişində bir dəfə çağırılır. */
export function createReelSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
