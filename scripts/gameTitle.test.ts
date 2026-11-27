/**
 * Göstərmə adı testləri (lib/gameTitle.ts).
 *
 * İşə salmaq: npm run test:gametitle
 */
import assert from "node:assert/strict";
import { displayGameTitle } from "@/lib/gameTitle";

const cases: Array<[string, string]> = [
  ["It Takes Two PS4™ ve PS5™", "It Takes Two"],
  ["EA SPORTS FC™ 27 Ultimate Sürüm PS4 ve PS5", "EA SPORTS FC™ 27 Ultimate Sürüm"],
  ["Mortal Kombat 11 Ultimate PS4 & PS5", "Mortal Kombat 11 Ultimate"],
  ["Grand Theft Auto V (PS5 ve PS4)", "Grand Theft Auto V"],
  ["Hogwarts Legacy - PS4/PS5", "Hogwarts Legacy"],
  ["Some Game PS5™ ve PS4™", "Some Game"],
  // Platforma sonluğu yoxdur — dəyişmir.
  ["God of War Ragnarök", "God of War Ragnarök"],
  ["Mortal Kombat X", "Mortal Kombat X"],
  // Tək platforma sonluğu kəsilmir (iki platformalı sonluq deyil).
  ["Astro Bot PS5", "Astro Bot PS5"],
  // Adın ortasında qalan "PS4 ve PS5" → "və".
  ["PS4 ve PS5 Paketi: Crash", "PS4 və PS5 Paketi: Crash"],
  // Platforma olmayan "ve" toxunulmur (ad hissəsi ola bilər).
  ["Ratchet ve Clank", "Ratchet ve Clank"],
  // Yalnız platformadan ibarət ad — xam ad saxlanılır.
  ["PS4 ve PS5", "PS4 və PS5"],
  ["", ""],
];

for (const [input, expected] of cases) {
  assert.equal(displayGameTitle(input), expected, `"${input}"`);
}

console.log(`gameTitle: ${cases.length} hal keçdi`);
