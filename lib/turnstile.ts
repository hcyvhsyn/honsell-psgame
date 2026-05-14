/**
 * Cloudflare Turnstile token-i serverdə təsdiqləyir.
 * Env: TURNSTILE_SECRET_KEY (server), NEXT_PUBLIC_TURNSTILE_SITE_KEY (frontend).
 * Secret yoxdursa, fallback olaraq həmişə uğurlu sayılır (dev mühitlərdə
 * captcha-sız işləmək üçün). Production-da secret tələb olunur.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return { ok: true }; // captcha disabled in dev

  const trimmed = (token ?? "").trim();
  if (!trimmed) return { ok: false, error: "captcha tokeni yoxdur" };

  const form = new URLSearchParams();
  form.append("secret", secret);
  form.append("response", trimmed);
  if (ip && ip !== "unknown") form.append("remoteip", ip);

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }

  if (!res.ok) return { ok: false, error: `siteverify ${res.status}` };

  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    "error-codes"?: string[];
  } | null;

  if (!data?.success) {
    const codes = data?.["error-codes"]?.join(",") ?? "unknown";
    return { ok: false, error: `captcha rədd edildi (${codes})` };
  }
  return { ok: true };
}
