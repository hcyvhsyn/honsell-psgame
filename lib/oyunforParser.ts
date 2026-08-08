/**
 * Oyunfor.com in-game kredit kateqoriya səhifəsi parser-i.
 *
 * Bynogame-dən fərqi: burada admin heç nə kopyalamır — səhifə URL-i verilir,
 * server HTML-i özü çəkir (`fetchOyunforHtml`) və `parseOyunforHtml` variantları
 * çıxarır. Səhifə tam server-render-dir, JS lazım deyil.
 *
 * ⚠️ Səhifədəki JSON-LD (`<script type="application/ld+json">`) **YANILDIR** —
 * stokda olmayan variantlarda `availability` həmişə `InStock` yazır və `price`
 * sahəsi endirimsiz (üstündən keçilmiş) qiyməti verir. Nümunə: 16200 UC üçün
 * JSON-LD 9540.00, DOM-dakı real satış qiyməti 8872.20. Ona görə qiymət və stok
 * **yalnız DOM-dan** oxunur, JSON-LD ümumiyyətlə açılmır.
 *
 * DOM strukturu (hər variant bir `.productBox`):
 *   <h3 class='productText '>325 PUBG Mobile UC</h3>
 *   <span class='productText2 '>325 PUBG UC E Pin olarak teslim edilir.</span>
 *   <div style="color:#e30a17;...">  %11 İndirim </div>
 *   <div style="text-decoration: line-through;...">238.50 TL</div>
 *   <div class="notranslate" ...> 212.50 TL </div>
 *   <div class='button addToCart ...' data-id='7830' data-price='212.50' ...>
 *
 * Stokda olmayan variantda `addToCart` düyməsi (deməli `data-price` də) YOXDUR,
 * yerinə "Stok Gelince Haber Ver" düyməsi gəlir — qiymət isə hələ də görünür.
 */

export type ParsedOyunforItem = {
  amount: number;
  deliveryMethod: "EPIN" | "ID_TOPUP";
  /** Faktiki satış (endirimli) TRY qiyməti. */
  tryPrice: number;
  /** Üstündən keçilmiş TRY qiyməti; endirim yoxdursa `tryPrice`-a bərabərdir. */
  originalTryPrice: number;
  /**
   * Mənbədə (oyunfor) stok var. Bu bizim `ServiceCode` stokumuz DEYİL — sadəcə
   * təchizat siqnalıdır, ona görə import heç bir məhsulu bu sahəyə görə
   * aktivləşdirmir/deaktiv etmir.
   */
  inStock: boolean;
  /** Səhifədəki orijinal başlıq — admin preview-də göstərilir. */
  sourceName: string;
};

const ALLOWED_HOSTS = new Set(["oyunfor.com", "www.oyunfor.com"]);

/** `https://www.oyunfor.com/...` URL-ini yoxlayıb normallaşdırır. */
export function parseOyunforUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("URL düzgün deyil");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Yalnız http/https URL qəbul olunur");
  }
  if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) {
    throw new Error("Yalnız oyunfor.com linkləri qəbul olunur");
  }
  u.protocol = "https:";
  return u;
}

/**
 * Səhifəni serverdə çəkir. Yalnız admin API-dən çağırılır (SSRF-ə qarşı host
 * allowlist `parseOyunforUrl`-dədir).
 */
export async function fetchOyunforHtml(raw: string, timeoutMs = 20_000): Promise<string> {
  const url = parseOyunforUrl(raw);
  const res = await fetch(url.toString(), {
    // Default UA ilə bəzən boş şablon qayıdır.
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Oyunfor səhifəsi açılmadı (HTTP ${res.status})`);
  }
  return res.text();
}

/**
 * Türk/Avropa qarışıq formatlarını oxuyur.
 *
 * Oyunfor "212.50" (nöqtə onluq) yazır, amma bəzi şablonlar "1.062,50" verir —
 * ikisini də düz oxumaq üçün son separator onluq sayılır, təkbaşına duran
 * separator isə yalnız `1.234` / `12.345.678` kimi tam mindəlik qruplaşmada
 * mindəlik sayılır.
 */
export function parseOyunforMoney(raw: string): number {
  const s = raw.replace(/\s/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  let normalized: string;
  if (hasComma && hasDot) {
    normalized =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (hasComma) {
    normalized = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (hasDot) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  } else {
    normalized = s;
  }

  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** "325 PUBG Mobile UC" → 325, "1.800 PUBG Mobile UC" → 1800. */
function extractAmount(name: string): number | null {
  const m = name.match(/(\d[\d.,]*)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

/** HTML entity-lərini sadə mətnə çevirir (başlıqlarda `&amp;` və s. üçün). */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#3[49];/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function parseOyunforHtml(html: string): ParsedOyunforItem[] {
  // `<script>` blokları atılır — JSON-LD-dəki qiymətlər yanıldıcıdır və
  // productBox regex-lərinə qarışırdı.
  const dom = html.replace(/<script[\s\S]*?<\/script>/gi, "");

  const boxes = dom.split(/<div\s+class=['"]productBox/i).slice(1);
  const items: ParsedOyunforItem[] = [];
  const seen = new Set<string>();

  for (const box of boxes) {
    const rawName = firstMatch(box, /class=['"]productText\s*['"]\s*>\s*([^<]+?)\s*</i);
    if (!rawName) continue;
    const name = decodeEntities(rawName);

    const amount = extractAmount(name);
    if (amount === null) continue;

    // Cari qiymət: stokda olanda `data-price`, olmayanda görünən `.notranslate`.
    const priceStr =
      firstMatch(box, /data-price=['"]([\d.,]+)['"]/i) ??
      firstMatch(box, /class=['"]notranslate['"][^>]*>\s*([\d.,]+)\s*TL/i);
    if (!priceStr) continue;
    const tryPrice = parseOyunforMoney(priceStr);
    if (!Number.isFinite(tryPrice) || tryPrice <= 0) continue;

    const oldStr = firstMatch(box, /line-through[^>]*>\s*([\d.,]+)\s*TL/i);
    const parsedOld = oldStr ? parseOyunforMoney(oldStr) : NaN;
    const originalTryPrice =
      Number.isFinite(parsedOld) && parsedOld > tryPrice ? parsedOld : tryPrice;

    // "Stok Gelince Haber Ver" düyməsi = mənbədə stok yoxdur.
    const inStock = /addToCart/i.test(box) && !/Stok\s+Gelince/i.test(box);

    // Oyunfor-da hazırda hamısı E-PIN-dir, amma "Top-Up"/"ID yükleme" adlı
    // variantlar da görünə bilər — ad və alt-başlıqda axtarırıq.
    const subtitle = firstMatch(box, /class=['"]productText2\s*['"]\s*>\s*([^<]+?)\s*</i) ?? "";
    const haystack = `${name} ${subtitle}`;
    const deliveryMethod: "EPIN" | "ID_TOPUP" = /top[\s-]?up|id\s*y[üu]kle/i.test(haystack)
      ? "ID_TOPUP"
      : "EPIN";

    const key = `${amount}-${deliveryMethod}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({ amount, deliveryMethod, tryPrice, originalTryPrice, inStock, sourceName: name });
  }

  items.sort((a, b) => {
    if (a.amount !== b.amount) return a.amount - b.amount;
    return a.deliveryMethod === "EPIN" ? -1 : 1;
  });

  return items;
}
