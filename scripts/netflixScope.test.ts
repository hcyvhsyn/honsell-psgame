/**
 * Netflix satış əhatəsi və çatdırılma qaydası testləri.
 * Səhv olsa ya bağlı xidmət satılır, ya da müştəridən lazımsız məlumat istənir.
 *
 * İşə salmaq: npm run test:netflix
 */
import assert from "node:assert/strict";
import {
  isNetflixProduct,
  isOpenStorePath,
  isSellableServiceProduct,
  isStoreSellableStreaming,
  sellableServiceWhere,
} from "@/lib/storeScope";
import {
  accessModeFromSelection,
  childPlatformCode,
  childPlatformSlug,
  featuresFromText,
  featuresToText,
  isLockedStreamingGroup,
  parseStreamingFeatures,
  resolvePlatformGroup,
  tierKeyFromSlug,
} from "@/lib/streamingAccess";
import { streamingDeliveryMode, streamingUsesCustomerEmail } from "@/lib/streamingCart";
import { serviceInputRequirement } from "@/lib/serviceBundleShared";
import { newPasswordValid } from "@/lib/accountPassword";

const streaming = (service: string, extra: Record<string, unknown> = {}) => ({
  type: "STREAMING",
  metadata: { service, ...extra },
});

// Əhatə: yalnız Netflix kodları açılır.
for (const code of ["NETFLIX_VVIP", "NETFLIX_YANIMDA", "NETFLIX_EVIMD", "NETFLIX_EVIMD_VIP"]) {
  assert.equal(isSellableServiceProduct(streaming(code)), true, code);
}
for (const code of ["HBO_MAX", "GAIN", "PRIME_VIDEO", "NETFLIX"]) {
  assert.equal(isSellableServiceProduct(streaming(code)), false, code);
}
assert.equal(isNetflixProduct("PLATFORM", { service: "NETFLIX_VVIP" }), false);
assert.equal(isSellableServiceProduct({ type: "PS_PLUS" }), true);

// SQL fraqmenti JS yoxlaması ilə eyni kodları tutmalıdır.
const clauses = JSON.stringify(sellableServiceWhere());
for (const code of ["NETFLIX_VVIP", "NETFLIX_YANIMDA", "NETFLIX_EVIMD", "NETFLIX_EVIMD_VIP"]) {
  assert.ok(clauses.includes(`"${code}"`), code);
}
assert.ok(!clauses.includes("HBO_MAX"));

// Path süzgəci: Netflix açıq, qalan streaming bağlı.
for (const path of ["/streaming/netflix", "/streaming/netflix?secim=kabinet", "/streaming/netflix-hesab", "/streaming/netflix-evimde-vip", "/streaming/netflix-hesab/basic"]) {
  assert.equal(isOpenStorePath(path), true, path);
}
for (const path of ["/streaming", "/streaming/hbo-max", "/streaming/katalog", "/streaming/netflixx"]) {
  assert.equal(isOpenStorePath(path), false, path);
}

// Çatdırılma: hesab müştəri məlumatı istəyir, otaq istəmir (köhnə DB dəyərinə baxmayaraq).
assert.equal(streamingUsesCustomerEmail("NETFLIX_VVIP"), true);
assert.equal(streamingUsesCustomerEmail("NETFLIX_EVIMD_VIP"), false);
assert.equal(streamingDeliveryMode({ service: "NETFLIX_VVIP" }), "GMAIL");
assert.equal(streamingDeliveryMode({ service: "NETFLIX_EVIMD_VIP", deliveryMode: "GMAIL" }), "CODE");
assert.equal(streamingDeliveryMode({ service: "NETFLIX_YANIMDA" }), "CODE");
assert.equal(streamingDeliveryMode({ service: "HBO_MAX", deliveryMode: "GMAIL" }), "GMAIL");

// Dəst tələbi checkout budağı ilə eyni olmalıdır.
assert.equal(serviceInputRequirement(streaming("NETFLIX_VVIP")).kind, "EMAIL_PASSWORD");
assert.equal(serviceInputRequirement(streaming("NETFLIX_VVIP")).allowAnyEmail, true);
assert.equal(serviceInputRequirement(streaming("NETFLIX_EVIMD_VIP", { deliveryMode: "GMAIL" })).kind, "NONE");

// Yeni hesab şifrəsi: müştəri seçir, ona görə qayda var; mövcud hesabın şifrəsinə tətbiq olunmur.
assert.equal(newPasswordValid("qisa@1"), false);
assert.equal(newPasswordValid("uzunsifre123"), false);
assert.equal(newPasswordValid("uzunsifre@123"), true);

// ─── Admin-dən qurulan xidmətlər (lib/streamingAccess.ts) ───────────────────
// Satış bayrağı: yalnız `storeSellable: true` açır, Netflix-ə ehtiyac yoxdur.
assert.equal(isSellableServiceProduct(streaming("HBO_MAX_PAYLASIMLI_STANDART", { storeSellable: true })), true);
assert.equal(isSellableServiceProduct(streaming("HBO_MAX_PAYLASIMLI_STANDART", { storeSellable: "true" })), false);
assert.equal(isSellableServiceProduct({ type: "PLATFORM", metadata: { storeSellable: true } }), false);
assert.equal(isStoreSellableStreaming("STREAMING", { service: "HBO_MAX", storeSellable: true }), true);
assert.ok(clauses.includes('"storeSellable"'));
assert.equal(isNetflixProduct("STREAMING", { service: "HBO_MAX", storeSellable: true }), false); // CRM-ə getmir

// Açıq streaming slug-ları (banner linki).
assert.equal(isOpenStorePath("/streaming/hbo-max", new Set(["hbo-max"])), true);
assert.equal(isOpenStorePath("/streaming/hbo-max?secim=sexsi", new Set(["hbo-max"])), true);
assert.equal(isOpenStorePath("/streaming/gain", new Set(["hbo-max"])), false);

// Şəxsi hesab planı: e-poçt (hər provayder) + şifrə; paylaşımlı: heç nə.
const personal = { service: "HBO_MAX_SEXSI_STANDART", accessMode: "PERSONAL", deliveryMode: "CODE" };
const shared = { service: "HBO_MAX_PAYLASIMLI_STANDART", accessMode: "SHARED", deliveryMode: "GMAIL" };
assert.equal(streamingUsesCustomerEmail(personal), true);
assert.equal(streamingUsesCustomerEmail(shared), false);
assert.equal(streamingUsesCustomerEmail("HBO_MAX_SEXSI_STANDART"), false); // kod tək başına tanınmır
assert.equal(streamingDeliveryMode(personal), "GMAIL"); // rejim köhnə deliveryMode-u üstələyir
assert.equal(streamingDeliveryMode(shared), "CODE");
assert.equal(serviceInputRequirement({ type: "STREAMING", metadata: personal }).kind, "EMAIL_PASSWORD");
assert.equal(serviceInputRequirement({ type: "STREAMING", metadata: personal }).emailLabel, "Hesab e-poçtu");
assert.equal(serviceInputRequirement({ type: "STREAMING", metadata: shared }).kind, "NONE");
// Netflix otağı köhnə səhv accessMode ilə də müştəri hesabı istəmir.
assert.equal(streamingUsesCustomerEmail({ service: "NETFLIX_EVIMD", accessMode: "PERSONAL" }), false);
assert.equal(streamingUsesCustomerEmail({ service: "NETFLIX_VVIP" }), true);

// Kod / slug: Azərbaycan hərfləri latına çevrilir.
assert.equal(childPlatformCode("HBO_MAX", "SHARED", "Evimdə VIP"), "HBO_MAX_PAYLASIMLI_EVIMDE_VIP");
assert.equal(childPlatformSlug("hbo-max", "PERSONAL", "Şəxsi Üstün"), "hbo-max-sexsi-sexsi-ustun");
assert.equal(tierKeyFromSlug("hbo-max-paylasimli-standart", "hbo-max", "SHARED"), "standart");
assert.equal(tierKeyFromSlug("netflix-evimde", "netflix", "SHARED"), "netflix-evimde");
assert.equal(accessModeFromSelection("kabinet"), "SHARED");
assert.equal(accessModeFromSelection("sexsi"), "PERSONAL");
assert.equal(accessModeFromSelection("x"), null);

// Netflix planları DB sütunu boş olsa da tanınır; yeni xidmət planı DB-dən.
assert.deepEqual(resolvePlatformGroup({ code: "NETFLIX_VVIP" }), { parentCode: "NETFLIX", accessMode: "PERSONAL" });
assert.deepEqual(resolvePlatformGroup({ code: "NETFLIX_YANIMDA" }), { parentCode: "NETFLIX", accessMode: "SHARED" });
assert.deepEqual(resolvePlatformGroup({ code: "HBO_MAX" }), { parentCode: null, accessMode: null });
assert.deepEqual(
  resolvePlatformGroup({ code: "HBO_MAX_SEXSI_X", parentCode: "hbo_max", accessMode: "PERSONAL" }),
  { parentCode: "HBO_MAX", accessMode: "PERSONAL" },
);
assert.equal(isLockedStreamingGroup("netflix"), true);
assert.equal(isLockedStreamingGroup("HBO_MAX"), false);

// Bulletlər: "+ / - / !" prefiksi ton verir, gediş-dönüş itkisizdir.
const feats = featuresFromText("+ 4K\n- TV yox\n! Bəzən gecikmə\nAdi bənd\n\n");
assert.deepEqual(feats.map((f) => f.tone), ["good", "bad", "warn", "neutral"]);
assert.deepEqual(featuresFromText(featuresToText(feats)), feats);
assert.deepEqual(parseStreamingFeatures([{ text: " x ", tone: "weird" }, { text: "" }, null]), [{ text: "x", tone: "neutral" }]);

console.log("netflixScope: bütün testlər keçdi");
