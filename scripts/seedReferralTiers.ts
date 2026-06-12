/**
 * Referal seqment (CustomerTier) + faiz matrisi (ReferralRate) seed/backfill.
 *
 * Köhnə "Sponsorlu" mexanizmini yeni seqment sisteminə miqrasiya edir və
 * mövcud faizləri backfill edir ki, gün-bir davranış EYNİ qalsın.
 *
 * İdempotent: təkrar çağırışda mövcud sətirlər DƏYİŞDİRİLMİR (yalnız çatışmayan
 * sətirlər yaradılır) — yəni admin redaktə etdikdən sonra seed-i təkrar çalışdırsan
 * faizlər sıfırlanmır.
 *
 * İşə salmaq:
 *   npx tsx scripts/seedReferralTiers.ts
 *
 * .env avtomatik yüklənir (dotenv/config). DATABASE_URL qurulmalıdır.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/pricing";
import { readReferralRateFromMeta } from "@/lib/referralCalculatorOptions";

async function ensureTier(opts: {
  slug: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
}) {
  return prisma.customerTier.upsert({
    where: { slug: opts.slug },
    create: {
      slug: opts.slug,
      name: opts.name,
      isDefault: opts.isDefault,
      sortOrder: opts.sortOrder,
    },
    update: {}, // create-only — mövcud seqmenti dəyişmə
  });
}

async function ensureRate(opts: {
  tierId: string;
  targetType: string;
  serviceProductId?: string;
  ratePct: number;
  enabled: boolean;
}) {
  const serviceProductId = opts.serviceProductId ?? "";
  await prisma.referralRate.upsert({
    where: {
      tierId_targetType_serviceProductId: {
        tierId: opts.tierId,
        targetType: opts.targetType,
        serviceProductId,
      },
    },
    create: {
      tierId: opts.tierId,
      targetType: opts.targetType,
      serviceProductId,
      ratePct: opts.ratePct,
      enabled: opts.enabled,
    },
    update: {}, // create-only — admin-redaktə edilmiş faizi qoruma
  });
}

async function main() {
  const settings = await getSettings();

  // 1) Seqmentlər.
  const adi = await ensureTier({ slug: "adi", name: "Adi", isDefault: true, sortOrder: 0 });
  const sponsorlu = await ensureTier({
    slug: "sponsorlu",
    name: "Sponsorlu",
    isDefault: false,
    sortOrder: 1,
  });

  // Dəqiq-bir-default invariantını təmin et (heç bir default yoxdursa "adi"-ni qoy).
  const defaultCount = await prisma.customerTier.count({ where: { isDefault: true } });
  if (defaultCount === 0) {
    await prisma.customerTier.update({ where: { id: adi.id }, data: { isDefault: true } });
    console.log("• default seqment yoxdu → 'adi' default təyin edildi");
  }

  // 2) Köhnə sponsorlu istifadəçiləri "sponsorlu" seqmentinə köçür (tierId boş olanlar).
  const migrated = await prisma.user.updateMany({
    where: { isSponsored: true, tierId: null },
    data: { tierId: sponsorlu.id },
  });
  console.log(`• ${migrated.count} sponsorlu istifadəçi 'sponsorlu' seqmentinə köçürüldü`);

  // 3) PS Store kateqoriya faizləri (hər iki seqment).
  //    Adi → köhnə qlobal faizlər. Sponsorlu → yalnız PS_GAMES fərqlənir (8%).
  const categoryRates: Array<{
    targetType: string;
    adiPct: number;
    sponsorluPct: number;
  }> = [
    {
      targetType: "PS_GAMES",
      adiPct: settings.referralGamesPct,
      sponsorluPct: settings.sponsoredReferralGamesPct,
    },
    {
      targetType: "PS_PLUS",
      adiPct: settings.referralPsPlusPct,
      sponsorluPct: settings.referralPsPlusPct,
    },
    {
      targetType: "GIFT_CARDS",
      adiPct: settings.referralGiftCardsPct,
      sponsorluPct: settings.referralGiftCardsPct,
    },
    {
      targetType: "ACCOUNT_CREATION",
      adiPct: settings.referralAccountCreationPct,
      sponsorluPct: settings.referralAccountCreationPct,
    },
  ];

  for (const c of categoryRates) {
    await ensureRate({ tierId: adi.id, targetType: c.targetType, ratePct: c.adiPct, enabled: true });
    await ensureRate({
      tierId: sponsorlu.id,
      targetType: c.targetType,
      ratePct: c.sponsorluPct,
      enabled: true,
    });
  }
  console.log("• PS Store kateqoriya faizləri backfill edildi");

  // 4) SERVICE_PRODUCT faizləri — hər STREAMING/PLATFORM məhsulu (hər müddət ayrıca).
  //    Mövcud metadata.referralPct hər iki seqmentə eyni dəyərlə yazılır.
  const products = await prisma.serviceProduct.findMany({
    where: { type: { in: ["STREAMING", "PLATFORM"] } },
    select: { id: true, metadata: true },
  });
  for (const p of products) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>;
    const enabled = meta.referralEnabled !== false;
    const ratePct = readReferralRateFromMeta(p.metadata, 0);
    for (const tierId of [adi.id, sponsorlu.id]) {
      await ensureRate({
        tierId,
        targetType: "SERVICE_PRODUCT",
        serviceProductId: p.id,
        ratePct,
        enabled,
      });
    }
  }
  console.log(`• ${products.length} streaming/platform məhsulu üçün faizlər backfill edildi`);

  console.log("✅ Referal seqment seed tamamlandı.");
}

main()
  .catch((err) => {
    console.error("❌ Seed xətası:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
