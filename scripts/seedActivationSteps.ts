/**
 * PS TRY hədiyyə kartı üçün aktivləşdirmə addımlarının BAŞLANĞIC məzmunu.
 *
 * Addımlar ÜSULLARA bölünüb (`method`) — konsol / mobil tətbiq / brauzer.
 * Bunlar alternativ yollardır, ardıcıl axın deyil: public-də hər üsul öz tab-ında
 * göstərilir və nömrələmə hər tab-ın içində 1-dən başlayır.
 *
 * Skript İDEMPOTENTDİR və üstündən yazmır:
 *   • scope-da heç nə yoxdursa → tam məzmunu yazır;
 *   • yalnız köhnə (üsulsuz) seed varsa → onu silib strukturlu variantla dəyişir;
 *   • admin əl ilə redaktə edibsə (üsullar artıq təyin olunub) → TOXUNMUR.
 *
 * Şəkillər QƏSDƏN boşdur — admin paneldən yüklənir.
 *
 *   npx tsx scripts/seedActivationSteps.ts
 *
 * .env avtomatik yüklənir (dotenv/config). DATABASE_URL qurulmalıdır.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";

const SCOPE = "GIFT_CARDS_TRY";

const STEPS: { method: string; title: string; body: string }[] = [
  // ─── PS konsolu ───────────────────────────────────────────────────────────
  {
    method: "PS konsolu",
    title: "PSN hesabına daxil ol",
    body: "Konsolu aç və ana menyudan PlayStation Network hesabına giriş et.",
  },
  {
    method: "PS konsolu",
    title: "PlayStation Store → «…» (Digər)",
    body: 'Store-u aç, sol menyunun aşağısındaki "…" (Digər) bölməsinə keç.',
  },
  {
    method: "PS konsolu",
    title: "«Kodu istifadə et» seç və kodu yaz",
    body:
      "12 simvollu kodu daxil edib təsdiqlə. Balans dərhal TRY wallet-inə əlavə olunur.",
  },

  // ─── Mobil tətbiq ─────────────────────────────────────────────────────────
  {
    method: "Mobil tətbiq",
    title: "PlayStation App-ı aç və giriş et",
    body: "iOS və ya Android tətbiqini aç, PSN hesabına daxil ol.",
  },
  {
    method: "Mobil tətbiq",
    title: "Alt menyudan alış-veriş ikonuna toxun",
    body: "Ekranın altındaki mağaza (çanta) ikonu PlayStation Store-u açır.",
  },
  {
    method: "Mobil tətbiq",
    title: "«Kodu istifadə et» → kodu yaz",
    body: "Kodu daxil edib təsdiqlə; məbləğ dərhal balansa düşür.",
  },

  // ─── Brauzer ──────────────────────────────────────────────────────────────
  {
    method: "Brauzer",
    title: "store.playstation.com-a daxil ol",
    body: "Ünvana keç və PSN hesabınla oturum aç.",
  },
  {
    method: "Brauzer",
    title: "Profil ikonu → «Kodu istifadə et»",
    body: "Sağ üst küncdəki profil ikonuna toxun və həmin seçimə keç.",
  },
  {
    method: "Brauzer",
    title: "Kodu yaz və təsdiqlə",
    body: "Açılan pəncərəyə 12 simvollu kodu daxil et. Əməliyyat tamamlandı.",
  },
];

/** Köhnə (v1) seed-in başlıqları — yalnız bunlar varsa dəyişdirmək təhlükəsizdir. */
const V1_TITLES = new Set([
  "PS konsolu üzərindən",
  "PlayStation tətbiqi üzərindən (iOS / Android)",
  "Brauzer üzərindən",
  "Profil ikonundan «Kodu istifadə et» seç",
  "Kodu yaz və təsdiqlə",
  "Əməliyyat tamamlandı",
]);

async function main() {
  const existing = await prisma.activationStep.findMany({
    where: { scope: SCOPE },
    select: { id: true, title: true, method: true },
  });

  if (existing.length > 0) {
    const untouchedV1 =
      existing.every((s) => !s.method) && existing.every((s) => V1_TITLES.has(s.title));
    if (!untouchedV1) {
      console.log(
        `${SCOPE}: ${existing.length} addım var və artıq redaktə olunub — toxunulmadı.`,
      );
      return;
    }
    await prisma.activationStep.deleteMany({ where: { scope: SCOPE } });
    console.log(`${SCOPE}: köhnə ${existing.length} üsulsuz addım silindi.`);
  }

  await prisma.activationStep.createMany({
    data: STEPS.map((s, i) => ({ ...s, scope: SCOPE, sortOrder: i, isActive: true })),
  });
  const methods = Array.from(new Set(STEPS.map((s) => s.method)));
  console.log(`${SCOPE}: ${STEPS.length} addım / ${methods.length} üsul yazıldı — ${methods.join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
