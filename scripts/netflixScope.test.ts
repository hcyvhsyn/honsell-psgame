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
  sellableServiceWhere,
} from "@/lib/storeScope";
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

console.log("netflixScope: bütün testlər keçdi");
