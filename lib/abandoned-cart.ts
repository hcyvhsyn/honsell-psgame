import { prisma } from "@/lib/prisma";
import { getTestAccountEmails } from "@/lib/testAccounts";
import { unsubscribeUrl } from "@/lib/marketing";

/**
 * Tərk edilmiş səbət (abandoned cart) xatırlatma məntiqinin mərkəzi.
 *
 * Strategiya:
 *  • Səbət client-də (localStorage) saxlanılır; login olmuş istifadəçi onu
 *    dəyişdikcə /api/cart/sync CartSnapshot upsert/silmə edir.
 *  • Dolu, ən az ABANDONED_MIN_AGE_HOURS saatdır toxunulmayan və hələ
 *    xatırladılmayan səbətlərə günlük cron bir dəfə e-poçt göndərir.
 *  • Alış / təmizləmə səbəti boşaldır → snapshot silinir → mail getmir.
 *  • Opt-in YOXDUR; hər e-poçtda unsubscribe linki var (marketingUnsubscribedAt).
 */

// Səbət bu qədər saatdır toxunulmayıbsa "tərk edilmiş" sayılır. Aktiv alış-veriş
// edən müştəriyə vaxtsız mail getməsin deyə.
export const ABANDONED_MIN_AGE_HOURS = 3;

// Bir xatırlatma e-poçtunda göstərilən maksimum məhsul sayı.
export const ABANDONED_MAX_ITEMS = 8;

export type AbandonedCartItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  qty: number;
  productType: string;
  store?: string;
};

export type AbandonedCartRecord = {
  snapshotId: string;
  userId: string;
  email: string;
  name: string | null;
  items: AbandonedCartItem[];
  totalAzn: number;
};

function hoursAgo(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function parseItems(raw: unknown): AbandonedCartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AbandonedCartItem[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const it = v as Record<string, unknown>;
    if (typeof it.id !== "string" || typeof it.title !== "string") continue;
    if (typeof it.finalAzn !== "number" || typeof it.qty !== "number") continue;
    out.push({
      id: it.id,
      title: it.title,
      imageUrl: typeof it.imageUrl === "string" ? it.imageUrl : null,
      finalAzn: it.finalAzn,
      qty: it.qty,
      productType: typeof it.productType === "string" ? it.productType : "",
      ...(typeof it.store === "string" ? { store: it.store } : {}),
    });
  }
  return out;
}

/**
 * Xatırlatma üçün uyğun tərk edilmiş səbətlər:
 *  • itemCount > 0, updatedAt ≤ now − ABANDONED_MIN_AGE_HOURS, reminderSentAt = null
 *  • istifadəçi: disabled = false, emailVerified = true, marketingUnsubscribedAt = null
 *  • test hesabları istisna
 */
export async function getAbandonedCarts(now: Date): Promise<AbandonedCartRecord[]> {
  const testEmails = getTestAccountEmails();

  const rows = await prisma.cartSnapshot.findMany({
    where: {
      itemCount: { gt: 0 },
      reminderSentAt: null,
      updatedAt: { lte: hoursAgo(now, ABANDONED_MIN_AGE_HOURS) },
      user: {
        disabled: false,
        emailVerified: true,
        marketingUnsubscribedAt: null,
        email: { notIn: testEmails },
      },
    },
    select: {
      id: true,
      userId: true,
      items: true,
      totalAznCents: true,
      user: { select: { email: true, name: true } },
    },
  });

  const records: AbandonedCartRecord[] = [];
  for (const r of rows) {
    const items = parseItems(r.items);
    if (items.length === 0) continue;
    records.push({
      snapshotId: r.id,
      userId: r.userId,
      email: r.user.email,
      name: r.user.name,
      items,
      totalAzn: r.totalAznCents / 100,
    });
  }
  return records;
}

// ── Orkestrasiya: tərk edilmiş səbət xatırlatmalarının göndərilməsi ──────────

export type AbandonedCartRunStats = {
  candidates: number;
  sent: number;
  failed: number;
  dryRun: boolean;
  errors: string[];
};

/**
 * Tərk edilmiş səbət xatırlatmalarını göndərir. Həm günlük cron, həm də
 * (gələcəkdə) admin "indi göndər" düyməsi bunu çağıra bilər.
 *
 *  • dryRun=true → e-poçt göndərmir, yalnız neçə namizəd olduğunu qaytarır.
 *  • Dedup: reminderSentAt — hər tərk edilmiş səbətə bir dəfə (səbət tərkibi
 *    dəyişdikdə /api/cart/sync onu sıfırlayır).
 */
export async function runAbandonedCartReminder(opts: {
  now: Date;
  dryRun?: boolean;
}): Promise<AbandonedCartRunStats> {
  const { now } = opts;
  const dryRun = opts.dryRun ?? false;

  const stats: AbandonedCartRunStats = {
    candidates: 0,
    sent: 0,
    failed: 0,
    dryRun,
    errors: [],
  };

  const carts = await getAbandonedCarts(now);
  stats.candidates = carts.length;

  if (dryRun || carts.length === 0) return stats;

  // resend yalnız real göndərişdə yüklənsin (RESEND_API_KEY tələb edir).
  const { sendAbandonedCartEmail } = await import("@/lib/resend");

  for (const c of carts) {
    try {
      await sendAbandonedCartEmail({
        email: c.email,
        userName: c.name?.split(" ")[0] ?? c.email.split("@")[0],
        unsubscribeUrl: unsubscribeUrl(c.userId),
        items: c.items.slice(0, ABANDONED_MAX_ITEMS),
        extraCount: Math.max(0, c.items.length - ABANDONED_MAX_ITEMS),
        totalAzn: c.totalAzn,
      });
      // Yalnız uğurlu göndərişdə işarələ — uğursuzluqda növbəti run yenidən cəhd edir.
      await prisma.cartSnapshot.update({
        where: { id: c.snapshotId },
        data: { reminderSentAt: now },
      });
      stats.sent += 1;
    } catch (e) {
      stats.failed += 1;
      stats.errors.push(`${c.email}: ${e instanceof Error ? e.message : "send error"}`);
    }
  }

  return stats;
}
