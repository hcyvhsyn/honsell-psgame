import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  CAMPAIGN_MAX_GAMES,
  CAMPAIGN_MAX_RECIPIENTS,
  resolveCampaignAudience,
  runCampaign,
  snapshotGamesByProductIds,
  type CampaignAudienceFilters,
} from "@/lib/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET → son kampaniyaların tarixçəsi. */
export async function GET() {
  await requireAdmin();
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json({ campaigns });
}

/**
 * POST → kampaniya yarat və dərhal göndər.
 * body: { title, messageText, productIds[], sendEmail, sendWhatsapp,
 *         filters, includeUserIds[], excludeUserIds[] }
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const kind = body.kind === "REVIEW_INVITE" ? "REVIEW_INVITE" : "PROMO";
  const isReview = kind === "REVIEW_INVITE";
  const messageText = typeof body.messageText === "string" ? body.messageText.trim() : "";
  const productIds: string[] = Array.isArray(body.productIds)
    ? body.productIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const sendEmail = Boolean(body.sendEmail);
  const sendWhatsapp = Boolean(body.sendWhatsapp);
  const filters: CampaignAudienceFilters =
    body.filters && typeof body.filters === "object" ? body.filters : {};
  const includeUserIds: string[] = Array.isArray(body.includeUserIds)
    ? body.includeUserIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const excludeUserIds: string[] = Array.isArray(body.excludeUserIds)
    ? body.excludeUserIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  const cooldownDays =
    typeof body.cooldownDays === "number" && body.cooldownDays >= 0 ? body.cooldownDays : 0;

  if (!title) {
    return NextResponse.json({ error: "Başlıq boş ola bilməz." }, { status: 400 });
  }
  if (!sendEmail && !sendWhatsapp) {
    return NextResponse.json({ error: "Ən azı bir kanal seçin (Email və ya WhatsApp)." }, { status: 400 });
  }
  // Rəy dəvətində oyun seçimi məcburi deyil (oyun yox, "Rəy yaz" CTA göndərilir).
  if (!isReview && productIds.length === 0) {
    return NextResponse.json({ error: "Ən azı bir oyun seçin." }, { status: 400 });
  }
  if (productIds.length > CAMPAIGN_MAX_GAMES) {
    return NextResponse.json(
      { error: `Maksimum ${CAMPAIGN_MAX_GAMES} oyun seçə bilərsiniz.` },
      { status: 400 }
    );
  }

  try {
    const games = productIds.length ? await snapshotGamesByProductIds(productIds) : [];
    if (!isReview && games.length === 0) {
      return NextResponse.json({ error: "Seçilmiş oyunlar tapılmadı." }, { status: 400 });
    }

    const { recipients } = await resolveCampaignAudience({
      filters,
      includeUserIds,
      excludeUserIds,
      cooldownDays,
    });
    if (recipients.length === 0) {
      return NextResponse.json({ error: "Auditoriyada heç bir alıcı yoxdur." }, { status: 400 });
    }
    if (recipients.length > CAMPAIGN_MAX_RECIPIENTS) {
      return NextResponse.json(
        {
          error: `Auditoriya çox böyükdür (${recipients.length}). Maksimum ${CAMPAIGN_MAX_RECIPIENTS} alıcı. Filtri daraldın.`,
        },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        title,
        kind,
        messageText,
        sendEmail,
        sendWhatsapp,
        gamesSnapshot: games as unknown as object,
        status: "DRAFT",
        recipientCount: recipients.length,
        createdById: admin.id,
        recipients: {
          create: recipients.map((r) => ({
            userId: r.id,
            email: r.email,
            phone: r.phone,
          })),
        },
      },
    });

    const result = await runCampaign(campaign.id);
    return NextResponse.json({ ok: true, campaignId: campaign.id, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("campaign send failed", { adminId: admin.id, kind, message, err });
    return NextResponse.json(
      { error: `Göndərmə zamanı server xətası: ${message}` },
      { status: 500 },
    );
  }
}
