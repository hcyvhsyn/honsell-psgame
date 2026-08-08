/**
 * İzlənilmiş reels dəftəri (cihaz səviyyəsində).
 *
 * NİYƏ localStorage: qonaqlar da təkrarlardan qorunmalıdır, ona görə giriş tələb
 * edən DB həlli yaramır. `reelCategory.ts` və `reelSound.ts` ilə eyni şablon.
 *
 * "Görülmüş" = video SONUNA ÇATIB. Sürətlə ötürülən video bağlanmır və sonra
 * yenidən çıxa bilər (bax: ReelSlot-dakı `timeupdate` aşkarlaması).
 */
const STORAGE_KEY = "honsell:reels-seen";

/**
 * Dəftərin yuxarı həddi. Həm `localStorage` kvotasını, həm də feed sorğusunun
 * gövdəsini qoruyur — bu siyahı hər sorğuda `excludeIds` kimi göndərilir.
 * Ring buffer: dolduqda ƏN KÖHNƏ id atılır.
 */
const MAX_SEEN = 500;

/** Ən köhnədən ən yeniyə sıralı id siyahısı. */
export function readSeenReels(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // Zədəli JSON və ya bloklanmış localStorage — dəftəri boş say.
    return [];
  }
}

/** Videonu görülmüş kimi qeyd edir. Təkrar çağırış zərərsizdir. */
export function markReelSeen(id: string): void {
  if (!id || typeof window === "undefined") return;
  try {
    const current = readSeenReels().filter((x) => x !== id);
    current.push(id);
    const trimmed = current.length > MAX_SEEN ? current.slice(current.length - MAX_SEEN) : current;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* yazıla bilmirsə təkrar-önləmə yalnız bu sessiyada işləyir */
  }
}

/** "Yenidən başla" — bütün kataloq yenidən dövrəyə girir. */
export function clearSeenReels(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* boş keç */
  }
}
