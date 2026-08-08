/**
 * lib/oyunforParser.ts testləri — `npm run test:oyunfor`.
 *
 * Səhv parse = müştəriyə yanlış qiymətlə satış, ona görə fixture-lar
 * oyunfor.com/mobil-oyunlar/pubg-mobile-uc səhifəsinin REAL markup-undan
 * götürülüb (2026-08-08). Səhifə şablonu dəyişsə bu test ilk sınan yer olmalıdır.
 *
 * DB tələb etmir — funksiyalar safdır.
 */
import { parseOyunforHtml, parseOyunforMoney, parseOyunforUrl } from "../lib/oyunforParser";

let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ""}`);
  }
}

function eqNum(label: string, got: number, want: number) {
  check(label, Object.is(got, want), `alındı: ${got}, gözlənilən: ${want}`);
}

// ── Pul formatı ────────────────────────────────────────────────────────────
console.log("\n── parseOyunforMoney ───────────────────────────────────────");
eqNum('"212.50"', parseOyunforMoney("212.50"), 212.5);
eqNum('"16250.00"', parseOyunforMoney("16250.00"), 16250);
eqNum('"8872.20"', parseOyunforMoney("8872.20"), 8872.2);
// Türk locale şablonu — mindəlik nöqtə, onluq vergül
eqNum('"1.062,50"', parseOyunforMoney("1.062,50"), 1062.5);
eqNum('"9.540,00"', parseOyunforMoney("9.540,00"), 9540);
// Təkbaşına separator: 3 rəqəmli tam qruplaşma = mindəlik
eqNum('"1.800"', parseOyunforMoney("1.800"), 1800);
eqNum('"1,800"', parseOyunforMoney("1,800"), 1800);
// ...amma 2 rəqəm = onluq
eqNum('"47.70"', parseOyunforMoney("47.70"), 47.7);
eqNum('"47,70"', parseOyunforMoney("47,70"), 47.7);

// ── URL allowlist ──────────────────────────────────────────────────────────
console.log("\n── parseOyunforUrl ─────────────────────────────────────────");
check(
  "oyunfor linki qəbul olunur",
  parseOyunforUrl("https://www.oyunfor.com/mobil-oyunlar/pubg-mobile-uc").hostname ===
    "www.oyunfor.com",
);
check("http → https-ə qaldırılır", parseOyunforUrl("http://oyunfor.com/x").protocol === "https:");
for (const bad of ["https://evil.com/x", "http://localhost:3000/x", "https://oyunfor.com.evil.io/x", "salam"]) {
  let threw = false;
  try {
    parseOyunforUrl(bad);
  } catch {
    threw = true;
  }
  check(`rədd edilir: ${bad}`, threw);
}

// ── Real markup ────────────────────────────────────────────────────────────
// Stokda olan variant: addToCart + data-price + line-through köhnə qiymət.
const IN_STOCK_BOX = `
<div class='productBox '>
  <h3 class='productText '>325 PUBG Mobile UC</h3>
  <span class='productText2 '>325 PUBG UC E Pin olarak teslim edilir.</span>
  <span style='color: #589C40;'><span> +%1 Bonus</span></span>
  <div style="color:#e30a17;font-weight: bold;"> %11 İndirim </div>
  <div style="text-decoration: line-through;font-size: 11px;">238.50 TL</div>
  <div class="notranslate" style="font-weight: bold;"> 212.50 TL </div>
  <div class='button addToCart desktop' data-id='7830' data-type='1' data-price='212.50'
       data-options='[]' data-name='325 PUBG Mobile UC'>SEPETE EKLE</div>
</div>`;

// Endirimsiz variant: nə "%N İndirim", nə line-through var.
const NO_DISCOUNT_BOX = `
<div class='productBox '>
  <h3 class='productText '>660 PUBG Mobile UC</h3>
  <span class='productText2 '>660 PUBG UC E Pin olarak teslim edilir.</span>
  <div class="notranslate" style="font-weight: bold;"> 477.00 TL </div>
  <div class='button addToCart desktop' data-id='7831' data-price='477.00'>SEPETE EKLE</div>
</div>`;

// Stokda OLMAYAN variant: addToCart yoxdur, data-price yoxdur, qiymət görünür.
// JSON-LD burada 9540.00 (= köhnə qiymət) deyir — DOM-dakı 8872.20 doğrudur.
const OUT_OF_STOCK_BOX = `
<div class='productBox '>
  <h3 class='productText '>16200 PUBG Mobile UC</h3>
  <span class='productText2 '>16200 PUBG UC E Pin olarak teslim edilir.</span>
  <a class='button'>DETAY</a>
  <div class='button'>Stok Gelince Haber Ver</div>
  <div style="color:#e30a17;font-weight: bold;"> %7 İndirim </div>
  <div style="text-decoration: line-through;font-size: 11px;">9540.00 TL</div>
  <div class="notranslate" style="font-weight: bold;"> 8872.20 TL </div>
</div>`;

// Bu şablonda görünməyən, amma mümkün olan Top-Up variantı.
const TOPUP_BOX = `
<div class='productBox '>
  <h3 class='productText '>1800 PUBG Mobile UC Top-Up</h3>
  <span class='productText2 '>Oyun ID'nize yüklenir.</span>
  <div class="notranslate"> 1062.50 TL </div>
  <div class='button addToCart' data-price='1062.50'>SEPETE EKLE</div>
</div>`;

// JSON-LD tələsi: `model[].offers.price` stokda olmayan variant üçün YANLIŞDIR.
// Parser `<script>`-ləri atmalıdır, yoxsa 9540.00 götürülərdi.
const LD_TRAP = `
<script type="application/ld+json">
{"@type":"Product","model":[{"offers":{"name":"16200 PUBG Mobile UC","price":"9540.00",
"availability":"http://schema.org/InStock"}}]}
</script>`;

const PAGE = `<html><body>${LD_TRAP}${IN_STOCK_BOX}${NO_DISCOUNT_BOX}${OUT_OF_STOCK_BOX}${TOPUP_BOX}</body></html>`;

console.log("\n── parseOyunforHtml ────────────────────────────────────────");
const items = parseOyunforHtml(PAGE);
eqNum("variant sayı", items.length, 4);

const byAmount = new Map(items.map((i) => [`${i.amount}-${i.deliveryMethod}`, i]));

const uc325 = byAmount.get("325-EPIN");
check("325 UC tapıldı", Boolean(uc325));
if (uc325) {
  eqNum("325 UC cari qiymət", uc325.tryPrice, 212.5);
  eqNum("325 UC köhnə qiymət", uc325.originalTryPrice, 238.5);
  check("325 UC stokdadır", uc325.inStock === true);
  check("325 UC E-PIN-dir", uc325.deliveryMethod === "EPIN");
  check("325 UC mənbə adı saxlanılır", uc325.sourceName === "325 PUBG Mobile UC");
}

const uc660 = byAmount.get("660-EPIN");
check("660 UC tapıldı", Boolean(uc660));
if (uc660) {
  eqNum("660 UC cari qiymət", uc660.tryPrice, 477);
  // Endirim yoxdursa originalTryPrice cari qiymətə bərabərdir (0 və ya NaN yox)
  eqNum("660 UC endirimsiz → original == cari", uc660.originalTryPrice, 477);
}

const uc16200 = byAmount.get("16200-EPIN");
check("16200 UC tapıldı", Boolean(uc16200));
if (uc16200) {
  // ⚠️ Ən vacib assert: JSON-LD-dəki 9540.00 DEYİL, DOM-dakı 8872.20
  eqNum("16200 UC — DOM qiyməti, JSON-LD yox", uc16200.tryPrice, 8872.2);
  eqNum("16200 UC köhnə qiymət", uc16200.originalTryPrice, 9540);
  check("16200 UC mənbədə stokda deyil", uc16200.inStock === false);
}

const topup = byAmount.get("1800-ID_TOPUP");
check("Top-Up variantı ID_TOPUP kimi tanınır", Boolean(topup));
if (topup) eqNum("Top-Up qiyməti", topup.tryPrice, 1062.5);

check(
  "sıralama miqdara görə artandır",
  items.map((i) => i.amount).join(",") === "325,660,1800,16200",
  `alındı: ${items.map((i) => i.amount).join(",")}`,
);

// Eyni variant desktop+mobil olaraq iki dəfə render olunur → dedup işləməlidir.
const dupItems = parseOyunforHtml(`<html>${IN_STOCK_BOX}${IN_STOCK_BOX}</html>`);
eqNum("təkrarlanan blok dedup olunur", dupItems.length, 1);

// Boş / uyğunsuz HTML sınmamalıdır.
eqNum("boş HTML → 0 variant", parseOyunforHtml("<html><body>salam</body></html>").length, 0);

console.log(
  failed === 0
    ? "\n✓ Bütün oyunfor parser testləri keçdi\n"
    : `\n✗ ${failed} test sındı\n`,
);
process.exit(failed === 0 ? 0 : 1);
