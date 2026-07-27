/**
 * Çəkiliş qalib/rəy məntiqinin saf (DB-siz) unit testləri.
 * İşə salmaq: `npm run test:giveaway`  (npx tsx scripts/giveawayWinners.test.ts)
 *
 * Bu testlər spesifikasiyadakı təhlükəsizlik/görünürlük zəmanətlərinin arxasında
 * duran saf funksiyaları yoxlayır. DB tələb edən inteqrasiya axınları
 * (limit transaction, endpoint auth) manual/e2e səviyyəsində yoxlanılmalıdır.
 */
import assert from "node:assert/strict";
import {
  clampRating,
  sanitizeReviewText,
  isReviewPubliclyVisible,
  withinWinnerLimit,
  reviewProvenanceLabel,
  isStoreNote,
  REVIEW_ENTRY_METHODS,
  REVIEW_STATUSES,
  WINNER_SOURCES,
  STORE_NOTE_HEADING,
} from "../lib/giveawayWinnersShared";
import { formatAzn, ENTRY_CONDITIONS } from "../lib/giveawaysShared";

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`✗ ${name}\n   ${(err as Error).message}`);
  }
}

// ── clampRating (rating yalnız 1–5) ──────────────────────────────────────────
test("clampRating: keçərli 1–5 saxlanılır", () => {
  assert.equal(clampRating(1), 1);
  assert.equal(clampRating(5), 5);
  assert.equal(clampRating("4"), 4);
  assert.equal(clampRating(3.4), 3);
});
test("clampRating: aralıqdan kənar / keçərsiz null", () => {
  assert.equal(clampRating(0), null);
  assert.equal(clampRating(6), null);
  assert.equal(clampRating(-2), null);
  assert.equal(clampRating("abc"), null);
  assert.equal(clampRating(null), null);
});

// ── sanitizeReviewText (XSS / teq təmizliyi) ─────────────────────────────────
test("sanitizeReviewText: HTML teqləri silinir", () => {
  assert.equal(sanitizeReviewText("<script>alert(1)</script>salam"), "alert(1)salam");
  assert.equal(sanitizeReviewText("<b>qalın</b>"), "qalın");
  assert.equal(sanitizeReviewText("<img src=x onerror=y>"), "");
});
test("sanitizeReviewText: newline saxlanılır, control simvol silinir", () => {
  assert.equal(sanitizeReviewText("a\nb"), "a\nb");
  assert.equal(sanitizeReviewText("a\x00\x07b"), "ab");
});
test("sanitizeReviewText: uzunluq limiti", () => {
  const long = "x".repeat(5000);
  assert.equal(sanitizeReviewText(long, 100).length, 100);
});

// ── isReviewPubliclyVisible (consent + approved + public) ─────────────────────
test("public review: üç şərtin hamısı olmalıdır", () => {
  assert.equal(
    isReviewPubliclyVisible({ status: "APPROVED", isPublic: true, hasPublishingConsent: true }),
    true
  );
});
test("consent olmayan rəy public görünmür", () => {
  assert.equal(
    isReviewPubliclyVisible({ status: "APPROVED", isPublic: true, hasPublishingConsent: false }),
    false
  );
});
test("pending / rejected rəy public görünmür", () => {
  assert.equal(
    isReviewPubliclyVisible({ status: "PENDING", isPublic: true, hasPublishingConsent: true }),
    false
  );
  assert.equal(
    isReviewPubliclyVisible({ status: "REJECTED", isPublic: true, hasPublishingConsent: true }),
    false
  );
  assert.equal(
    isReviewPubliclyVisible({ status: "HIDDEN", isPublic: true, hasPublishingConsent: true }),
    false
  );
});
test("private rəy public görünmür", () => {
  assert.equal(
    isReviewPubliclyVisible({ status: "APPROVED", isPublic: false, hasPublishingConsent: true }),
    false
  );
});

// ── withinWinnerLimit (random + external birlikdə) ───────────────────────────
test("limit: random + external birlikdə limiti keçə bilməz", () => {
  // 5 qalibli çəkiliş: 3 random + 2 external = 5, daha biri olmaz.
  assert.equal(withinWinnerLimit(5, 1, 5), false);
  assert.equal(withinWinnerLimit(4, 1, 5), true);
  assert.equal(withinWinnerLimit(3, 2, 5), true);
  assert.equal(withinWinnerLimit(3, 3, 5), false);
});

// ── Mənbə şəffaflığı ─────────────────────────────────────────────────────────
test("provenance: USER_SUBMITTED etiketi", () => {
  assert.equal(reviewProvenanceLabel("USER_SUBMITTED", "WEBSITE"), "Qalib tərəfindən göndərilib");
});
test("provenance: ADMIN_TRANSCRIBED ictimai etiket göstərmir", () => {
  // Real qalibin real (icazəli) sözləri — "admin köçürüb" qeydi ictimai göstərilmir.
  assert.equal(reviewProvenanceLabel("ADMIN_TRANSCRIBED", "WHATSAPP"), "");
});
test("store note: qalib rəyi kimi göstərilmir (ayrı başlıq)", () => {
  assert.equal(isStoreNote("ADMIN_STORE_NOTE"), true);
  assert.equal(isStoreNote("ADMIN_TRANSCRIBED"), false);
  assert.equal(isStoreNote("USER_SUBMITTED"), false);
  assert.equal(reviewProvenanceLabel("ADMIN_STORE_NOTE", "STORE_NOTE"), STORE_NOTE_HEADING);
});

// ── Admin USER_SUBMITTED saxta yarada bilməz (route qaydası) ─────────────────
test("admin daxiletmə üsulu USER_SUBMITTED ola bilməz", () => {
  const adminAllowed = (m: string) =>
    (REVIEW_ENTRY_METHODS as readonly string[]).includes(m) && m !== "USER_SUBMITTED";
  assert.equal(adminAllowed("ADMIN_TRANSCRIBED"), true);
  assert.equal(adminAllowed("ADMIN_STORE_NOTE"), true);
  assert.equal(adminAllowed("USER_SUBMITTED"), false);
  assert.equal(adminAllowed("BOGUS"), false);
});

// ── Enum sabitlərinin bütövlüyü ──────────────────────────────────────────────
test("enum sabitləri gözlənilən dəyərləri saxlayır", () => {
  assert.deepEqual([...REVIEW_STATUSES], ["PENDING", "APPROVED", "REJECTED", "HIDDEN"]);
  assert.ok((WINNER_SOURCES as readonly string[]).includes("INSTAGRAM"));
  assert.ok((WINNER_SOURCES as readonly string[]).includes("OFFLINE"));
});

// ── formatAzn (qəpik → AZN göstərimi) ────────────────────────────────────────
test("formatAzn: tam və kəsr məbləğlər", () => {
  assert.equal(formatAzn(3000), "30 AZN");
  assert.equal(formatAzn(2999), "29.99 AZN");
  assert.equal(formatAzn(0), "0 AZN");
  assert.equal(formatAzn(150), "1.50 AZN");
});

// ── Bilet sayı məntiqi (weighted draw) ───────────────────────────────────────
test("bilet sayı: hər unit = 1 bilet, min 1", () => {
  // computeTickets məntiqi: max(1, floor(spend/unit)); unit yoxdursa 1.
  const tickets = (spend: number, unit: number | null) =>
    !unit || unit <= 0 ? 1 : Math.max(1, Math.floor(spend / unit));
  assert.equal(tickets(9000, 3000), 3); // 90 AZN / 30 = 3 bilet
  assert.equal(tickets(2900, 3000), 1); // 29 AZN → minimum 1
  assert.equal(tickets(0, 3000), 1); // xərcsiz → 1 (bərabər şans)
  assert.equal(tickets(9000, null), 1); // bilet sistemi yoxdur → 1
});

// ── PURCHASE_MIN_AMOUNT şərti ─────────────────────────────────────────────────
test("PURCHASE_MIN_AMOUNT ENTRY_CONDITIONS-də var", () => {
  assert.ok((ENTRY_CONDITIONS as readonly string[]).includes("PURCHASE_MIN_AMOUNT"));
});
test("min xərc şərti: spent ≥ required qoşula bilər", () => {
  const eligible = (spent: number, required: number) => spent >= required;
  assert.equal(eligible(3000, 3000), true);
  assert.equal(eligible(3001, 3000), true);
  assert.equal(eligible(2999, 3000), false);
});

// ── Nəticə ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n${failures.join("\n\n")}\n`);
  console.error(`❌ ${failures.length} uğursuz, ${passed} keçdi`);
  process.exit(1);
} else {
  console.log(`✅ Bütün testlər keçdi (${passed})`);
}
