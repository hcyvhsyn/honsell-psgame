import { prisma } from "@/lib/prisma";
import { getTestAccountEmails } from "@/lib/testAccounts";
import { computeDisplayPrice, getSettings, type PricingSettings } from "@/lib/pricing";
import { unsubscribeUrl } from "@/lib/marketing";
import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";

/**
 * Reklam / Kampaniya — admin əl ilə seçdiyi auditoriyaya, seçdiyi endirimli
 * oyunların qiymətləri ilə toplu mesaj (WhatsApp + Email).
 *
 * Avtomatik həftəlik bülletendən (lib/marketing.ts) fərqli olaraq, burada
 * auditoriya, oyunlar və kanal tamamilə adminin nəzarətindədir.
 */

/** v1: serverless timeout riskini azaltmaq üçün kampaniya başına alıcı limiti. */
export const CAMPAIGN_MAX_RECIPIENTS = 500;

/** WhatsApp provayder limitlərinə hörmət üçün göndərişlər arası gecikmə (ms). */
const WA_SEND_DELAY_MS = 400;

/** Bir kampaniyada göstərilə biləcək maksimum oyun sayı. */
export const CAMPAIGN_MAX_GAMES = 20;

export type CampaignGame = {
  productId: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
};

export type CampaignAudienceFilters = {
  /** Yalnız emaili təsdiqlənmiş istifadəçilər. */
  emailVerified?: boolean;
  /** Yalnız telefon nömrəsi olanlar. */
  hasPhone?: boolean;
  /** Yalnız ən azı bir uğurlu sifarişi olanlar. */
  hasOrders?: boolean;
  /** Məhsul alıb, amma hələ rəy yazmamış müştərilər (rəy yazmağa dəvət üçün). */
  purchasedNotReviewed?: boolean;
  /** Müştəri seqmenti; "none" → seqmentsiz (tierId = null). */
  tierId?: string | null;
  /** Qeydiyyat tarixi aralığı (ISO date strings). */
  createdFrom?: string | null;
  createdTo?: string | null;
};

export type CampaignRecipientUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  emailVerified: boolean;
  marketingUnsubscribedAt: Date | null;
};

function storeBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://honsell.store").replace(/\/+$/, "");
}

export function gameUrl(productId: string): string {
  return `${storeBaseUrl()}/oyunlar/${productId}`;
}

/** Rəy dəvəti CTA hədəfi — anasayfanın rəylər bölməsi ("Rəy yaz" düyməsi orada). */
export function reviewInviteUrl(): string {
  return `${storeBaseUrl()}/#reyler`;
}

/** Rəy dəvəti WhatsApp mətni — giriş mətni + "Rəy yaz" linki. */
export function buildCampaignReviewWhatsappText(messageText: string): string {
  const lines: string[] = [];
  const intro = messageText.trim();
  if (intro) lines.push(intro, "");
  lines.push("⭐ Rəyini bura yaz:");
  lines.push(`   ${reviewInviteUrl()}`);
  lines.push("");
  lines.push("— Honsell PS Store");
  return lines.join("\n");
}

/**
 * Klik izləmə linki — mesajdakı oyun linkləri bunun üzərindən keçir. Endpoint
 * klikı qeyd edir və oyun səhifəsinə yönləndirir.
 */
export function campaignClickUrl(
  campaignId: string,
  recipientId: string,
  productId: string
): string {
  const u = new URLSearchParams({ c: campaignId, r: recipientId, p: productId });
  return `${storeBaseUrl()}/api/campaigns/click?${u.toString()}`;
}

/**
 * `finalAzn`/`originalAzn` computeDisplayPrice-dən AZN onluq vahidində gəlir
 * (cents DEYİL) — ona görə birbaşa formatlanır, 100-ə bölünmür.
 */
function fmtAzn(aznValue: number): string {
  return `${aznValue.toFixed(2)} AZN`;
}

// ── Endirimli oyunlar (axtarışlı, bütün aktiv endirimlər) ───────────────────

/**
 * Hazırda aktiv endirimi olan oyunlar — kampaniya qurarkən seçmək üçün.
 * `getNewDiscountedGames`-dən fərqi: `discountStartedAt` pəncərəsi yoxdur,
 * başlıq üzrə axtarış var. Endirim faizinə görə azalan sıra.
 */
export async function getActiveDiscountedGames(opts?: {
  q?: string;
  limit?: number;
  settings?: PricingSettings;
}): Promise<CampaignGame[]> {
  const limit = opts?.limit ?? 300;
  const settings = opts?.settings ?? (await getSettings());
  const q = opts?.q?.trim();

  const rows = await prisma.game.findMany({
    where: {
      isActive: true,
      store: "PS", // yalnız PlayStation oyunları (Epic istisna)
      discountTryCents: { not: null },
      OR: [{ discountEndAt: null }, { discountEndAt: { gt: new Date() } }],
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
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
    },
    // Ən yeni endirimlər əvvəl — siyahı 90% shovelware ilə dolmasın.
    orderBy: { discountStartedAt: "desc" },
    take: limit * 2,
  });

  const mapped: CampaignGame[] = rows.map((g) => {
    const d = computeDisplayPrice(g, settings);
    return {
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      finalAzn: d.finalAzn,
      originalAzn: d.originalAzn,
      discountPct: d.discountPct,
    };
  });

  // DB sırasını (ən yeni endirim əvvəl) qoru; yalnız real endirimi olanlar.
  return mapped.filter((g) => g.discountPct != null && g.discountPct > 0).slice(0, limit);
}

/** Verilmiş productId-lərə uyğun cari endirimli oyun snapshotunu qaytarır. */
export async function snapshotGamesByProductIds(
  productIds: string[]
): Promise<CampaignGame[]> {
  if (productIds.length === 0) return [];
  const settings = await getSettings();
  const rows = await prisma.game.findMany({
    where: { productId: { in: productIds } },
    select: {
      productId: true,
      title: true,
      imageUrl: true,
      store: true,
      priceTryCents: true,
      discountTryCents: true,
      discountEndAt: true,
      priceUsdCents: true,
      discountUsdCents: true,
    },
  });
  const byId = new Map(rows.map((g) => [g.productId, g]));
  // İstənilən sıranı qoru.
  const out: CampaignGame[] = [];
  for (const pid of productIds) {
    const g = byId.get(pid);
    if (!g) continue;
    const d = computeDisplayPrice(g, settings);
    out.push({
      productId: g.productId,
      title: g.title,
      imageUrl: g.imageUrl,
      finalAzn: d.finalAzn,
      originalAzn: d.originalAzn,
      discountPct: d.discountPct,
    });
  }
  return out;
}

// ── Auditoriya seçimi (filtr + əllə include/exclude) ────────────────────────

/** Anti-spam: son bu qədər gündə artıq mesaj alanlar default olaraq çıxarılır. */
export const DEFAULT_COOLDOWN_DAYS = 7;

export type ResolvedAudience = {
  recipients: CampaignRecipientUser[];
  /** Cooldown səbəbilə çıxarılan (yaxınlarda mesaj almış) müştəri sayı. */
  cooledDownCount: number;
};

/**
 * Son `cooldownDays` gündə (default 7) ən azı bir kampaniya mesajı UĞURLA
 * göndərilmiş müştərilərin id-ləri — onları təkrar bezdirməmək üçün.
 */
export async function getRecentlyContactedUserIds(cooldownDays: number): Promise<Set<string>> {
  if (!cooldownDays || cooldownDays <= 0) return new Set();
  const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.campaignRecipient.findMany({
    where: {
      createdAt: { gte: cutoff },
      OR: [{ emailStatus: "SENT" }, { waStatus: "SENT" }],
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Kampaniya alıcılarını həll edir. Həmişə istisna: bloklanmış hesablar və test
 * hesabları. Email/WhatsApp kanalına uyğunluq (təsdiq, unsubscribe, nömrə)
 * göndərmə mərhələsində yoxlanılır — burada baza siyahısı qaytarılır.
 *
 * Anti-spam: `cooldownDays` > 0 olduqda son o qədər gündə mesaj almış müştərilər
 * çıxarılır. Əllə əlavə olunan (includeUserIds) müştərilər cooldown-u keçir —
 * admin onları bilərəkdən seçib.
 */
export async function resolveCampaignAudience(params: {
  filters?: CampaignAudienceFilters;
  includeUserIds?: string[];
  excludeUserIds?: string[];
  cooldownDays?: number;
}): Promise<ResolvedAudience> {
  const filters = params.filters ?? {};
  const includeIds = new Set(params.includeUserIds ?? []);
  const excludeIds = new Set(params.excludeUserIds ?? []);
  const cooldownDays = params.cooldownDays ?? 0;
  const testEmails = getTestAccountEmails();

  const where: Record<string, unknown> = {
    disabled: false,
    email: { notIn: testEmails },
  };

  if (filters.emailVerified) where.emailVerified = true;
  if (filters.hasPhone) where.phone = { not: null };

  if (filters.tierId === "none") where.tierId = null;
  else if (filters.tierId) where.tierId = filters.tierId;

  const created: Record<string, Date> = {};
  if (filters.createdFrom) {
    const d = new Date(filters.createdFrom);
    if (!isNaN(d.getTime())) created.gte = d;
  }
  if (filters.createdTo) {
    const d = new Date(filters.createdTo + "T23:59:59");
    if (!isNaN(d.getTime())) created.lte = d;
  }
  if (Object.keys(created).length) where.createdAt = created;

  if (filters.hasOrders) {
    const buyers = await prisma.transaction.findMany({
      where: { status: "SUCCESS", type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
      select: { userId: true },
      distinct: ["userId"],
    });
    where.id = { in: buyers.map((b) => b.userId).filter(Boolean) as string[] };
  }

  // Məhsul alıb, amma rəy yazmamış müştərilər. "Rəy yazıb" siqnalı: GameReview
  // (userId), istifadə olunmuş ReviewInvite (userId), transactionId-li
  // Testimonial (→ tx.userId) və könüllü anasayfa rəyləri (yalnız `name`
  // saxladığı üçün ada görə — mühafizəkar: rəy yazanı təkrar narahat etmirik).
  if (filters.purchasedNotReviewed) {
    const buyerRows = await prisma.transaction.findMany({
      where: { status: "SUCCESS", type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
      select: { userId: true },
      distinct: ["userId"],
    });
    const buyerIds = buyerRows.map((b) => b.userId).filter(Boolean) as string[];

    const reviewedIds = new Set<string>();
    if (buyerIds.length) {
      const [gameReviewers, doneInvites, txTestimonials, allTestimonialNames] = await Promise.all([
        prisma.gameReview.findMany({
          where: { userId: { in: buyerIds } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.reviewInvite.findMany({
          where: { userId: { in: buyerIds }, usedAt: { not: null } },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.testimonial.findMany({
          where: { transactionId: { not: null } },
          select: { transactionId: true },
        }),
        prisma.testimonial.findMany({ select: { name: true }, distinct: ["name"] }),
      ]);

      for (const r of gameReviewers) if (r.userId) reviewedIds.add(r.userId);
      for (const r of doneInvites) if (r.userId) reviewedIds.add(r.userId);

      const txIds = txTestimonials.map((t) => t.transactionId).filter(Boolean) as string[];
      if (txIds.length) {
        const txs = await prisma.transaction.findMany({
          where: { id: { in: txIds } },
          select: { userId: true },
        });
        for (const t of txs) if (t.userId) reviewedIds.add(t.userId);
      }

      const reviewedNames = new Set(allTestimonialNames.map((t) => t.name));
      const buyers = await prisma.user.findMany({
        where: { id: { in: buyerIds } },
        select: { id: true, name: true, email: true },
      });
      const notReviewed = buyers
        .filter((u) => {
          if (reviewedIds.has(u.id)) return false;
          const displayName = u.name ?? u.email.split("@")[0];
          return !reviewedNames.has(displayName);
        })
        .map((u) => u.id);
      where.id = { in: notReviewed };
    } else {
      where.id = { in: [] };
    }
  }

  const select = {
    id: true,
    email: true,
    name: true,
    phone: true,
    emailVerified: true,
    marketingUnsubscribedAt: true,
  } as const;

  const matched = await prisma.user.findMany({ where, select });

  const byId = new Map<string, CampaignRecipientUser>(matched.map((u) => [u.id, u]));

  // Anti-spam cooldown — yaxınlarda mesaj almışları çıxar (əllə əlavə olunanlar
  // istisna; admin onları bilərəkdən seçib).
  let cooledDownCount = 0;
  if (cooldownDays > 0) {
    const recent = await getRecentlyContactedUserIds(cooldownDays);
    for (const id of [...byId.keys()]) {
      if (recent.has(id) && !includeIds.has(id)) {
        byId.delete(id);
        cooledDownCount += 1;
      }
    }
  }

  // Əllə əlavə olunanlar — filtrdən keçməsələr belə daxil et (yenə bloklanmış /
  // test hesablar istisna).
  const missingIncludes = [...includeIds].filter((id) => !byId.has(id));
  if (missingIncludes.length) {
    const extra = await prisma.user.findMany({
      where: { id: { in: missingIncludes }, disabled: false, email: { notIn: testEmails } },
      select,
    });
    for (const u of extra) byId.set(u.id, u);
  }

  // Əllə çıxarılanları sil.
  for (const id of excludeIds) byId.delete(id);

  return { recipients: [...byId.values()], cooledDownCount };
}

// ── Mesaj formatı (WhatsApp) ────────────────────────────────────────────────

/**
 * WhatsApp düz-mətn gövdəsi: giriş mətni + oyun sətirləri + opt-out qeydi.
 * Preview ilə eyni funksiyadan istifadə olunur ki, admin gördüyü = göndərilən.
 */
export function buildCampaignWhatsappText(
  messageText: string,
  games: CampaignGame[],
  opts?: { linkFor?: (productId: string) => string }
): string {
  const linkFor = opts?.linkFor ?? gameUrl;
  const lines: string[] = [];
  const intro = messageText.trim();
  if (intro) lines.push(intro, "");

  for (const g of games) {
    const price = fmtAzn(g.finalAzn);
    if (g.originalAzn != null && g.discountPct != null) {
      lines.push(`🎮 ${g.title}`);
      lines.push(`   ${price}  (əvvəl ${fmtAzn(g.originalAzn)}, -${g.discountPct}%)`);
    } else {
      lines.push(`🎮 ${g.title} — ${price}`);
    }
    lines.push(`   ${linkFor(g.productId)}`);
  }

  if (games.length) lines.push("");
  lines.push("— Honsell PS Store");
  return lines.join("\n");
}

// ── Orkestrasiya: kampaniyanı göndər ────────────────────────────────────────

export type CampaignSendResult = {
  campaignId: string;
  recipientCount: number;
  emailSent: number;
  emailFailed: number;
  waSent: number;
  waFailed: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mövcud kampaniyanı göndərir: hər alıcıya seçilmiş kanal(lar)la mesaj göndərir,
 * `CampaignRecipient` audit sətrini yazır və sayğacları yeniləyir.
 *
 * Kanal qaydaları:
 *  • Email yalnız emaili təsdiqlənmiş VƏ unsubscribe etməmiş alıcılara → SKIPPED əks halda.
 *  • WhatsApp yalnız etibarlı E.164 nömrəsi olanlara → SKIPPED əks halda.
 */
export async function runCampaign(campaignId: string): Promise<CampaignSendResult> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Kampaniya tapılmadı.");

  const games = (campaign.gamesSnapshot as unknown as CampaignGame[]) ?? [];
  const isReviewKind = campaign.kind === "REVIEW_INVITE";
  const waReady = campaign.sendWhatsapp && isWasenderConfigured();

  // Email yalnız real göndərişdə yüklənsin.
  const { sendCampaignEmail } = await import("@/lib/resend");

  const result: CampaignSendResult = {
    campaignId,
    recipientCount: 0,
    emailSent: 0,
    emailFailed: 0,
    waSent: 0,
    waFailed: 0,
  };

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId },
    include: {
      user: {
        select: { name: true, emailVerified: true, marketingUnsubscribedAt: true },
      },
    },
  });
  result.recipientCount = recipients.length;

  for (const r of recipients) {
    let emailStatus = "N_A";
    let waStatus = "N_A";
    const errors: string[] = [];

    // Bu alıcıya xas klik izləmə linkləri.
    const linkFor = (pid: string) => campaignClickUrl(campaign.id, r.id, pid);

    // ── Email ──
    if (campaign.sendEmail) {
      if (!r.user.emailVerified || r.user.marketingUnsubscribedAt) {
        emailStatus = "SKIPPED";
      } else {
        try {
          await sendCampaignEmail({
            email: r.email,
            userName: r.user.name?.split(" ")[0] ?? r.email.split("@")[0],
            title: campaign.title,
            messageText: campaign.messageText,
            unsubscribeUrl: unsubscribeUrl(r.userId),
            games,
            linkFor,
            kind: isReviewKind ? "REVIEW_INVITE" : "PROMO",
            reviewUrl: reviewInviteUrl(),
          });
          emailStatus = "SENT";
          result.emailSent += 1;
        } catch (e) {
          emailStatus = "FAILED";
          result.emailFailed += 1;
          errors.push(`email: ${e instanceof Error ? e.message : "send error"}`);
        }
      }
    }

    // ── WhatsApp ──
    if (campaign.sendWhatsapp) {
      const to = normalizeToE164(r.phone);
      if (!waReady || !to) {
        waStatus = "SKIPPED";
      } else {
        const waText = isReviewKind
          ? buildCampaignReviewWhatsappText(campaign.messageText)
          : buildCampaignWhatsappText(campaign.messageText, games, { linkFor });
        const sent = await sendWasenderText({ to, text: waText });
        if (sent.ok) {
          waStatus = "SENT";
          result.waSent += 1;
        } else {
          waStatus = "FAILED";
          result.waFailed += 1;
          errors.push(`whatsapp: ${sent.error}`);
        }
        await sleep(WA_SEND_DELAY_MS);
      }
    }

    await prisma.campaignRecipient.update({
      where: { id: r.id },
      data: {
        emailStatus,
        waStatus,
        error: errors.length ? errors.join(" | ").slice(0, 500) : null,
      },
    });
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      recipientCount: result.recipientCount,
      emailSent: result.emailSent,
      emailFailed: result.emailFailed,
      waSent: result.waSent,
      waFailed: result.waFailed,
    },
  });

  return result;
}
