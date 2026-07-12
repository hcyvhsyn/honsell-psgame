/**
 * Telegram Bot API köməkçiləri — Reels-ə video ingest üçün.
 *
 * Lazımi env-lər:
 *   TELEGRAM_BOT_TOKEN      — @BotFather-dən bot tokeni
 *   TELEGRAM_WEBHOOK_SECRET — təsadüfi sətir; webhook qeydiyyatında verilir və
 *                             Telegram hər sorğuda `X-Telegram-Bot-Api-Secret-Token`
 *                             header-ində geri göndərir (spoofing-ə qarşı).
 *   TELEGRAM_ALLOWED_IDS    — vergüllə ayrılmış icazəli Telegram user/chat id-ləri.
 *                             Yalnız bunlar reel əlavə edə bilir.
 */

const API = "https://api.telegram.org";

export function telegramToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function telegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
}

export function telegramAllowedIds(): Set<string> {
  return new Set(
    (process.env.TELEGRAM_ALLOWED_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isTelegramSenderAllowed(userId?: number | string, chatId?: number | string): boolean {
  const allowed = telegramAllowedIds();
  if (allowed.size === 0) return false; // allowlist boşdursa heç kim (təhlükəsizlik)
  return (
    (userId != null && allowed.has(String(userId))) ||
    (chatId != null && allowed.has(String(chatId)))
  );
}

type TgFile = { file_id: string; file_path?: string; file_size?: number };

/** getFile — file_id üçün endirmə yolu (file_path) alır. */
export async function telegramGetFile(fileId: string): Promise<TgFile | null> {
  const token = telegramToken();
  if (!token) return null;
  const res = await fetch(`${API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const data = await res.json().catch(() => null);
  if (!data?.ok || !data.result?.file_path) return null;
  return data.result as TgFile;
}

/** Telegram fayl serverindən baytları endirir. */
export async function telegramDownload(filePath: string): Promise<Buffer | null> {
  const token = telegramToken();
  if (!token) return null;
  const res = await fetch(`${API}/file/bot${token}/${filePath}`);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

/** file_id → baytlar (getFile + download birlikdə). */
export async function telegramFetchFileBytes(fileId: string): Promise<Buffer | null> {
  const f = await telegramGetFile(fileId);
  if (!f?.file_path) return null;
  return telegramDownload(f.file_path);
}

/** Telegram inline keyboard düyməsi (callback_data ≤ 64 bayt). */
export type TgInlineButton = { text: string; callback_data: string };

/** Söhbətə mətn cavabı göndərir (nəticə/xəta bildirişi üçün). */
export async function telegramSendMessage(
  chatId: number | string,
  text: string,
  opts?: { keyboard?: TgInlineButton[][] },
): Promise<void> {
  const token = telegramToken();
  if (!token) return;
  await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(opts?.keyboard ? { reply_markup: { inline_keyboard: opts.keyboard } } : {}),
    }),
  }).catch(() => {});
}

/** callback_query-ə cavab verir (düyməyə basılanda "saat" ikonasını söndürür). */
export async function telegramAnswerCallback(callbackId: string, text?: string): Promise<void> {
  const token = telegramToken();
  if (!token) return;
  await fetch(`${API}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, ...(text ? { text } : {}) }),
  }).catch(() => {});
}

/** Mövcud mesajın mətnini yeniləyir (düymələri də silir). */
export async function telegramEditMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
): Promise<void> {
  const token = telegramToken();
  if (!token) return;
  await fetch(`${API}/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: true,
    }),
  }).catch(() => {});
}

/** Webhook-u qeyd edir (setup endpoint-i çağırır). */
export async function telegramSetWebhook(url: string): Promise<{ ok: boolean; description?: string }> {
  const token = telegramToken();
  const secret = telegramWebhookSecret();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN yoxdur" };
  const res = await fetch(`${API}/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      ...(secret ? { secret_token: secret } : {}),
      allowed_updates: ["message", "channel_post", "callback_query"],
      drop_pending_updates: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: Boolean(data?.ok), description: data?.description };
}
