/**
 * Reels səs seçiminin cihazda saxlanması.
 *
 * NİYƏ LAZIMDIR: brauzer avtomatik oynatmanı yalnız SƏSSİZ halda təmin edir, ona
 * görə feed həmişə səssiz başlayır. İstifadəçi hər dəfə səsi əl ilə açmasın deyə
 * seçim yadda saxlanılır və növbəti girişdə səsli oynatmağa CƏHD edilir.
 *
 * ⚠️ Cihazın səs DÜYMƏLƏRİ (telefon/klaviatura) brauzerə ötürülmür — mobil
 * platformalarda bu hadisə ümumiyyətlə səhifəyə çatmır. Ona görə "səsi artıranda
 * özü açılsın" birbaşa aşkarlana bilmir; yaxınlaşdıra bilən üç mexanizm bunlardır:
 *   1. bu seçimin yadda saxlanması,
 *   2. səsli avtomatik oynatma cəhdi (brauzer icazə verirsə keçir),
 *   3. masaüstündə `AudioVolumeUp` klavişi (yalnız onu ötürən brauzerlərdə).
 */
const STORAGE_KEY = "honsell:reels-sound";

/** `true` = istifadəçi səsi açıq istəyir. Default səssizdir (avtoplay tələbi). */
export function readSoundPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function storeSoundPreference(soundOn: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, soundOn ? "on" : "off");
  } catch {
    /* localStorage bloklana bilər — seçim yalnız bu sessiyada qalır */
  }
}

/**
 * Cihazın səs klavişləri. Yalnız masaüstü brauzerlərin bir hissəsi bunları
 * ötürür (Chrome/Windows, Linux); macOS-da OS onları özü udur, mobil-də isə heç
 * vaxt gəlmir. Ona görə bu, ƏLAVƏ imkandır — əsas yol deyil.
 */
export function isVolumeUpKey(e: KeyboardEvent): boolean {
  return (
    e.key === "AudioVolumeUp" ||
    e.key === "VolumeUp" ||
    // Köhnə WebKit/Blink kod nömrələri (175 = volume up, 173 = mute toggle).
    e.keyCode === 175 ||
    e.keyCode === 173
  );
}
