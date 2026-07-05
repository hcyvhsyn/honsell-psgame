import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import {
  telegramToken,
  telegramWebhookSecret,
  telegramAllowedIds,
  telegramSetWebhook,
} from "@/lib/telegram";

export const runtime = "nodejs";

const WEBHOOK_PATH = "/api/telegram/webhook";

/** Konfiqurasiya statusu (env-lərin qurulub-qurulmadığı + webhook info). */
export async function GET() {
  await requireAdmin();
  const token = telegramToken();
  let webhookInfo: unknown = null;
  if (token) {
    webhookInfo = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
      .then((r) => r.json())
      .then((d) => d?.result ?? null)
      .catch(() => null);
  }
  return NextResponse.json({
    hasToken: Boolean(token),
    hasSecret: Boolean(telegramWebhookSecret()),
    allowedCount: telegramAllowedIds().size,
    expectedWebhookUrl: `${SITE_URL}${WEBHOOK_PATH}`,
    webhookInfo,
  });
}

/** Webhook-u qeyd edir (SITE_URL əsasında). */
export async function POST() {
  await requireAdmin();
  if (!telegramToken()) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN qurulmayıb" }, { status: 400 });
  }
  const url = `${SITE_URL}${WEBHOOK_PATH}`;
  const res = await telegramSetWebhook(url);
  if (!res.ok) {
    return NextResponse.json({ error: res.description ?? "setWebhook alınmadı", url }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url });
}
