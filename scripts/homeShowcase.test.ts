/**
 * Ana səhifə Netflix/Spotify vitrini (lib/homeSubscriptionShowcase.ts) testləri.
 * Səhv olsa ya paket ana səhifədə görünmür, ya da kart başqa paketi seçili açır.
 *
 * İşə salmaq: npm run test:homeshowcase
 */
import assert from "node:assert/strict";
import {
  buildHomeSubscriptionShowcase,
  buildShowcaseOffers,
  isShowcaseSpotifyProduct,
} from "@/lib/homeSubscriptionShowcase";

let n = 0;
const netflix = (service: string, months: number, price: number, extra: Record<string, unknown> = {}) => ({
  id: `nf-${++n}`,
  type: "STREAMING",
  priceAznCents: price * 100,
  metadata: { service, durationMonths: months, ...extra },
});
const spotify = (planTier: string, months: number, price: number, extra: Record<string, unknown> = {}) => ({
  id: `sp-${++n}`,
  type: "PLATFORM",
  priceAznCents: price * 100,
  metadata: { category: "MUSIC", musicBrand: "SPOTIFY", planTier, durationMonths: months, accountSlots: 1, ...extra },
});

const products = [
  netflix("NETFLIX_VVIP", 1, 20, { variantSlug: "basic" }),
  netflix("NETFLIX_VVIP", 2, 38, { variantSlug: "basic" }),
  netflix("NETFLIX_VVIP", 1, 36, { variantSlug: "premium" }),
  netflix("NETFLIX_VVIP", 1, 99, { variantSlug: "yoxdur" }), // naməlum plan — göstərilmir
  netflix("NETFLIX_YANIMDA", 12, 72),
  netflix("NETFLIX_YANIMDA", 1, 8),
  netflix("NETFLIX_YANIMDA", 3, 22),
  netflix("NETFLIX_YANIMDA", 1, 14, { seats: 2 }),
  // Prod-dakı kimi köhnə matris bayrağı — vitrin onu nəzərə ALMAMALIDIR.
  netflix("NETFLIX_EVIMD_VIP", 1, 15, { hideFromLanding: true }),
  netflix("NETFLIX", 1, 5), // köhnə kod satılmır
  netflix("HBO_MAX", 1, 9), // başqa xidmət
  spotify("INDIVIDUAL", 3, 16, { originalPriceAznCents: 1800 }),
  spotify("INDIVIDUAL", 1, 6),
  // Prod music admin brendi platforma kodundan yazır: "SPOTIFY_PREMIUM".
  spotify("FAMILY", 1, 14, { accountSlots: 5, musicBrand: "SPOTIFY_PREMIUM", hideFromLanding: true }),
  { id: "sp-x", type: "PLATFORM", priceAznCents: 500, metadata: { musicBrand: "SPOTIFY" } }, // planTier yoxdur
];

const [nf, sp, ...rest] = buildHomeSubscriptionShowcase(products, {
  netflix: { guideVideoUrl: "https://youtu.be/dQw4w9WgXcQ" },
});
assert.equal(rest.length, 0);
assert.equal(nf.key, "netflix");
assert.equal(sp.key, "spotify");

// Netflix: hesab planları əvvəl (Basic, Standart yoxdur, Premium), sonra otaqlar; 2 nəfər ayrıca sətir.
assert.deepEqual(
  nf.groups.map((g) => [g.key, g.rows.map((r) => r.title)]),
  [
    ["hesab", ["Basic", "Premium"]],
    ["otaq", ["Yanımda", "Yanımda · 2 nəfər", "Evimdə VIP"]],
  ],
);
assert.equal(nf.offerCount, 2 + 1 + 3 + 1 + 1);

const basic = nf.groups[0].rows[0];
assert.deepEqual(basic.offers.map((o) => o.months), [1, 2]);
assert.match(basic.offers[0].href, /^\/streaming\/netflix-hesab\?mehsul=nf-1$/);

// Otaq: müddətlər sıralanır, qənaət 1 aylığa nisbətən, link paket + mehsul daşıyır.
const yanimda = nf.groups[1].rows[0];
assert.deepEqual(yanimda.offers.map((o) => o.months), [1, 3, 12]);
assert.deepEqual(yanimda.offers.map((o) => o.savingPct), [0, 8, 25]);
assert.deepEqual(yanimda.offers.map((o) => o.best), [false, false, true]);
assert.equal(yanimda.offers[2].perMonthAzn, 6);
assert.match(yanimda.offers[0].href, /^\/streaming\/netflix\?secim=kabinet&paket=yanimda&mehsul=nf-\d+$/);
assert.equal(nf.groups[1].rows[2].offers[0].href.includes("paket=evimdevip"), true);
// Başlıqdakı "ayda X ₼-dan" — ən ucuz aylıq (Yanımda 12 ay = 6 ₼).
assert.equal(nf.fromPerMonthAzn, 6);

// Spotify: planTier-siz paket vitrinə düşmür (matrisdə qalır), köhnə qiymət ötürülür.
assert.deepEqual(sp.groups[0].rows.map((r) => [r.title, r.caption]), [
  ["Individual", "1 hesab"],
  ["Family", "5 hesab"],
]);
const individual = sp.groups[0].rows[0].offers;
assert.deepEqual(individual.map((o) => o.months), [1, 3]);
assert.equal(individual[1].originalAzn, 18);
assert.equal(individual[0].originalAzn, null);
assert.match(individual[0].href, /^\/music\/spotify-premium\?mehsul=sp-\d+$/);
assert.equal(isShowcaseSpotifyProduct("PLATFORM", { musicBrand: "SPOTIFY" }), false);
assert.equal(isShowcaseSpotifyProduct("PLATFORM", { musicBrand: "SPOTIFY_PREMIUM", planTier: "FAMILY" }), true);
assert.equal(isShowcaseSpotifyProduct("PLATFORM", { musicBrand: "YOUTUBE_PREMIUM", planTier: "FAMILY" }), false);
assert.equal(sp.guide, null);

// Bələdçi: video ID linkdən çıxarılır; yalnız vitrində kartı olan planlar izah olunur.
assert.ok(nf.guide);
assert.equal(nf.guide.videoId, "dQw4w9WgXcQ");
assert.deepEqual(
  nf.guide.groups.map((g) => [g.title, g.plans.map((p) => p.name)]),
  [
    ["Öz hesabına plan", ["Basic", "Premium"]],
    ["Sənə aid otaq", ["Yanımda", "Evimdə VIP"]],
  ],
);
// Hesab planlarında yalnız fərqi göstərən bulletlər (çözünürlük, ekran, kimlər üçün).
assert.equal(nf.guide.groups[0].plans[0].points.length, 3);
assert.ok(nf.guide.groups[1].plans[0].points.some((p) => p.tone === "bad")); // Yanımda: TV yox
// Link yoxdur / yanlışdır → video yox, müqayisə qalır.
assert.equal(buildHomeSubscriptionShowcase(products)[0].guide?.videoId, null);
assert.equal(
  buildHomeSubscriptionShowcase(products, { netflix: { guideVideoUrl: "https://example.com/x" } })[0].guide?.videoId,
  null,
);
assert.equal(isShowcaseSpotifyProduct("PLATFORM", { musicBrand: "spotify", planTier: "duo" }), true);
assert.equal(isShowcaseSpotifyProduct("STREAMING", { musicBrand: "SPOTIFY", planTier: "DUO" }), false);

// Eyni müddətə iki paket — ucuzu; müddətsiz paket atılır; tək kart "Ən sərfəli" olmur.
const dup = buildShowcaseOffers(
  [
    { id: "a", type: "STREAMING", priceAznCents: 900, metadata: { durationMonths: 1 } },
    { id: "b", type: "STREAMING", priceAznCents: 800, metadata: { durationMonths: 1 } },
    { id: "c", type: "STREAMING", priceAznCents: 100, metadata: {} },
  ],
  (p) => p.id,
);
assert.deepEqual(dup.map((o) => [o.id, o.best]), [["b", false]]);

// Kart qapağı (visual): hesab planı keyfiyyət + ekran, otaq cihaz + nəfər, Spotify hesab sayı.
const premium = nf.groups[0].rows[1].visual;
assert.deepEqual([premium.badge, premium.headline, premium.count.n, premium.count.kind, premium.devices.length], [
  "Öz hesabın",
  "4K",
  4,
  "screens",
  0,
]);
const tvOf = (row: (typeof nf.groups)[number]["rows"][number]) => row.visual.devices.find((d) => d.key === "tv")?.allowed;
assert.equal(tvOf(nf.groups[1].rows[0]), false); // Yanımda: TV yox
assert.equal(tvOf(nf.groups[1].rows[2]), true); // Evimdə VIP: TV var
assert.deepEqual(nf.groups[1].rows[1].visual.count, { n: 2, label: "2 nəfər", kind: "people" });
assert.deepEqual(
  nf.groups.map((g) => g.hint.length > 0),
  [true, true],
);
assert.deepEqual(sp.groups[0].rows.map((r) => [r.visual.headline, r.visual.count.n]), [
  ["Individual", 1],
  ["Family", 5],
]);

// Heç bir paket yoxdursa brend göstərilmir.
assert.deepEqual(buildHomeSubscriptionShowcase([]), []);

console.log("homeShowcase: OK");
