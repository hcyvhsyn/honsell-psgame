import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getTestAccountEmails } from "@/lib/testAccounts";
import { computeDisplayPrice, getSettings, type PricingSettings } from "@/lib/pricing";

/**
 * Endirim bülleteni (weekly discount digest) marketinq məntiqinin mərkəzi.
 *
 * Strategiya:
 *  • Həftəlik toplu "yeni endirimlər" e-poçtu → bütün AKTIV müştərilər.
 *  • Anlıq favorit-endirim bildirişləri scrape axınında ayrıca işləyir.
 *  • Opt-in YOXDUR; hər e-poçtda unsubscribe linki var (marketingUnsubscribedAt).
 */

// "Yeni endirim" pəncərəsi — bülleten son bu qədər gündə endirimə düşən
// oyunları göstərir (həftəlik cron üçün 7 gün məntiqlidir).
export const DIGEST_NEW_DISCOUNT_DAYS = 7;

// Aktiv müştəri tərifi: son bu qədər gündə login VƏ YA uğurlu tranzaksiya.
export const ACTIVE_LOGIN_DAYS = 60;
export const ACTIVE_TX_DAYS = 90;

// Bir bülletendə göstərilən maksimum endirim sayı.
export const DIGEST_MAX_GAMES = 12;

export type DigestGame = {
  id: string;
  productId: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  discountEndAt: Date | null;
};

export type DigestRecipient = {
  id: string;
  email: string;
  name: string | null;
};

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Cari həftənin başlanğıcı (UTC bazən, Bazar ertəsi 00:00). Dedup açarı kimi
 * istifadə olunur — eyni təqvim həftəsində istifadəçiyə yalnız bir bülleten.
 */
export function currentWeekStart(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: 0=Bazar … 1=Bazar ertəsi. Bazar ertəsinə qədər geri çək.
  const dow = d.getUTCDay();
  const backToMonday = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - backToMonday);
  return d;
}

/**
 * Son `withinDays` gündə endirimə düşən, hazırda aktiv endirimi olan oyunlar.
 * Endirim faizinə görə (ən böyük əvvəl) sıralanır, `limit` qədər qaytarılır.
 */
export async function getNewDiscountedGames(
  now: Date,
  opts?: { withinDays?: number; limit?: number; settings?: PricingSettings }
): Promise<DigestGame[]> {
  const withinDays = opts?.withinDays ?? DIGEST_NEW_DISCOUNT_DAYS;
  const limit = opts?.limit ?? DIGEST_MAX_GAMES;
  const settings = opts?.settings ?? (await getSettings());

  const rows = await prisma.game.findMany({
    where: {
      isActive: true,
      discountTryCents: { not: null },
      discountStartedAt: { gte: daysAgo(now, withinDays) },
      OR: [{ discountEndAt: null }, { discountEndAt: { gt: now } }],
    },
    select: {
      id: true,
      productId: true,
      title: true,
      imageUrl: true,
      store: true,
      priceTryCents: true,
      discountTryCents: true,
      discountEndAt: true,
      priceUsdCents: true,
      discountUsdCents: true,
      discountStartedAt: true,
    },
    // Ən yeni endirimlər əvvəl; faiz sıralaması aşağıda kodda dəqiqləşir.
    orderBy: { discountStartedAt: "desc" },
    take: limit * 4, // faiz hesablandıqdan sonra kəsmək üçün bir az artıq götür
  });

  const mapped: DigestGame[] = rows.map((g) => {
    const display = computeDisplayPrice(g, settings);
    return {
      id: g.id,
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      finalAzn: display.finalAzn,
      originalAzn: display.originalAzn,
      discountPct: display.discountPct,
      discountEndAt: g.discountEndAt,
    };
  });

  // Yalnız real endirimi olanlar (faiz > 0), ən böyük faizdən başlayaraq.
  return mapped
    .filter((g) => g.discountPct != null && g.discountPct > 0)
    .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0))
    .slice(0, limit);
}

/**
 * Bülleten alıcısı olan aktiv müştərilər:
 *  • disabled = false, emailVerified = true
 *  • marketingUnsubscribedAt = null (opt-out etməyiblər)
 *  • son ACTIVE_LOGIN_DAYS gündə login VƏ YA son ACTIVE_TX_DAYS gündə uğurlu tx
 *  • test hesabları istisna
 */
export async function getActiveMarketingRecipients(now: Date): Promise<DigestRecipient[]> {
  const testEmails = getTestAccountEmails();

  const recentTx = await prisma.transaction.findMany({
    where: {
      status: "SUCCESS",
      createdAt: { gte: daysAgo(now, ACTIVE_TX_DAYS) },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const activeTxUserIds = recentTx.map((t) => t.userId).filter(Boolean) as string[];

  const users = await prisma.user.findMany({
    where: {
      disabled: false,
      emailVerified: true,
      marketingUnsubscribedAt: null,
      email: { notIn: testEmails },
      OR: [
        { lastLoginAt: { gte: daysAgo(now, ACTIVE_LOGIN_DAYS) } },
        { id: { in: activeTxUserIds } },
      ],
    },
    select: { id: true, email: true, name: true },
  });

  return users;
}

// ── Unsubscribe token (imzalı, stateless) ──────────────────────────────────
// HMAC(userId) — CRON_SECRET açarı ilə. DB-yə əlavə token saxlamağa ehtiyac yox.

function unsubscribeSecret(): string {
  // CRON_SECRET onsuz da serverdə mövcuddur; ayrıca açar tələb etmirik.
  return process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET || "honsell-marketing";
}

export function makeUnsubscribeToken(userId: string): string {
  return crypto
    .createHmac("sha256", unsubscribeSecret())
    .update(`unsub:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = makeUnsubscribeToken(userId);
  // Bərabər uzunluqlu, sabit-vaxtlı müqayisə.
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function unsubscribeUrl(userId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://honsell.store").replace(/\/+$/, "");
  const token = makeUnsubscribeToken(userId);
  return `${base}/api/marketing/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

// ── Orkestrasiya: həftəlik bülletenin göndərilməsi ──────────────────────────

export type DigestRunStats = {
  weekStart: string;
  newGames: number;
  recipients: number;
  sent: number;
  skippedDedup: number;
  failed: number;
  dryRun: boolean;
  errors: string[];
};

/**
 * Həftəlik endirim bülletenini hesablayır və göndərir. Həm cron, həm də admin
 * "indi göndər" düyməsi bunu çağırır.
 *
 *  • dryRun=true → heç bir e-poçt göndərmir, yalnız neçə alıcı/oyun olduğunu
 *    qaytarır (admin panel önizləməsi üçün).
 *  • Dedup: (userId, weekStart) — eyni həftədə təkrar göndərmir.
 */
export async function runWeeklyDiscountDigest(opts: {
  now: Date;
  dryRun?: boolean;
}): Promise<DigestRunStats> {
  const { now } = opts;
  const dryRun = opts.dryRun ?? false;
  const weekStart = currentWeekStart(now);

  const stats: DigestRunStats = {
    weekStart: weekStart.toISOString(),
    newGames: 0,
    recipients: 0,
    sent: 0,
    skippedDedup: 0,
    failed: 0,
    dryRun,
    errors: [],
  };

  const settings = await getSettings();
  const games = await getNewDiscountedGames(now, { settings });
  stats.newGames = games.length;

  // Yeni endirim yoxdursa, boş bülleten göndərmirik.
  if (games.length === 0) return stats;

  const recipients = await getActiveMarketingRecipients(now);
  stats.recipients = recipients.length;

  if (dryRun) return stats;

  // resend yalnız real göndərişdə yüklənsin (RESEND_API_KEY tələb edir).
  const { sendDiscountDigestEmail } = await import("@/lib/resend");

  for (const r of recipients) {
    try {
      // Dedup sətri — unique (userId, weekStart) pozulsa, artıq göndərilib.
      await prisma.discountDigestNotification.create({
        data: { userId: r.id, weekStart, gameCount: games.length },
      });
    } catch {
      stats.skippedDedup += 1;
      continue;
    }

    try {
      await sendDiscountDigestEmail({
        email: r.email,
        userName: r.name?.split(" ")[0] ?? r.email.split("@")[0],
        unsubscribeUrl: unsubscribeUrl(r.id),
        games,
      });
      await prisma.user.update({
        where: { id: r.id },
        data: { lastDigestSentAt: now },
      });
      stats.sent += 1;
    } catch (e) {
      stats.failed += 1;
      stats.errors.push(`${r.email}: ${e instanceof Error ? e.message : "send error"}`);
    }
  }

  return stats;
}
