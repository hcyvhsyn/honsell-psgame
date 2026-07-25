import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getTestAccountEmails } from "@/lib/testAccounts";
import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";
import { createRandomWinnerRows, logGiveawayAudit } from "@/lib/giveawayWinners";

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
  SOCIAL_PLATFORMS,
  socialPlatformLabel,
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

/** Qalib rəyi linkinin ictimai URL-i (token qalibin WhatsApp-ına gedir). */
export function winnerReviewUrl(token: string): string {
  return `${storeBaseUrl()}/cekilis-rey/${token}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * İstifadəçinin çəkilişə qoşulmaq üçün şərti ödəyib-ödəmədiyini yoxlayır.
 * REGISTER_ONLY → hər qeydiyyatlı istifadəçi.
 * PURCHASE_ANY  → ən azı bir uğurlu PURCHASE/SERVICE_PURCHASE tranzaksiyası.
 * PURCHASE_PRODUCT → conditionType (ServiceProduct.type) üzrə uğurlu alış.
 * FOLLOW_SOCIAL → sosial izləməni server yoxlaya bilmir; UI izlə linkinə
 *   klikləməyi tələb edir, server tərəfdə hər login istifadəçi eligible sayılır.
 */
export async function checkGiveawayEligibility(
  userId: string,
  giveaway: { entryCondition: string; conditionType: string | null }
): Promise<{ eligible: boolean; reason?: string }> {
  if (giveaway.entryCondition === "REGISTER_ONLY" || giveaway.entryCondition === "FOLLOW_SOCIAL") {
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
  giveawayId: string,
  actorId: string | null = null
): Promise<{ ok: true; winners: { userId: string; name: string | null }[] } | { ok: false; error: string }> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway) return { ok: false, error: "Çəkiliş tapılmadı." };

  const testEmails = getTestAccountEmails();
  const entries = await prisma.giveawayEntry.findMany({
    where: { giveawayId, user: { email: { notIn: testEmails } } },
    select: {
      id: true,
      userId: true,
      user: { select: { name: true, phone: true, email: true, avatarUrl: true } },
    },
  });

  if (entries.length === 0) return { ok: false, error: "Qoşulan iştirakçı yoxdur." };

  // Admin əl ilə əlavə etdiyi XARİCİ qaliblər (entryId = null) qorunur; random
  // çəkiliş yalnız qalan yerləri doldurur ki, ümumi say winnersCount-u keçməsin.
  const externalCount = await prisma.giveawayWinner.count({
    where: { giveawayId, entryId: null },
  });
  const slots = Math.max(0, giveaway.winnersCount - externalCount);

  // Fisher–Yates qarışdırması ilə random qaliblər.
  const pool = [...entries];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const winnersCount = Math.min(slots, pool.length);
  const winners = pool.slice(0, winnersCount);
  const winnerEntryIds = new Set(winners.map((w) => w.id));

  await prisma.$transaction(async (tx) => {
    // Əvvəlki entry-əsaslı qalibləri (RANDOM/MANUAL) sıfırla — xariciləri saxla.
    await tx.giveawayWinner.deleteMany({ where: { giveawayId, entryId: { not: null } } });
    await tx.giveawayEntry.updateMany({
      where: { giveawayId, isWinner: true, id: { notIn: [...winnerEntryIds] } },
      data: { isWinner: false, notifiedAt: null, waStatus: "N_A" },
    });
    await tx.giveawayEntry.updateMany({
      where: { id: { in: [...winnerEntryIds] } },
      data: { isWinner: true },
    });
    await createRandomWinnerRows(tx, giveawayId, winners, giveaway.prizeLabel, actorId);
    await tx.giveaway.update({
      where: { id: giveawayId },
      data: { status: "COMPLETED", drawnAt: new Date() },
    });
  });

  await logGiveawayAudit({
    actorId,
    giveawayId,
    entityType: "winner",
    entityId: giveawayId,
    action: "winner.draw.random",
    next: { drawn: winners.length, externalPreserved: externalCount },
  });

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

function winnerReviewWhatsappText(
  userName: string | null,
  prizeLabel: string,
  title: string,
  url: string
): string {
  return [
    `Salam ${userName || ""}`.trim() + ",",
    ``,
    `"${title}" çəkilişində qazandığın *${prizeLabel}* mükafatını aldın 🎁`,
    ``,
    `Bir xahişimiz var: təcrübəni qısa rəy kimi bizimlə bölüşərsənmi? Digər`,
    `iştirakçılar hədiyyələri həqiqətən verdiyimizə əmin olsun deyə rəyin`,
    `çəkilişin altında göstəriləcək. İstəsən mükafatın fotosunu da əlavə edə bilərsən.`,
    ``,
    `👉 ${url}`,
    ``,
    `— Honsell Store`,
  ].join("\n");
}

/**
 * Qaliblərə rəy linki göndərir (hədiyyə çatdırıldıqdan sonra admin işə salır).
 * Hər qalib üçün (reviewStatus NONE) unikal token yaradıb WhatsApp-a link atır və
 * reviewStatus=SENT edir. Rəyini artıq yazmış (SUBMITTED) qaliblər keçilir →
 * idempotent; təkrar çağırılsa yalnız hələ göndərilməmişlərə göndərilir.
 */
export async function sendWinnerReviewLinks(
  giveawayId: string
): Promise<{ ok: true; sent: number; failed: number; skipped: number } | { ok: false; error: string }> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway) return { ok: false, error: "Çəkiliş tapılmadı." };
  if (!isWasenderConfigured()) return { ok: false, error: "WhatsApp (WaSender) konfiqurasiya olunmayıb." };

  // Rəyi hələ yazmayan qaliblər (NONE və ya təkrar link üçün SENT).
  const winners = await prisma.giveawayEntry.findMany({
    where: { giveawayId, isWinner: true, reviewStatus: { in: ["NONE", "SENT"] } },
    select: { id: true, reviewToken: true, user: { select: { name: true, phone: true } } },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const w of winners) {
    const phone = normalizeToE164(w.user.phone);
    if (!phone) {
      skipped++;
      continue;
    }
    // Mövcud token varsa təkrar istifadə et (təkrar göndəriş eyni linki saxlasın).
    const token = w.reviewToken || crypto.randomBytes(24).toString("base64url");
    const res = await sendWasenderText({
      to: phone,
      text: winnerReviewWhatsappText(
        w.user.name,
        giveaway.prizeLabel,
        giveaway.title,
        winnerReviewUrl(token)
      ),
    });
    if (res.ok) {
      sent++;
      await prisma.giveawayEntry.update({
        where: { id: w.id },
        data: { reviewToken: token, reviewStatus: "SENT", reviewSentAt: new Date() },
      });
    } else {
      failed++;
      console.error("giveaway winner review link send failed", { entryId: w.id, error: res.error });
    }
    await sleep(WA_SEND_DELAY_MS);
  }

  return { ok: true, sent, failed, skipped };
}
