/**
 * Netflix üçün LOKAL test datası: 5 `StreamingPlatform` + 27 `[MOCK]` `ServiceProduct`.
 *
 * Qiymətlər uydurmadır, yalnız vitrin və sifariş axınını sınamaq üçündür. Real qiymət prod-da
 * `/admin/streaming`-dən yazılır. Skript İDEMPOTENTDİR: məhsulu başlığına görə tapıb yeniləyir.
 *
 *   npm run seed:netflix-mock
 *
 * ⚠️ Yalnız `.env.local`-ı oxuyur və baza hostu localhost deyilsə dayanır — `.env` prod-a baxır.
 */
import { config } from "dotenv";

config({ path: ".env.local", override: true, quiet: true });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

type Pack = {
  service: string;
  label: string;
  deliveryMode: "CODE" | "GMAIL";
  variantSlug?: string;
  devices: string[];
  /** Hesab planları yalnız 1 aylıqdır; otaq paketlərində 1/3/6/12 ay var. */
  prices: Partial<Record<1 | 3 | 6 | 12, number>>;
};

const ALL_DEVICES = ["tv", "computer", "tablet", "phone"];

const PACKS: Pack[] = [
  { service: "NETFLIX_VVIP", label: "Hesab Basic", deliveryMode: "GMAIL", variantSlug: "basic", devices: ALL_DEVICES, prices: { 1: 20 } },
  { service: "NETFLIX_VVIP", label: "Hesab Standart", deliveryMode: "GMAIL", variantSlug: "standart", devices: ALL_DEVICES, prices: { 1: 28 } },
  { service: "NETFLIX_VVIP", label: "Hesab Premium", deliveryMode: "GMAIL", variantSlug: "premium", devices: ALL_DEVICES, prices: { 1: 36 } },
  { service: "NETFLIX_YANIMDA", label: "Yanımda", deliveryMode: "CODE", devices: ["computer", "tablet", "phone"], prices: { 1: 8, 3: 22, 6: 40, 12: 72 } },
  { service: "NETFLIX_EVIMD", label: "Evimdə", deliveryMode: "CODE", devices: ALL_DEVICES, prices: { 1: 11, 3: 30, 6: 56, 12: 100 } },
  { service: "NETFLIX_EVIMD_VIP", label: "Evimdə VIP", deliveryMode: "CODE", devices: ALL_DEVICES, prices: { 1: 15, 3: 42, 6: 78, 12: 140 } },
];

// Qrup sahələri (lib/streamingAccess.ts) — admin Netflix-i "Şəxsi / Paylaşımlı hesab" kimi göstərir.
const PLATFORMS = [
  { code: "NETFLIX", slug: "netflix", label: "Netflix", tagline: "Öz hesabına plan və ya sənə aid otaq", sortOrder: 10, parentCode: null, accessMode: null, tierName: "" },
  { code: "NETFLIX_VVIP", slug: "netflix-vvip", label: "Netflix Hesab", tagline: "Öz Netflix hesabına Basic / Standart / Premium plan", sortOrder: 11, parentCode: "NETFLIX", accessMode: "PERSONAL", tierName: "Hesab" },
  { code: "NETFLIX_YANIMDA", slug: "netflix-yanimda", label: "Netflix Yanımda", tagline: "Telefon, planşet və kompüter üçün sənə aid otaq", sortOrder: 12, parentCode: "NETFLIX", accessMode: "SHARED", tierName: "Yanımda" },
  { code: "NETFLIX_EVIMD", slug: "netflix-evimde", label: "Netflix Evimdə", tagline: "TV daxil bütün cihazlar üçün sənə aid otaq", sortOrder: 13, parentCode: "NETFLIX", accessMode: "SHARED", tierName: "Evimdə" },
  { code: "NETFLIX_EVIMD_VIP", slug: "netflix-evimde-vip", label: "Netflix Evimdə VIP", tagline: "Ən stabil seçim, TV daxil sənə aid otaq", sortOrder: 14, parentCode: "NETFLIX", accessMode: "SHARED", tierName: "Evimdə VIP" },
];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* aşağıda dayanır */
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Mock seed yalnız lokal bazada işləyir (host: "${host || "yoxdur"}").`);
  }

  // Prisma env yükləndikdən SONRA import olunmalıdır.
  const { prisma } = await import("@/lib/prisma");

  for (const p of PLATFORMS) {
    const data = {
      slug: p.slug, label: p.label, category: "STREAMING", tagline: p.tagline, description: p.tagline, sortOrder: p.sortOrder, isActive: true,
      parentCode: p.parentCode, accessMode: p.accessMode, tierName: p.tierName, storeSellable: p.code === "NETFLIX",
    };
    await prisma.streamingPlatform.upsert({ where: { code: p.code }, create: { code: p.code, ...data }, update: data });
  }

  let created = 0;
  let updated = 0;
  for (const pack of PACKS) {
    // Otaq paketləri 1 və 2 nəfərlikdir (2 nəfər ≈ 1.8 misli); hesab planı nəfərə bölünmür.
    for (const seats of pack.deliveryMode === "CODE" ? [1, 2] : [1]) {
      for (const months of [1, 3, 6, 12] as const) {
        const price = pack.prices[months];
        if (price == null) continue;
        const title = `[MOCK] Netflix ${pack.label}${seats > 1 ? ` ${seats} nəfər` : ""} ${months} ay`;
        const data = {
          type: "STREAMING",
          title,
          imageUrl: "/netflix-honsell.png",
          priceAznCents: Math.round(price * (seats > 1 ? 1.8 : 1)) * 100,
          isActive: true,
          sortOrder: months + (seats - 1) * 100,
          metadata: {
            service: pack.service,
            durationMonths: months,
            seats,
            deliveryMode: pack.deliveryMode,
            accessMode: pack.deliveryMode === "GMAIL" ? "PERSONAL" : "SHARED",
            groupCode: "NETFLIX",
            devices: pack.devices,
            vpnRequired: false,
            ...(pack.variantSlug ? { variantSlug: pack.variantSlug } : {}),
          },
        };
        const existing = await prisma.serviceProduct.findFirst({ where: { type: "STREAMING", title }, select: { id: true } });
        if (existing) {
          await prisma.serviceProduct.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await prisma.serviceProduct.create({ data });
          created += 1;
        }
      }
    }
  }

  // Əvvəlki seed-dən qalan çoxaylıq hesab paketləri satışdan çıxır (sifarişləri ola bilər, silinmir).
  const retired = await prisma.serviceProduct.updateMany({
    where: {
      type: "STREAMING",
      OR: ["3", "6", "12"].flatMap((m) =>
        ["Basic", "Standart", "Premium"].map((plan) => ({ title: `[MOCK] Netflix Hesab ${plan} ${m} ay` })),
      ),
    },
    data: { isActive: false },
  });
  if (retired.count > 0) console.log(`${retired.count} köhnə çoxaylıq hesab paketi söndürüldü.`);

  console.log(`Netflix mock: ${PLATFORMS.length} platforma, ${created} yeni, ${updated} yenilənmiş məhsul (host: ${host}).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
