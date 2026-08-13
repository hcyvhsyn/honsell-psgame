/**
 * lib/psStoreListing.ts — listinq JSON → `ScrapedGame` çevirməsinin testləri.
 *
 * Fixture-lar **real** `categoryGridRetrieve` / `getSearchResults` cavablarından
 * götürülüb (yalnız media siyahısı qısaldılıb). Səhv parse = kataloqda yanlış
 * qiymət və ya ölü link, ona görə hər sahə ayrıca yoxlanılır.
 *
 * ⚠️ Şəbəkəyə çıxmır — `fetchCategoryPage`/`fetchSearchPage` burada sınanmır,
 * onların hash-i canlı mağazadan asılıdır. Hash köhnəldiyini scrape-in özü
 * bildirir (bax: lib/psStoreListing.ts bərpa resepti).
 *
 * İşə salmaq: npm run test:listing
 */
import {
  extractListingItems,
  psStoreCategoryId,
  resolvePlatform,
} from "../lib/psStoreListing";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}\n      gözlənilən: ${e}\n      alınan:     ${a}`);
  }
}

// ─── Fixture: endirimli PS5 SKU-su (deals hub sətri) ─────────────────────────
const discountedProduct = {
  __typename: "Product",
  id: "HP6545-PPSA23226_00-GAME000000000000",
  name: "Black Myth: Wukong",
  npTitleId: "PPSA23226_00",
  platforms: ["PS5"],
  storeDisplayClassification: "FULL_GAME",
  localizedStoreDisplayClassification: "Tam Oyun",
  media: [
    { __typename: "Media", role: "PREVIEW", type: "VIDEO", url: "https://cdn/trailer.mp4" },
    { __typename: "Media", role: "BACKGROUND", type: "IMAGE", url: "https://cdn/hero.png" },
    { __typename: "Media", role: "SCREENSHOT", type: "IMAGE", url: "https://cdn/shot1.jpg" },
    { __typename: "Media", role: "MASTER", type: "IMAGE", url: "https://cdn/cover.png" },
  ],
  price: {
    __typename: "SkuPrice",
    basePrice: "2.499,00 TL",
    discountedPrice: "1.749,30 TL",
    discountText: "-%30",
  },
};

// ─── Fixture: endirimsiz PS4 SKU-su ─────────────────────────────────────────
const fullPriceProduct = {
  __typename: "Product",
  id: "EP9000-CUSA07820_00-THELASTOFUSPART2",
  name: "The Last of Us™ Part II",
  platforms: [],
  storeDisplayClassification: "ADD_ON_PACK",
  localizedStoreDisplayClassification: "Eklenti Paketi",
  media: [{ __typename: "Media", role: "MASTER", type: "IMAGE", url: "https://cdn/tlou.png" }],
  price: { __typename: "SkuPrice", basePrice: "899,00 TL", discountedPrice: "899,00 TL" },
};

// ─── Fixture: concept sətri (PS5 hub-ları bunu qaytarır) ────────────────────
const conceptRow = {
  __typename: "Concept",
  id: "10015869",
  name: "Fable",
  media: [{ __typename: "Media", role: "MASTER", type: "IMAGE", url: "https://cdn/fable.png" }],
  price: { __typename: "SkuPrice", basePrice: "2.999,00 TL", discountedPrice: "2.999,00 TL" },
  products: [{ __typename: "Product", id: "UP6312-PPSA31381_00-0202050640964065" }],
};

console.log("psStoreCategoryId");
check(
  "səhifəli URL",
  psStoreCategoryId(
    "https://store.playstation.com/tr-tr/category/b24c16e8-6475-4477-8364-41ec777792d5/1"
  ),
  "b24c16e8-6475-4477-8364-41ec777792d5"
);
check(
  "səhifəsiz URL",
  psStoreCategoryId(
    "https://store.playstation.com/tr-tr/category/b24c16e8-6475-4477-8364-41ec777792d5"
  ),
  "b24c16e8-6475-4477-8364-41ec777792d5"
);
check("xam id", psStoreCategoryId("b24c16e8-6475-4477-8364-41ec777792d5"), "b24c16e8-6475-4477-8364-41ec777792d5");
check("məhsul linki kateqoriya deyil", psStoreCategoryId("https://store.playstation.com/tr-tr/product/EP0001"), null);
check("boş sətir", psStoreCategoryId("   "), null);

console.log("\nresolvePlatform");
check("platforms sahəsi üstündür", resolvePlatform("EP0001-CUSA00001_00-X", ["PS5"]), "PS5");
check("PS5 əvvəl sıralanır", resolvePlatform("X", ["PS4", "PS5"]), "PS5,PS4");
check("boş massiv → id-dən", resolvePlatform("EP0001-PPSA00001_00-X", []), "PS5");
check("CUSA → PS4", resolvePlatform("EP0001-CUSA00001_00-X", null), "PS4");
check("concept id → naməlum", resolvePlatform("10015869", null), null);

console.log("\nextractListingItems — endirimli məhsul");
{
  const [row] = extractListingItems([discountedProduct]);
  check("qiymət kuruşa çevrilir", row.priceTryCents, 249900);
  check("endirim kuruşa çevrilir", row.discountTryCents, 174930);
  check("başlıq", row.title, "Black Myth: Wukong");
  check("kaver MASTER-dən gəlir (videodan yox)", row.imageUrl, "https://cdn/cover.png");
  check("hero BACKGROUND-dan", row.heroImageUrl, "https://cdn/hero.png");
  check("trailer PREVIEW/VIDEO-dan", row.trailerUrl, "https://cdn/trailer.mp4");
  check("skrinşotlarda kaver/hero təkrarlanmır", row.screenshots, ["https://cdn/shot1.jpg"]);
  check("SKU linki /product/", row.productUrl, "https://store.playstation.com/tr-tr/product/HP6545-PPSA23226_00-GAME000000000000");
  check("platforma", row.platform, "PS5");
  check("tip", row.productType, "GAME");
  check("sürüm etiketi", row.editionLabel, "Tam Oyun");
  check("bitmə tarixi listinqdə YOXDUR", row.discountEndAt, null);
}

console.log("\nextractListingItems — endirimsiz məhsul");
{
  const [row] = extractListingItems([fullPriceProduct]);
  // ⚠️ Mağaza endirim olmayanda `discountedPrice`-ı baza qiymətlə DOLDURUR —
  // xam sahəni yazsaq kataloqda hər məhsul "endirimli" görünərdi.
  check("bərabər discountedPrice endirim sayılmır", row.discountTryCents, null);
  check("ADD_ON_PACK → ADDON", row.productType, "ADDON");
  check("boş platforms → id-dən PS4", row.platform, "PS4");
}

console.log("\nextractListingItems — concept sətri");
{
  const [row] = extractListingItems([conceptRow]);
  check("concept id saxlanılır", row.productId, "10015869");
  // ⚠️ `/product/<rəqəm>` 302 ilə ana səhifəyə atır — concept linki /concept/ olmalıdır.
  check("concept linki /concept/", row.productUrl, "https://store.playstation.com/tr-tr/concept/10015869");
  check("təsnifatsız concept → GAME", row.productType, "GAME");
  check("platforma naməlum (Phase 2.4 həll edir)", row.platform, null);
}

console.log("\nextractListingItems — quruluş");
{
  // Real cavab `{ products: [...], concepts: [...] }` formasındadır; çıxarış
  // ağacda gəzdiyi üçün həm massiv, həm də obyekt girişi işləməlidir.
  const nested = { data: { categoryGridRetrieve: { products: [discountedProduct], concepts: [conceptRow] } } };
  check("iç-içə obyektdən çıxarır", extractListingItems(nested).map((r) => r.productId), [
    "HP6545-PPSA23226_00-GAME000000000000",
    "10015869",
  ]);
  check(
    "eyni id təkrarlanmır",
    extractListingItems([discountedProduct, discountedProduct]).length,
    1
  );
  check("qiymətsiz sətir atılır", extractListingItems([{ id: "X", name: "Y", price: {} }]).length, 0);
  check("məhsulsuz cavab boş qaytarır", extractListingItems({ data: { categoryGridRetrieve: null } }).length, 0);
}

if (failures > 0) {
  console.error(`\n${failures} test uğursuz.`);
  process.exit(1);
}
console.log("\nBütün testlər keçdi.");
