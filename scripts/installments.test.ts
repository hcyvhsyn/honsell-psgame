/**
 * lib/installmentsShared.ts testləri.
 *
 * Epoint `get-installment-request` cavabının forması sənəddəki nümunədən
 * götürülüb (Birbank 3/6/12, Tamkart 3/6/9/12). Səhv parse = müştəriyə
 * mövcud olmayan müddət təklif olunur və Epoint ödənişi rədd edir.
 *
 * İşə salmaq: npm run test:installments
 */
import {
  cheapestMonthly,
  installmentAvailable,
  installmentChargeCents,
  installmentMarkupPct,
  monthlyAzn,
  parseInstallmentCards,
  withInstallmentFees,
} from "../lib/installmentsShared";
import { installmentFeePct } from "../lib/installmentRates";

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

console.log("parseInstallmentCards");
const docSample = [
  { name: "Birbank Taksit", installment_card_id: "1", installment_months: [3, 6, 12] },
  { name: "Tamkart Taksit", installment_card_id: "2", installment_months: [3, 6, 9, 12] },
];
check("sənəd nümunəsi", parseInstallmentCards(docSample), [
  { id: "1", name: "Birbank Taksit", months: [3, 6, 12] },
  { id: "2", name: "Tamkart Taksit", months: [3, 6, 9, 12] },
]);
check(
  "rəqəm id, string ay, təkrar və sırasız aylar",
  parseInstallmentCards([{ name: " X ", installment_card_id: 7, installment_months: ["12", 3, 3, "6"] }]),
  [{ id: "7", name: "X", months: [3, 6, 12] }],
);
check(
  "ayı olmayan və ya 1 aylıq kart atılır",
  parseInstallmentCards([
    { name: "A", installment_card_id: "1", installment_months: [] },
    { name: "B", installment_card_id: "2", installment_months: [1] },
  ]),
  [],
);
check(
  "real API forması (obyekt + trace_id, 2026-10)",
  parseInstallmentCards({
    "1": { name: "BirKart", installment_card_id: 1, installment_months: [2, 3, 6, 9, 12, 18] },
    trace_id: "16addad310608a4054248f84521f0009",
  }),
  [{ id: "1", name: "BirKart", months: [2, 3, 6, 9, 12, 18] }],
);
check("xəta obyekti → boş", parseInstallmentCards({ status: "error", message: "x" }), []);
check("null → boş", parseInstallmentCards(null), []);
check("adsız sətir atılır", parseInstallmentCards([{ installment_card_id: "1", installment_months: [3] }]), []);

console.log("monthlyAzn");
check("bərabər bölünür", monthlyAzn(120, 12), 10);
check("qəpiyə yuxarı yuvarlaqlaşır", monthlyAzn(100, 3), 33.34);
check("float səs-küyü (28.18/6)", monthlyAzn(28.18, 6), 4.7);
check("float səs-küyü (125/18)", monthlyAzn(125, 18), 6.95);

console.log("installmentChargeCents (dəqiq örtük: komissiyadan sonra mağazaya düz base qalır)");
check("20% → 100 ₼ müştəriyə 125 ₼", installmentChargeCents(10000, 20), 12500);
check("4% → qəpiyə yuxarı (10416.67 → 10417)", installmentChargeCents(10000, 4), 10417);
check("0% → dəyişmir", installmentChargeCents(10000, 0), 10000);
for (const [fee, base] of [[3, 2573], [13, 25157], [26, 9999], [17, 5000]] as const) {
  const charged = installmentChargeCents(base, fee);
  check(`${fee}%: Epoint faizindən sonra mağazaya ≥ base (${base})`, Math.floor(charged * (1 - fee / 100)) >= base, true);
}

console.log("installmentMarkupPct (müştəriyə göstərilən artım)");
check("20% komissiya → +25%", installmentMarkupPct(20), 25);
check("4% → +4.2%", installmentMarkupPct(4), 4.2);
check("26% → +35.1%", installmentMarkupPct(26), 35.1);
check("0% → 0", installmentMarkupPct(0), 0);

console.log("withInstallmentFees + kabinet cədvəli (2026-10-25 real API cavabı)");
const live = parseInstallmentCards({
  "2": { name: "TamKart", installment_card_id: 2, installment_months: [2, 3, 6, 9, 12, 18, 24] },
  "4": { name: "YapiKredi", installment_card_id: 4, installment_months: [] },
  "1": { name: "BirKart", installment_card_id: 1, installment_months: [2, 3, 6, 9, 12, 18] },
  "3": { name: "BolKart", installment_card_id: 3, installment_months: [3, 6, 9, 12, 18, 24] },
  trace_id: "x",
});
const cards = withInstallmentFees(live, installmentFeePct);
// Obyektin rəqəm açarları JS-də artan sıradadır → Epoint id sırası.
check("YapiKredi (ay yoxdur) atılır", cards.map((c) => c.name), ["BirKart", "TamKart", "BolKart"]);
check(
  "BirKart faizləri kabinetlə eyni",
  cards.find((c) => c.name === "BirKart")?.options,
  [
    { months: 2, feePct: 4 },
    { months: 3, feePct: 5 },
    { months: 6, feePct: 9 },
    { months: 9, feePct: 12 },
    { months: 12, feePct: 15 },
    { months: 18, feePct: 20 },
  ],
);
check(
  "faizi bilinməyən müddət atılır (BirKart 24 ay)",
  withInstallmentFees([{ id: "1", name: "BirKart", months: [18, 24] }], installmentFeePct)[0].options,
  [{ months: 18, feePct: 20 }],
);
check(
  "tanınmayan kart tamamilə atılır",
  withInstallmentFees([{ id: "9", name: "YeniKart", months: [3, 6] }], installmentFeePct),
  [],
);
check("kart adı böyük/kiçik hərfdən asılı deyil", installmentFeePct(" TAMKART ", 24), 26);

console.log("cheapestMonthly / installmentAvailable");
// 100 ₼: BolKart 24 ay 21% → 126.59 / 24 = 5.28 ₼ (TamKart 24 ay 26% → 5.64 ₼).
check("100 ₼ → ən aşağı aylıq", cheapestMonthly(100, cards), { monthlyAzn: 5.28, months: 24 });
check("kart yoxdursa null", cheapestMonthly(100, []), null);
check("min-dən aşağı → yox", installmentAvailable({ enabled: true, minAzn: 50, cards }, 49.99), false);
check("min-ə bərabər → var", installmentAvailable({ enabled: true, minAzn: 50, cards }, 50), true);
check("söndürülüb → yox", installmentAvailable({ enabled: false, minAzn: 0, cards }, 500), false);
check("kart yoxdur → yox", installmentAvailable({ enabled: true, minAzn: 0, cards: [] }, 500), false);

if (failures > 0) {
  console.error(`\n${failures} test uğursuz oldu.`);
  process.exit(1);
}
console.log("\nHamısı keçdi.");
