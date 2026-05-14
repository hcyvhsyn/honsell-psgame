/**
 * WaSender (wasenderapi.com) — WhatsApp text gönderimi.
 * Env: WASENDER_API_KEY, WASENDER_BASE_URL (default https://www.wasenderapi.com).
 * WASENDER_SESSION yalnız body-də göndərilmək üçündür (verilibsə əlavə olunur);
 * standart API açar başına vahid sessiya istifadə edir.
 */

const DEFAULT_BASE_URL = "https://www.wasenderapi.com";

export function isWasenderConfigured(): boolean {
  return Boolean(process.env.WASENDER_API_KEY?.trim());
}

/**
 * `to` mütləq E.164 formatında olmalıdır (məs: "+994501234567").
 * Boş/yanlış format → null qaytarır (göndərmə cəhdi edilmir).
 */
export function normalizeToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export async function sendWasenderText(params: {
  to: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.WASENDER_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "WASENDER_API_KEY is not set" };

  const baseUrl = (process.env.WASENDER_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const session = process.env.WASENDER_SESSION?.trim() || null;

  const body: Record<string, unknown> = {
    to: params.to,
    text: params.text,
  };
  if (session) body.session_id = session;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `wasender ${res.status}: ${text.slice(0, 200)}` };
  }

  return { ok: true };
}
