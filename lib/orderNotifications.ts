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
    `Daha ətraflı: honsell.store/profile/orders\n` +
    `Honsell.store`;

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

/**
 * Müştəri admin tərəfindən "Sponsorlu" statusuna keçirildikdə ona WhatsApp ilə
 * artırılmış oyun referal faizi barədə məlumat verir. Səssizcə uğursuz olur
 * (telefon yoxdursa / WaSender konfiqurasiya olunmayıbsa) — admin axınını saxlamır.
 */
export async function sendSponsoredWhatsApp(params: {
  phone: string | null | undefined;
  userName?: string | null;
  /** Oyun referal faizi (məs. 8). */
  pct: number;
  /** Müştərinin referal kodu — mesaja əlavə olunur. */
  referralCode?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isWasenderConfigured()) {
    return { ok: false, reason: "WASENDER_NOT_CONFIGURED" };
  }
  const to = normalizeToE164(params.phone);
  if (!to) {
    return { ok: false, reason: "PHONE_INVALID" };
  }

  const greeting = params.userName?.trim() ? `Salam, ${params.userName.trim()}!` : "Salam!";
  const pct = Number.isFinite(params.pct) ? params.pct : 8;
  const codeLine = params.referralCode?.trim()
    ? `\n\nReferal kodunuz: ${params.referralCode.trim()}`
    : "";

  const text =
    `${greeting}\n\n` +
    `Təbriklər! 🎉 Hesabınız Honsell.store-da *sponsor* statusu aldı.\n\n` +
    `Bundan sonra referal linkinizlə qeydiyyatdan keçən istifadəçilərin ` +
    `*oyun alışlarından* ${pct}% bonus qazanacaqsınız. Bonus referal balansınıza yığılır.` +
    `${codeLine}\n\n` +
    `Honsell.store`;

  try {
    const res = await sendWasenderText({ to, text });
    if (!res.ok) {
      console.error("sponsored whatsapp send failed", { reason: res.error });
      return { ok: false, reason: res.error };
    }
    return { ok: true };
  } catch (err) {
    console.error("sponsored whatsapp threw", { err });
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}
