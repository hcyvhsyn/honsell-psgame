import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getStreamingPlatforms } from "@/lib/streamingPlatforms";
import { normalizeToE164, sendWasenderText } from "@/lib/wasender";

export const runtime = "nodejs";

const INVITE_TTL_DAYS = 30;
const ALLOWED_MONTHS = new Set([1, 3, 6, 12]);

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://honsell.store").replace(/\/$/, "");
}

function inviteText(productTitle: string, url: string): string {
  return [
    `Salam! 👋`,
    ``,
    `Honsell PS Store-dan aldığın *${productTitle}* üçün rəyini bizimlə bölüş.`,
    `Bir neçə addımda tamamlanır və honsell.store hesabın da yaranır:`,
    ``,
    url,
  ].join("\n");
}

export async function GET() {
  await requireAdmin();
  const items = await prisma.whatsappReviewInvite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      token: true,
      phone: true,
      productTitle: true,
      status: true,
      name: true,
      reviewText: true,
      rating: true,
      usedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    items: items.map((i) => ({
      ...i,
      url: `${baseUrl()}/rey/${i.token}`,
      usedAt: i.usedAt?.toISOString() ?? null,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const phone = normalizeToE164(body.phone != null ? String(body.phone) : "");
  if (!phone) {
    return NextResponse.json(
      { error: "Telefon nömrəsi düzgün deyil (məs: +994501234567)." },
      { status: 400 }
    );
  }

  const months = Math.round(Number(body.months) || 0);
  if (!ALLOWED_MONTHS.has(months)) {
    return NextResponse.json(
      { error: "Müddət 1, 3, 6 və ya 12 ay olmalıdır." },
      { status: 400 }
    );
  }

  const platformCode = body.platformCode ? String(body.platformCode).trim() : "";
  const platforms = await getStreamingPlatforms();
  const platform = platforms.find((p) => p.code === platformCode);
  if (!platform) {
    return NextResponse.json({ error: "Xidmət tapılmadı." }, { status: 400 });
  }

  const productTitle = `${platform.label} — ${months} ay`;
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invite = await prisma.whatsappReviewInvite.create({
    data: {
      token,
      phone,
      platformCode: platform.code,
      productTitle,
      platform: platform.category === "MUSIC" ? "MUSIC" : "STREAMING",
      months,
      expiresAt,
    },
    select: { id: true, token: true, phone: true, productTitle: true, status: true, createdAt: true },
  });

  const url = `${baseUrl()}/rey/${token}`;

  let whatsappSent = false;
  let whatsappError: string | null = null;
  try {
    const result = await sendWasenderText({ to: phone, text: inviteText(productTitle, url) });
    whatsappSent = result.ok;
    if (!result.ok) whatsappError = result.error;
  } catch (err) {
    whatsappError = err instanceof Error ? err.message : "network error";
  }

  return NextResponse.json({
    invite: {
      ...invite,
      url,
      usedAt: null,
      expiresAt: expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    },
    whatsappSent,
    whatsappError,
  });
}
