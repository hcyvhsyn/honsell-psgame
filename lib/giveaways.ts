import { prisma } from "@/lib/prisma";
import { getTestAccountEmails } from "@/lib/testAccounts";
import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";

/**
 * Çəkiliş (Giveaway) — ana səhifə hədiyyə çəkilişləri (SERVER logikası).
 *
 * Axın: admin çəkiliş yaradır (DRAFT) → aktivləşdirir (ACTIVE) → istifadəçilər
 * şərti ödəyib qoşulur → bitiş tarixindən sonra admin random qalibləri çəkir
 * (COMPLETED) → qaliblərin WhatsApp-ına bildiriş gedir → qaliblər ana səhifədə
 * ictimai göstərilir (etibar / sosial sübut).
 *
 * Client-safe sabitlər/köməkçilər `@/lib/giveawaysShared`-dədir (bu modul prisma
 * import etdiyi üçün client bundle-a çəkilə bilməz).
 */

// Rahatlıq üçün shared sabitləri buradan da re-export edirik (server importları).
export {
  ENTRY_CONDITIONS,
  ENTRY_CONDITION_LABELS,
  GIVEAWAY_STATUSES,
  displayParticipantCount,
  maskWinnerName,
  giveawayShareUrl,
  buildGiveawayShareText,
} from "@/lib/giveawaysShared";
export type { EntryCondition, GiveawayStatus } from "@/lib/giveawaysShared";

/** WhatsApp provayder limitlərinə hörmət üçün göndərişlər arası gecikmə (ms). */
const WA_SEND_DELAY_MS = 400;

function storeBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://honsell.store").replace(/\/+$/, "");
}

/** Çəkilişin ictimai linki (ana səhifə bölməsi). */
export function giveawayUrl(): string {
  return `${storeBaseUrl()}/#cekilisler`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * İstifadəçinin çəkilişə qoşulmaq üçün şərti ödəyib-ödəmədiyini yoxlayır.
 * REGISTER_ONLY → hər qeydiyyatlı istifadəçi.
 * PURCHASE_ANY  → ən azı bir uğurlu PURCHASE/SERVICE_PURCHASE tranzaksiyası.
 * PURCHASE_PRODUCT → conditionType (ServiceProduct.type) üzrə uğurlu alış.
 */
export async function checkGiveawayEligibility(
  userId: string,
  giveaway: { entryCondition: string; conditionType: string | null }
): Promise<{ eligible: boolean; reason?: string }> {
  if (giveaway.entryCondition === "REGISTER_ONLY") {
    return { eligible: true };
  }

  if (giveaway.entryCondition === "PURCHASE_ANY") {
    const count = await prisma.transaction.count({
      where: {
        userId,
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
      },
    });
    return count > 0
      ? { eligible: true }
      : { eligible: false, reason: "Qoşulmaq üçün ən azı bir alışın olmalıdır." };
  }

  if (giveaway.entryCondition === "PURCHASE_PRODUCT") {
    if (!giveaway.conditionType) return { eligible: false, reason: "Şərt məhsulu təyin olunmayıb." };
    const count = await prisma.transaction.count({
      where: {
        userId,
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
        serviceProduct: { type: giveaway.conditionType },
      },
    });
    return count > 0
      ? { eligible: true }
      : { eligible: false, reason: "Qoşulmaq üçün müvafiq məhsulu almalısan." };
  }

  return { eligible: false, reason: "Naməlum qoşulma şərti." };
}

/**
 * Random qalibləri çəkir. Yalnız ACTIVE (və ya endAt keçmiş) çəkilişlərdə işləyir.
 * Test hesabları qalib ola bilməz. İdempotent deyil — yenidən çağırılsa əvvəlki
 * qaliblər sıfırlanıb yenidən çəkilir (admin "yenidən çək" istəyə bilər).
 */
export async function drawGiveawayWinners(
  giveawayId: string
): Promise<{ ok: true; winners: { userId: string; name: string | null }[] } | { ok: false; error: string }> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway) return { ok: false, error: "Çəkiliş tapılmadı." };

  const testEmails = getTestAccountEmails();
  const entries = await prisma.giveawayEntry.findMany({
    where: { giveawayId, user: { email: { notIn: testEmails } } },
    select: { id: true, userId: true, user: { select: { name: true } } },
  });

  if (entries.length === 0) return { ok: false, error: "Qoşulan iştirakçı yoxdur." };

  // Fisher–Yates qarışdırması ilə random qaliblər.
  const pool = [...entries];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const winnersCount = Math.max(1, Math.min(giveaway.winnersCount, pool.length));
  const winners = pool.slice(0, winnersCount);
  const winnerEntryIds = new Set(winners.map((w) => w.id));

  await prisma.$transaction([
    // Əvvəlki qalibləri sıfırla (yenidən çəkmə halı üçün).
    prisma.giveawayEntry.updateMany({
      where: { giveawayId, isWinner: true, id: { notIn: [...winnerEntryIds] } },
      data: { isWinner: false, notifiedAt: null, waStatus: "N_A" },
    }),
    prisma.giveawayEntry.updateMany({
      where: { id: { in: [...winnerEntryIds] } },
      data: { isWinner: true },
    }),
    prisma.giveaway.update({
      where: { id: giveawayId },
      data: { status: "COMPLETED", drawnAt: new Date() },
    }),
  ]);

  return {
    ok: true,
    winners: winners.map((w) => ({ userId: w.userId, name: w.user.name })),
  };
}

function winnerWhatsappText(userName: string | null, prizeLabel: string, title: string): string {
  return [
    `Salam ${userName || ""}`.trim() + ",",
    ``,
    `🎉 Təbriklər! "${title}" çəkilişində *QAZANDIN*!`,
    ``,
    `Mükafatın: *${prizeLabel}*`,
    ``,
    `Mükafatını almaq üçün tezliklə səninlə əlaqə saxlanılacaq.`,
    `— Honsell Store`,
  ].join("\n");
}

/**
 * Çəkiliş qaliblərinə WhatsApp bildirişi göndərir (yalnız qaliblərə).
 * Artıq bildiriş göndərilmiş qaliblər (notifiedAt dolu) keçilir → idempotent.
 */
export async function notifyGiveawayWinners(
  giveawayId: string
): Promise<{ ok: true; sent: number; failed: number; skipped: number } | { ok: false; error: string }> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway) return { ok: false, error: "Çəkiliş tapılmadı." };
  if (!isWasenderConfigured()) return { ok: false, error: "WhatsApp (WaSender) konfiqurasiya olunmayıb." };

  const winners = await prisma.giveawayEntry.findMany({
    where: { giveawayId, isWinner: true, notifiedAt: null },
    select: { id: true, user: { select: { name: true, phone: true } } },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const w of winners) {
    const phone = normalizeToE164(w.user.phone);
    if (!phone) {
      skipped++;
      await prisma.giveawayEntry.update({
        where: { id: w.id },
        data: { waStatus: "FAILED", notifiedAt: new Date() },
      });
      continue;
    }
    const res = await sendWasenderText({
      to: phone,
      text: winnerWhatsappText(w.user.name, giveaway.prizeLabel, giveaway.title),
    });
    if (res.ok) {
      sent++;
      await prisma.giveawayEntry.update({
        where: { id: w.id },
        data: { waStatus: "SENT", notifiedAt: new Date() },
      });
    } else {
      failed++;
      console.error("giveaway winner whatsapp send failed", { entryId: w.id, error: res.error });
      await prisma.giveawayEntry.update({
        where: { id: w.id },
        data: { waStatus: "FAILED", notifiedAt: new Date() },
      });
    }
    await sleep(WA_SEND_DELAY_MS);
  }

  return { ok: true, sent, failed, skipped };
}
