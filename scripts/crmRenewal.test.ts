/**
 * /abunelik saf məntiq testləri: nömrə normallaşdırması, imzalı telefon tokeni, minimum məbləğ, CRM telefon hesabı,
 * imzalı sayt sessiyası.
 * İşə salmaq: npm run test:crmrenewal
 */
import assert from "node:assert/strict";
import { formatAzPhone, normalizeAzPhone } from "../lib/abunelik/phoneFormat";
import { createPhoneToken, verifyPhoneToken } from "../lib/abunelik/token";
import { renewalCharge } from "../lib/abunelik/charge";
import { CRM_PLACEHOLDER_EMAIL_SUFFIX, crmPlaceholderEmail, isCrmPlaceholderEmail } from "../lib/crmAccountEmail";
import { readSessionUserId, signSessionValue } from "../lib/sessionToken";

// ── Nömrə ──
const az = { e164: "+994501234567", phone9: "501234567" };
for (const raw of ["050 123 45 67", "0501234567", "501234567", "+994 50 123 45 67", "994501234567", "00994501234567", "9940501234567", "(050) 123-45-67"]) {
  assert.deepEqual(normalizeAzPhone(raw), az, raw);
}
assert.equal(normalizeAzPhone("12345"), null);
assert.equal(normalizeAzPhone(""), null);
assert.equal(normalizeAzPhone("0123"), null);
assert.deepEqual(normalizeAzPhone("+90 532 123 45 67"), { e164: "+905321234567", phone9: "321234567" });
assert.equal(normalizeAzPhone("905321234567"), null, "xarici nömrə + olmadan qəbul edilmir");
assert.equal(formatAzPhone("+994501234567"), "+994 50 123 45 67");

// ── Token ──
process.env.ABUNELIK_COOKIE_SECRET = "test-secret";
const tok = createPhoneToken({ e164: az.e164, phone9: az.phone9, uid: "u1" });
const p = verifyPhoneToken(tok);
assert.ok(p);
assert.equal(p!.p9, az.phone9);
assert.equal(p!.uid, "u1");
// Dəyişdirilmiş payload rədd olunur
const [b64, sig] = tok.split(".");
const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b64, "base64url").toString()), p9: "559999999" })).toString("base64url");
assert.equal(verifyPhoneToken(`${forged}.${sig}`), null, "saxta nömrə");
assert.equal(verifyPhoneToken(`${b64}.xxx`), null, "saxta imza");
assert.equal(verifyPhoneToken(""), null);
// Başqa açarla imzalanmış token keçmir
process.env.ABUNELIK_COOKIE_SECRET = "other-secret";
assert.equal(verifyPhoneToken(tok), null, "başqa açar");
process.env.ABUNELIK_COOKIE_SECRET = "test-secret";
// Vaxtı keçmiş
const realNow = Date.now;
Date.now = () => realNow() + 3 * 60 * 60 * 1000;
assert.equal(verifyPhoneToken(tok), null, "vaxtı keçib");
Date.now = realNow;

// ── Məbləğ ──
// CRM qiyməti + 3% xidmət haqqı; qiymət+haqq < 5 ₼ olanda kartdan 5 ₼, fərq cüzdana.
assert.deepEqual(renewalCharge(6), { priceCents: 600, serviceFeeCents: 18, payableCents: 618, chargeCents: 618, topUpCents: 0 });
assert.deepEqual(renewalCharge(9), { priceCents: 900, serviceFeeCents: 27, payableCents: 927, chargeCents: 927, topUpCents: 0 });
assert.deepEqual(renewalCharge(3), { priceCents: 300, serviceFeeCents: 9, payableCents: 309, chargeCents: 500, topUpCents: 191 });
assert.deepEqual(renewalCharge(12.99), { priceCents: 1299, serviceFeeCents: 39, payableCents: 1338, chargeCents: 1338, topUpCents: 0 });
assert.deepEqual(renewalCharge(5), { priceCents: 500, serviceFeeCents: 15, payableCents: 515, chargeCents: 515, topUpCents: 0 });
assert.deepEqual(renewalCharge(4.9), { priceCents: 490, serviceFeeCents: 15, payableCents: 505, chargeCents: 505, topUpCents: 0 });

// ── CRM telefon hesabı (placeholder e-poçt) ──
assert.equal(crmPlaceholderEmail("+994501234567"), "994501234567@crm.honsell.invalid");
assert.equal(crmPlaceholderEmail(normalizeAzPhone("050 123 45 67")!.e164), crmPlaceholderEmail("+994501234567"), "eyni nömrə → eyni ünvan");
assert.ok(isCrmPlaceholderEmail("994501234567@crm.honsell.invalid"));
assert.ok(isCrmPlaceholderEmail("Ad Soyad <994501234567@CRM.honsell.invalid>"));
assert.ok(!isCrmPlaceholderEmail("ali@gmail.com"));
assert.ok(!isCrmPlaceholderEmail("crm.honsell.invalid@gmail.com"));
assert.ok(!isCrmPlaceholderEmail(null));
assert.ok(("x" + CRM_PLACEHOLDER_EMAIL_SUFFIX).endsWith("@crm.honsell.invalid"));

// ── İmzalı sayt sessiyası ──
{
  const prevSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-session-secret";
  const v = signSessionValue("cmabc123");
  assert.equal(readSessionUserId(v), "cmabc123");
  assert.equal(readSessionUserId("cmabc123"), null, "imzasız köhnə cookie qəbul olunmur");
  assert.equal(readSessionUserId(`cmother.${v.split(".")[1]}`), null, "başqa id ilə imza keçmir");
  assert.equal(readSessionUserId(`${v}x`), null);
  assert.equal(readSessionUserId(""), null);
  process.env.SESSION_SECRET = "another-secret";
  assert.equal(readSessionUserId(v), null, "açar dəyişəndə sessiya bitir");
  if (prevSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = prevSecret;
}

console.log("crmRenewal: bütün testlər keçdi");

// ── Birbaşa giriş linki ──
import("../lib/abunelik/token").then(({ createLinkToken, verifyLinkToken, createPhoneToken: cpt, verifyPhoneToken: vpt }) => {
  process.env.ABUNELIK_COOKIE_SECRET = "test-secret";
  const link = createLinkToken({ e164: az.e164, phone9: az.phone9 });
  assert.equal(verifyLinkToken(link)?.p9, az.phone9);
  assert.equal(vpt(link), null, "link tokeni cookie kimi keçmir");
  const cookieTok = cpt({ e164: az.e164, phone9: az.phone9, uid: null });
  assert.equal(verifyLinkToken(cookieTok), null, "cookie tokeni link kimi keçmir");
  const now = Date.now;
  Date.now = () => now() + 25 * 60 * 60 * 1000;
  assert.equal(verifyLinkToken(link), null, "link 24 saatdan sonra keçmir");
  Date.now = now;
  console.log("crmRenewal link: testlər keçdi");
});
