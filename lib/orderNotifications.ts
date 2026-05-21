import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";

/**
 * Admin sifariş təsdiqi anında müştəriyə WhatsApp təsdiq mesajı göndərir.
 * Sənədsiz şəkildə uğursuz olur (telefon yoxdursa, WaSender konfiqurasiya
 * olunmayıbsa və ya API səhv qaytarsa) — log-a yazır, sifariş axınını dayandırmır.
 */
export async function sendOrderApprovedWhatsApp(params: {
  phone: string | null | undefined;
  userName?: string | null;
  productTitle?: string | null;
  /** "honsell-gift-card" | "platform" | "streaming" | "ai" | "music" | "work" | "try-balance" və s. */
  kind?: string;
  /** Mesaja əlavə olunan extra sətir (məs. "Kodunuz email-ə göndərildi."). */
  extraLine?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isWasenderConfigured()) {
    return { ok: false, reason: "WASENDER_NOT_CONFIGURED" };
  }
  const to = normalizeToE164(params.phone);
  if (!to) {
    return { ok: false, reason: "PHONE_INVALID" };
  }

  const greeting = params.userName?.trim() ? `Salam, ${params.userName.trim()}!` : "Salam!";
  const product = params.productTitle?.trim()
    ? `«${params.productTitle.trim()}»`
    : "sifarişiniz";
  const extra = params.extraLine?.trim() ? `\n\n${params.extraLine.trim()}` : "";

  const text =
    `${greeting}\n\n` +
    `${product} üzrə sifarişiniz tamamlandı və tərəfimizdən təsdiqləndi. ✅` +
    `${extra}\n\n` +
    `Daha ətraflı: honsell.az/profile/orders\n` +
    `Honsell.az`;

  try {
    const res = await sendWasenderText({ to, text });
    if (!res.ok) {
      console.error("order whatsapp send failed", { kind: params.kind, reason: res.error });
      return { ok: false, reason: res.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("order whatsapp threw", { kind: params.kind, err });
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}
