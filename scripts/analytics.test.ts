/**
 * lib/analyticsShared.ts testləri — `npm run test:analytics`.
 *
 * Bu funksiyalar SƏHV işləsə hesabat yanlış kanala pul yazır və reklam büdcəsi
 * yanlış yerə gedir. Ən kritik hal: **self-referral son toxunuşu üzərinə
 * yazmamalıdır** — yəni Instagram-dan gələn müştəri sayt içində gəzəndə
 * "birbaşa"ya çevrilməməlidir.
 *
 * DB tələb etmir — funksiyalar safdır.
 */
import {
  classifyChannel,
  decodeTouch,
  encodeTouch,
  isPaidMedium,
  isSafeId,
  normalizeHost,
  normalizePath,
  MAX_PATH_LEN,
  type Channel,
} from "../lib/analyticsShared";

let failed = 0;

function check(label: string, got: unknown, want: unknown) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(
      `  FAIL ${label}\n         alındı:      ${JSON.stringify(got)}\n         gözlənilən:  ${JSON.stringify(want)}`,
    );
  }
}

function channel(
  label: string,
  input: Parameters<typeof classifyChannel>[0],
  want: Channel,
) {
  check(label, classifyChannel(input), want);
}

console.log("\n── kanal təsnifatı: utm_source ─────────────────────────────");
channel("utm_source=instagram", { utmSource: "instagram" }, "instagram");
channel("utm_source=IG (böyük hərf)", { utmSource: "IG" }, "instagram");
channel("utm_source=tiktok", { utmSource: "tiktok" }, "tiktok");
channel("utm_source=fb", { utmSource: "fb" }, "facebook");
channel("utm_source=newsletter", { utmSource: "newsletter" }, "email");
channel(
  "utm_source=instagram + medium=cpc → şəbəkə qalır (paid deyil)",
  { utmSource: "instagram", utmMedium: "cpc" },
  "instagram",
);
channel(
  "tanınmayan mənbə + cpc → paid",
  { utmSource: "some-ad-network-x", utmMedium: "cpc" },
  "paid",
);
channel(
  "tanınmayan mənbə, medium yox → xarici sayt",
  { utmSource: "partnyor-blog" },
  "referral_site",
);

console.log("\n── kanal təsnifatı: referrer ───────────────────────────────");
channel("google.com", { referrerHost: "google.com" }, "organic_google");
channel("www.google.az", { referrerHost: "www.google.az" }, "organic_google");
channel("yandex.ru", { referrerHost: "yandex.ru" }, "organic_other");
channel("l.instagram.com (subdomen)", { referrerHost: "l.instagram.com" }, "instagram");
channel("m.facebook.com", { referrerHost: "m.facebook.com" }, "facebook");
channel("l.wa.me", { referrerHost: "l.wa.me" }, "whatsapp");
channel("t.me", { referrerHost: "t.me" }, "telegram");
channel("youtu.be", { referrerHost: "youtu.be" }, "youtube");
channel("tam URL ilə gəlsə də işləyir", { referrerHost: "https://www.tiktok.com/@x" }, "tiktok");
channel("naməlum sayt", { referrerHost: "hansisa-blog.az" }, "referral_site");
channel("heç nə → birbaşa", {}, "direct");

console.log("\n── ən kritik hal: self-referral ────────────────────────────");
// Sayt içi naviqasiya referrer olaraq öz domenimizi göndərir. Əgər bunu kanal
// kimi qəbul etsək, hər daxili klik "referral_site"ə yazılar və Instagram-dan
// gələn müştərinin gəliri yanlış kanala düşər.
//
// Qeyd: `classifyChannel` özü domen bilmir — self-referral filtri VisitorTracker
// tərəfindədir (son toxunuş yalnız XARİCİ host üçün yenilənir). Burada təsdiq
// edirik ki, öz hostumuz gələndə heç olmasa "birbaşa"ya çevrilmir, yəni səhv
// halda belə ilk toxunuş silinmir.
channel("öz domenimiz referrer kimi", { referrerHost: "honsell.store" }, "referral_site");

console.log("\n── ?via= (rəy affiliate) hər şeydən üstündür ───────────────");
channel("via + instagram utm", { hasVia: true, utmSource: "instagram" }, "review_affiliate");
channel("via + google referrer", { hasVia: true, referrerHost: "google.com" }, "review_affiliate");

console.log("\n── ödənişli medium ─────────────────────────────────────────");
check("cpc", isPaidMedium("cpc"), true);
check("Paid_Social", isPaidMedium("Paid_Social"), true);
check("organic", isPaidMedium("organic"), false);
check("boş", isPaidMedium(null), false);

console.log("\n── host normallaşdırması ───────────────────────────────────");
check("www atılır", normalizeHost("www.Google.com"), "google.com");
check("URL-dən host", normalizeHost("https://t.me/kanal?x=1"), "t.me");
check("boş → null", normalizeHost(""), null);
check("zibil URL → null", normalizeHost("://///"), null);

console.log("\n── yol normallaşdırması ────────────────────────────────────");
check("query atılır", normalizePath("/oyunlar/rdr2?utm_source=ig"), "/oyunlar/rdr2");
check("hash atılır", normalizePath("/oyunlar#reyler"), "/oyunlar");
check("kiçik hərf", normalizePath("/Oyunlar/RDR2"), "/oyunlar/rdr2");
check("sondakı slash", normalizePath("/oyunlar/"), "/oyunlar");
check("kök toxunulmur", normalizePath("/"), "/");
check("boş → kök", normalizePath(""), "/");
check("slash-sız yol düzəlir", normalizePath("oyunlar"), "/oyunlar");
check(
  "çox uzun yol kəsilir",
  normalizePath(`/${"a".repeat(500)}`).length,
  MAX_PATH_LEN,
);

console.log("\n── toxunuş kodlaması (cookie formatı) ──────────────────────");
const touch = {
  source: "instagram",
  medium: "cpc",
  campaign: "yay-2026",
  referrerHost: "instagram.com",
  landingPath: "/oyunlar/rdr2",
  at: 1754500000000,
};
const encoded = encodeTouch(touch);
check("kodlanmış format", encoded, "instagram|cpc|yay-2026|instagram.com|/oyunlar/rdr2|1754500000");
check("gediş-dönüş", decodeTouch(encoded), touch);
check("boş → null", decodeTouch(""), null);
check("pozuq sətir → null", decodeTouch("instagram|cpc"), null);
// Dəyərin içindəki boru formatı pozardı — təmizlənməlidir.
check(
  "boru simvolu təmizlənir",
  encodeTouch({ ...touch, campaign: "a|b|c" }),
  "instagram|cpc|abc|instagram.com|/oyunlar/rdr2|1754500000",
);
check(
  "boş toxunuş da 6 hissəlidir",
  encodeTouch({ source: null, medium: null, campaign: null, referrerHost: null, landingPath: null, at: null }),
  "|||||",
);

console.log("\n── ID validasiyası ─────────────────────────────────────────");
check("uuid", isSafeId("018f2a7c-8b1e-7a3d-9f10-1c2b3a4d5e6f"), true);
check("cuid", isSafeId("clx8k2p9q0000abcd1234efgh"), true);
check("boş", isSafeId(""), false);
check("boşluqlu", isSafeId("abc def"), false);
check("SQL cəhdi", isSafeId("'; DROP TABLE--"), false);
check("çox uzun", isSafeId("a".repeat(65)), false);
check("string deyil", isSafeId(123), false);

if (failed > 0) {
  console.log(`\n❌ ${failed} test sındı\n`);
  process.exit(1);
}
console.log("\n✅ bütün testlər keçdi\n");
