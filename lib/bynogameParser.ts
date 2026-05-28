/**
 * Bynogame PUBG UC qiymət siyahısı parser-i.
 *
 * Admin bynogame səhifəsindən mətni kopyalayır (Ctrl+A → Ctrl+C → paste),
 * biz hər denominasiyanı çıxardırıq. Hər məhsul iki dəfə təkrarlanır
 * (başlıq + alt-başlıq), iki TL qiyməti var (köhnə + endirimli) və əgər
 * "Top-Up" yazılıbsa, bu ID-yə birbaşa yükləmə üçündür.
 *
 * Nümunə blok:
 *   PUBG Mobile 660 UC
 *   PUBG Mobile 660 UC
 *   449,99
 *   TL
 *   416,87       ← biz bunu götürürük (faktiki satış qiyməti)
 *   TL
 *   -%7
 */

export type ParsedBynogameItem = {
  amount: number;
  deliveryMethod: "EPIN" | "ID_TOPUP";
  /** Endirimli (faktiki ödəniləcək) TRY qiyməti. */
  tryPrice: number;
  /** Endirimsiz, üstündən keçilmiş TRY qiyməti (info üçün). */
  originalTryPrice: number;
};

/** Türk locale-də "1.124,99" → 1124.99-a çevirir. */
function parseTurkishNumber(s: string): number {
  // Mindəlik separator "." silinir, onluq "," "."-a çevrilir
  const normalized = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(normalized);
}

export function parseBynogameText(text: string): ParsedBynogameItem[] {
  const items: ParsedBynogameItem[] = [];
  const seen = new Set<string>();

  // Bütün whitespace-ları (newline daxil) tək boşluğa çeviririk ki, regex
  // istəyirsə çoxsətirli mətni də tuta bilsin.
  const normalized = text.replace(/\s+/g, " ").trim();

  // Regex açıqlaması:
  //   P(?:UBG|ubg)\s+Mobile\s+   → "PUBG Mobile" və ya "Pubg Mobile"
  //   (\d+(?:\.\d{3})*)\s+UC     → UC miqdarı (1.800 kimi yazıla bilər)
  //   (\s+Top-Up)?               → istəyə görə "Top-Up" — ID yükləmə deməkdir
  //   [\s\S]*?                   → arada başqa şeylər (təkrarlanan ad, boşluqlar)
  //   (\d[\d\.,]*)\s*TL          → birinci TL qiyməti (köhnə/endirimsiz)
  //   [\s\S]*?
  //   (\d[\d\.,]*)\s*TL          → ikinci TL qiyməti (endirimli — bizim üçün)
  const re =
    /P(?:UBG|ubg)\s+Mobile\s+(\d+(?:\.\d{3})*)\s+UC(\s+Top-Up)?[\s\S]*?(\d[\d.,]*)\s*TL[\s\S]*?(\d[\d.,]*)\s*TL/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const rawAmount = m[1];
    const isTopUp = Boolean(m[2]);
    const originalStr = m[3];
    const discountedStr = m[4];

    // UC miqdarı: "1.800" → 1800, "660" → 660
    const amount = parseInt(rawAmount.replace(/\./g, ""), 10);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const originalTryPrice = parseTurkishNumber(originalStr);
    const tryPrice = parseTurkishNumber(discountedStr);
    if (!Number.isFinite(tryPrice) || tryPrice <= 0) continue;

    // Dublikatları at — eyni miqdar + delivery-method kombinasiyası
    const key = `${amount}-${isTopUp ? "TOPUP" : "EPIN"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      amount,
      deliveryMethod: isTopUp ? "ID_TOPUP" : "EPIN",
      tryPrice,
      originalTryPrice,
    });
  }

  // Tutarlı tərtib: miqdar ↑, sonra EPIN-dən TOPUP-a
  items.sort((a, b) => {
    if (a.amount !== b.amount) return a.amount - b.amount;
    return a.deliveryMethod === "EPIN" ? -1 : 1;
  });

  return items;
}
