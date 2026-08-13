/**
 * lib/psStoreConcept.ts testləri.
 *
 * Fixture-lar **real** PS Store concept səhifələrindən götürülüb — səhv parse
 * = vitrində yanlış ad/qiymət (məhz 230079 hadisəsi: concept adı "Part II",
 * default SKU isə "Part II Remastered" və endirim onundur).
 *
 * İşə salmaq: npm run test:concept
 */
import {
  isConceptProductId,
  parseConceptDefaultProduct,
  psStoreProductUrl,
} from "../lib/psStoreConcept";

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

/** Real səhifənin apolloState-inin kiçildilmiş, amma eyni formalı nüsxəsi. */
function conceptHtml(
  conceptId: string,
  conceptName: string,
  sku: string,
  skuName: string,
  locale = "tr-tr"
): string {
  const ref = `Product:${sku}:${locale}`;
  const data = {
    props: {
      apolloState: {
        [`Concept:${conceptId}:${locale}`]: {
          __typename: "Concept",
          id: conceptId,
          name: conceptName,
          defaultProduct: { __ref: ref },
        },
        [ref]: { __typename: "Product", id: sku, name: skuName },
      },
    },
  };
  return `<html><body><div>x</div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    data
  )}</script></body></html>`;
}

console.log("isConceptProductId");
check("rəqəmli id concept-dir", isConceptProductId("230079"), true);
check("uzun rəqəmli id concept-dir", isConceptProductId("10002694"), true);
check(
  "SKU concept deyil",
  isConceptProductId("EP9000-PPSA15508_00-THELASTOFUSPART2"),
  false
);
check(
  "Epic id concept deyil",
  isConceptProductId("epic:0c40923dd1174a768f732a3b013dcff2:0f0fe55f8a"),
  false
);

console.log("\npsStoreProductUrl");
check(
  "concept id → /concept/",
  psStoreProductUrl("230079"),
  "https://store.playstation.com/tr-tr/concept/230079"
);
check(
  "SKU → /product/",
  psStoreProductUrl("EP9000-PPSA15508_00-THELASTOFUSPART2"),
  "https://store.playstation.com/tr-tr/product/EP9000-PPSA15508_00-THELASTOFUSPART2"
);

console.log("\nparseConceptDefaultProduct — real hallar");
// 230079: concept adı ilə SKU adı FƏRQLİDİR. Vitrindəki səhvin mənbəyi budur —
// parse SKU-nun öz adını qaytarmalıdır, concept-inkini yox.
check(
  "TLOU Part II concept → Remastered SKU-su",
  parseConceptDefaultProduct(
    conceptHtml(
      "230079",
      "The Last of Us™ Part II",
      "EP9000-PPSA15508_00-THELASTOFUSPART2",
      "The Last of Us™ Part II Remastered"
    ),
    "230079"
  ),
  {
    productId: "EP9000-PPSA15508_00-THELASTOFUSPART2",
    title: "The Last of Us™ Part II Remastered",
    conceptName: "The Last of Us™ Part II",
  }
);

check(
  "TLOU Part I concept → eyni adlı SKU",
  parseConceptDefaultProduct(
    conceptHtml(
      "10002694",
      "The Last of Us™ Part I",
      "EP9000-PPSA07642_00-THELASTOFUSPART1",
      "The Last of Us™ Part I"
    ),
    "10002694"
  ),
  {
    productId: "EP9000-PPSA07642_00-THELASTOFUSPART1",
    title: "The Last of Us™ Part I",
    conceptName: "The Last of Us™ Part I",
  }
);

console.log("\nparseConceptDefaultProduct — sərhəd halları");
check(
  "başqa locale-də də tapılır (açar prefiksə görə axtarılır)",
  parseConceptDefaultProduct(
    conceptHtml("230079", "X", "EP9000-PPSA15508_00-THELASTOFUSPART2", "Y", "en-us"),
    "230079"
  )?.productId,
  "EP9000-PPSA15508_00-THELASTOFUSPART2"
);
check(
  "__NEXT_DATA__ yoxdursa null",
  parseConceptDefaultProduct("<html><body>boş</body></html>", "230079"),
  null
);
check(
  "pozuq JSON-da null",
  parseConceptDefaultProduct(
    '<script id="__NEXT_DATA__" type="application/json">{oops</script>',
    "230079"
  ),
  null
);
check(
  "başqa concept id-si soruşulsa null",
  parseConceptDefaultProduct(
    conceptHtml("230079", "X", "EP9000-PPSA15508_00-THELASTOFUSPART2", "Y"),
    "999999"
  ),
  null
);
check(
  "defaultProduct yoxdursa null",
  parseConceptDefaultProduct(
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { apolloState: { "Concept:230079:tr-tr": { id: "230079", name: "X" } } },
    })}</script>`,
    "230079"
  ),
  null
);
// Concept başqa concept-ə işarə edərsə sətri "düzəltmiş" saymamalıyıq —
// yenə rəqəmli id alardıq və ölü link problemi qalardı.
check(
  "defaultProduct yenə concept-dirsə null",
  parseConceptDefaultProduct(
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        apolloState: {
          "Concept:230079:tr-tr": {
            id: "230079",
            name: "X",
            defaultProduct: { __ref: "Product:230079:tr-tr" },
          },
        },
      },
    })}</script>`,
    "230079"
  ),
  null
);
check(
  "SKU adı boşdursa title null, productId qalır",
  parseConceptDefaultProduct(
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        apolloState: {
          "Concept:230079:tr-tr": {
            id: "230079",
            name: "X",
            defaultProduct: { __ref: "Product:EP9000-PPSA15508_00-THELASTOFUSPART2:tr-tr" },
          },
        },
      },
    })}</script>`,
    "230079"
  ),
  {
    productId: "EP9000-PPSA15508_00-THELASTOFUSPART2",
    title: null,
    conceptName: "X",
  }
);

console.log(
  failures === 0 ? "\n✅ bütün testlər keçdi" : `\n❌ ${failures} test uğursuz`
);
process.exit(failures === 0 ? 0 : 1);
